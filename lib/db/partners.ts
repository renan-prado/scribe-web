import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("partners");

/**
 * Acesso ao schema de parceiros (migração 0029).
 *
 * Tudo aqui passa pelo service-role: as duas funções do banco têm EXECUTE
 * revogado de `anon`/`authenticated`, exatamente como `grant_coins`. Mesmo
 * padrão de `lib/db/billing.ts` — o servidor é a única porta.
 */

/**
 * Resultado de `attach_partner`. Só `ok` credita bônus; os demais são
 * recusas NORMAIS, e nenhuma delas pode quebrar o login:
 *
 *   already_attributed — a conta já pertence a um parceiro (o vínculo é
 *                        permanente, e o primeiro vale)
 *   not_new            — conta antiga demais; um usuário de meses atrás
 *                        abrindo um link não vira indicação (nem ganha bônus)
 *   unknown_slug       — link velho, código digitado errado, parceiro suspenso
 *   self_referral      — o parceiro usando o próprio link
 */
export type AttachPartnerResult =
  | "ok"
  | "already_attributed"
  | "not_new"
  | "unknown_slug"
  | "self_referral";

const ATTACH_RESULTS: readonly string[] = [
  "ok",
  "already_attributed",
  "not_new",
  "unknown_slug",
  "self_referral",
];

/**
 * Vincula um usuário recém-criado a um parceiro e credita o bônus de
 * indicação. Idempotente pelo lado do banco (o vínculo só é gravado quando
 * `partner_id` está nulo, e o bônus passa por `grant_coins` com
 * `external_ref` único).
 *
 * NÃO lança. Uma falha aqui vira `unknown_slug` e um log: o usuário está no
 * meio do login, e perder um bônus é ruim, mas não entrar no app é pior.
 */
export async function attachPartner(args: {
  userId: string;
  slug: string;
  source: "link" | "code";
}): Promise<AttachPartnerResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_partner", {
    p_user_id: args.userId,
    p_slug: args.slug,
    p_source: args.source,
  });
  if (error) {
    log.error("attach_partner failed", {
      userId: args.userId,
      slug: args.slug,
      error: error.message,
    });
    return "unknown_slug";
  }
  return ATTACH_RESULTS.includes(data as string) ? (data as AttachPartnerResult) : "unknown_slug";
}

/**
 * Contabiliza uma visita ao link do parceiro. `unique` distingue "abriu de
 * novo" de "pessoa diferente" — sem isso, um link em stories reaberto pela
 * mesma pessoa infla o topo do funil e o painel do parceiro vira ficção.
 *
 * Slug desconhecido é ignorado em silêncio pela própria função do banco.
 */
export async function recordPartnerClick(slug: string, unique: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_partner_click", {
    p_slug: slug,
    p_unique: unique,
  });
  if (error) {
    // Contador de métrica: registrar é melhor do que falhar, mas um erro aqui
    // nunca pode atrapalhar o redirect que leva a pessoa à landing page.
    log.error("record_partner_click failed", { slug, error: error.message });
  }
}

/**
 * Dados de um parceiro que podem ser mostrados a um VISITANTE anônimo — hoje,
 * na tela de login, para confirmar "você foi indicado por Fulano e vai ganhar
 * N moedas".
 *
 * O nome do tipo é literal: `Public` significa que este objeto atravessa a
 * fronteira do servidor. Não acrescente e-mail, documento, chave PIX, taxa de
 * comissão nem orçamento aqui — é a mesma tabela que guarda tudo isso.
 */
export type PartnerPublic = {
  slug: string;
  displayName: string;
  signupBonusCoins: number;
};

/** Resolve um slug para exibição. `null` quando não existe ou está suspenso. */
export async function getPartnerPublicBySlug(slug: string): Promise<PartnerPublic | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partners")
    .select("slug, display_name, signup_bonus_coins")
    .ilike("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    log.error("getPartnerPublicBySlug failed", { slug, error: error.message });
    return null;
  }
  if (!data) return null;
  return {
    slug: data.slug,
    displayName: data.display_name,
    signupBonusCoins: data.signup_bonus_coins,
  };
}

/**
 * Registra a comissão da PRIMEIRA assinatura de um indicado.
 *
 * Devolve o valor em centavos quando a comissão foi criada agora, e `0`
 * quando não havia o que criar — porque o usuário não veio de parceiro, ou
 * porque a comissão dele já existe. Os dois casos são normais e nenhum é erro.
 *
 * A regra "uma vez por pessoa, para sempre" NÃO é verificada aqui: ela é a
 * constraint UNIQUE em `referred_user_id` (migração 0029). Cancelar e
 * reassinar seis meses depois colide na constraint, e o INSERT simplesmente
 * não acontece. Deixar a regra no banco em vez de num `if` significa que ela
 * vale para todos os caminhos de crédito, inclusive os que ainda não existem.
 *
 * O cálculo usa o valor BRUTO da fatura, e `commission_cents` fica congelado
 * na linha junto do `rate_bps` que o produziu: mudar a taxa de um parceiro
 * amanhã não pode reescrever o que ele já ganhou.
 */
export async function insertFirstSubscriptionCommission(args: {
  userId: string;
  invoiceId: string | null;
  plan: string | null;
  grossCents: number;
  /** Dias de carência antes de a comissão ficar disponível para saque. */
  holdDays: number;
}): Promise<number> {
  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("partner_id")
    .eq("id", args.userId)
    .maybeSingle();
  if (profileErr) {
    log.error("commission: profile lookup failed", {
      userId: args.userId,
      error: profileErr.message,
    });
    return 0;
  }
  if (!profile?.partner_id) return 0; // não veio de parceiro — o caso comum

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .select("id, user_id, commission_rate_bps, status")
    .eq("id", profile.partner_id)
    .maybeSingle();
  if (partnerErr || !partner) {
    log.error("commission: partner lookup failed", {
      partnerId: profile.partner_id,
      error: partnerErr?.message,
    });
    return 0;
  }

  // Parceiro suspenso não acumula. A atribuição do usuário permanece — se a
  // suspensão for revertida, as assinaturas seguintes voltam a comissionar.
  if (partner.status !== "active") {
    log.warn("commission skipped — partner not active", {
      partnerId: partner.id,
      status: partner.status,
    });
    return 0;
  }

  // Auto-indicação. Já é barrada no vínculo (`attach_partner`), mas o parceiro
  // pode ter ligado a conta DEPOIS de ela ter sido atribuída a ele — e aí a
  // checagem de lá não teve como acontecer.
  if (partner.user_id && partner.user_id === args.userId) {
    log.warn("commission skipped — self referral", { partnerId: partner.id });
    return 0;
  }

  const commissionCents = Math.round((args.grossCents * partner.commission_rate_bps) / 10_000);
  if (commissionCents <= 0) return 0;

  const availableAt = new Date(Date.now() + args.holdDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("partner_commissions").insert({
    partner_id: partner.id,
    referred_user_id: args.userId,
    external_ref: `commission:user:${args.userId}`,
    stripe_invoice_id: args.invoiceId,
    plan: args.plan,
    gross_cents: args.grossCents,
    commission_cents: commissionCents,
    rate_bps: partner.commission_rate_bps,
    status: "pending",
    available_at: availableAt,
  });

  if (error) {
    // 23505 = a comissão desta pessoa já existe. É o funcionamento normal da
    // regra "uma vez por pessoa" — não é erro e não merece log de erro.
    if (error.code === "23505") return 0;
    log.error("commission insert failed", {
      partnerId: partner.id,
      userId: args.userId,
      error: error.message,
    });
    return 0;
  }

  log.info("commission accrued", {
    partnerId: partner.id,
    userId: args.userId,
    grossCents: args.grossCents,
    rateBps: partner.commission_rate_bps,
    commissionCents,
    invoice: args.invoiceId,
  });
  return commissionCents;
}

/**
 * Reverte a comissão de um indicado cujo pagamento voltou atrás (reembolso ou
 * contestação).
 *
 * Uma comissão JÁ PAGA não é revertida: o dinheiro saiu daqui por PIX e a
 * linha não pode fingir que isso não aconteceu. O caso vira log em `warn`
 * para conferência manual — mesmo tratamento que o clawback de moedas dá a
 * créditos que já foram gastos. A carência de 30 dias existe justamente para
 * tornar esse caso raro.
 */
export async function reverseCommissionForUser(
  userId: string,
  reason: "refund" | "chargeback"
): Promise<void> {
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("partner_commissions")
    .select("id, partner_id, commission_cents, status, payout_id")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (error) {
    log.error("commission reversal lookup failed", {
      userId,
      error: error.message,
    });
    return;
  }
  if (!row || row.status === "reversed") return;

  if (row.payout_id) {
    log.warn("commission already PAID — manual settlement needed", {
      commissionId: row.id,
      partnerId: row.partner_id,
      amountCents: row.commission_cents,
      reason,
    });
    return;
  }

  const { error: updateErr } = await admin
    .from("partner_commissions")
    .update({ status: "reversed" })
    .eq("id", row.id)
    .is("payout_id", null);
  if (updateErr) {
    log.error("commission reversal failed", {
      commissionId: row.id,
      error: updateErr.message,
    });
    return;
  }

  log.warn("commission reversed", {
    commissionId: row.id,
    partnerId: row.partner_id,
    amountCents: row.commission_cents,
    reason,
  });
}
