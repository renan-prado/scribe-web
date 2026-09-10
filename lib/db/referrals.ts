import "server-only";
import { createLogger } from "@/lib/log";
import {
  REFERRAL_MONTHLY_SIGNUP_CAP,
  REFERRAL_SIGNUP_COINS,
  REFERRAL_SUBSCRIPTION_COINS,
} from "@/lib/referrals/economics";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("referrals");

/**
 * Acesso ao schema do "Indique a um amigo" (migração 0045).
 *
 * Tudo aqui passa pelo service-role: as funções do banco têm EXECUTE revogado
 * de `anon`/`authenticated`, exatamente como `grant_coins` e `attach_partner`.
 * Mesmo padrão de `lib/db/partners.ts`, o servidor é a única porta.
 *
 * **As moedas são passadas por PARÂMETRO**, lidas de
 * `lib/referrals/economics.ts`. Ver o cabeçalho da migração: a régua do
 * programa aberto é global e a tela precisa mostrá-la, então duplicá-la numa
 * tabela criaria dois lugares para o mesmo número, e um dia eles discordam.
 */

/**
 * Resultado de `attach_referrer`. Só `ok` credita; os demais são recusas
 * NORMAIS, e nenhuma delas pode quebrar o login:
 *
 *   already_attributed, a conta já tem dono (parceiro OU amigo). O vínculo é
 *                        permanente e exclusivo, e o primeiro vale.
 *   not_new, conta antiga demais; quem já usa o app não vira
 *                        indicação de ninguém ao abrir um link
 *   unknown_code, código inexistente, digitado errado, ou de uma conta
 *                        desativada
 *   self_referral, a pessoa usando o próprio link
 *   capped, VINCULOU, mas quem indicou já bateu o teto do mês, e
 *                        por isso não recebeu moedas agora. A recompensa por
 *                        assinatura desta pessoa continua valendo.
 */
export type AttachReferrerResult =
  | "ok"
  | "already_attributed"
  | "not_new"
  | "unknown_code"
  | "self_referral"
  | "capped";

const ATTACH_RESULTS: readonly string[] = [
  "ok",
  "already_attributed",
  "not_new",
  "unknown_code",
  "self_referral",
  "capped",
];

/**
 * Vincula uma conta recém-criada a quem a indicou e credita as moedas do
 * cadastro. Idempotente pelo banco (o vínculo só é gravado quando não há dono,
 * e o crédito passa por `grant_coins` com `external_ref` único).
 *
 * NÃO lança. Uma falha vira `unknown_code` e um log: a pessoa está no meio do
 * login, e alguém perder 50 moedas é ruim, não entrar no app é pior.
 */
export async function attachReferrer(args: {
  userId: string;
  code: string;
  source: "link" | "code";
}): Promise<AttachReferrerResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_referrer", {
    p_user_id: args.userId,
    p_code: args.code,
    p_source: args.source,
    p_coins: REFERRAL_SIGNUP_COINS,
    p_month_cap: REFERRAL_MONTHLY_SIGNUP_CAP,
  });
  if (error) {
    log.error("attach_referrer failed", {
      userId: args.userId,
      error: error.message,
    });
    return "unknown_code";
  }
  return ATTACH_RESULTS.includes(data as string) ? (data as AttachReferrerResult) : "unknown_code";
}

/**
 * A recompensa da PRIMEIRA assinatura de um indicado. Devolve as moedas
 * creditadas agora, 0 quando não havia o que fazer, que é o caso comum (a
 * esmagadora maioria dos assinantes não veio de indicação).
 *
 * A regra "uma vez por pessoa, para sempre" não é conferida aqui: é o
 * `external_ref` UNIQUE do livro-razão. Cancelar e reassinar seis meses depois
 * colide na constraint e não credita nada, a regra vale inclusive para os
 * caminhos de crédito que ainda não existem.
 */
export async function awardReferralSubscription(referredUserId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("award_referral_subscription", {
    p_referred_user_id: referredUserId,
    p_coins: REFERRAL_SUBSCRIPTION_COINS,
  });
  if (error) {
    log.error("award_referral_subscription failed", {
      userId: referredUserId,
      error: error.message,
    });
    return 0;
  }
  const coins = typeof data === "number" ? data : Number(data ?? 0);
  if (coins > 0) {
    log.info("recompensa de indicação creditada", { referredUserId, coins });
  }
  return coins;
}

/**
 * O código de indicação da conta, gerado na primeira chamada.
 *
 * Preguiçoso de propósito (ver a migração): não geramos código para contas que
 * nunca vão indicar ninguém, e não mexemos no trigger de criação de perfil,
 * que roda dentro do Supabase Auth.
 *
 * Devolve `null` se a geração falhar, a página de indicação mostra um estado
 * de erro em vez de um link quebrado. Um código errado divulgado é pior que
 * nenhum: ele atribui a outra pessoa.
 */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ensure_referral_code", { p_user_id: userId });
  if (error) {
    log.error("ensure_referral_code failed", { userId, error: error.message });
    return null;
  }
  return typeof data === "string" ? data : null;
}

/**
 * Libera as recompensas por cadastro que um parceiro acumulou. Chamada no
 * caminho preguiçoso de `getCurrentPartner()`, junto da mesada.
 *
 * Nunca lança, pelo mesmo motivo de `ensurePartnerAllowance`: roda no render
 * de todas as páginas do app, e falhar em creditar não pode derrubar quem só
 * queria abrir o feed.
 */
export async function flushPartnerSignupRewards(
  partnerId: string,
  userId: string
): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("flush_partner_signup_rewards", {
      p_partner_id: partnerId,
      p_user_id: userId,
    });
    if (error) {
      log.error("flush_partner_signup_rewards failed", { partnerId, error: error.message });
      return 0;
    }
    const coins = typeof data === "number" ? data : Number(data ?? 0);
    if (coins > 0) log.info("recompensas de cadastro liberadas", { partnerId, coins });
    return coins;
  } catch (err) {
    log.error("flush de recompensas falhou", { partnerId, error: (err as Error).message });
    return 0;
  }
}

/**
 * O que pode ser mostrado a um VISITANTE ANÔNIMO sobre quem o indicou, no
 * selo do hero da landing page e na tela de entrada.
 *
 * O nome do tipo é literal: `Public` significa que este objeto atravessa a
 * fronteira do servidor e é entregue a alguém que não está logado. Por isso
 * ele carrega o PRIMEIRO NOME e mais nada, nunca id, nunca e-mail, nunca o
 * nome completo. A pessoa indicada já sabe quem a convidou; um estranho que
 * abra o link não precisa saber mais do que o convite dizia.
 */
export type ReferrerPublic = {
  firstName: string;
  avatarUrl: string | null;
};

/** Resolve um código para exibição. `null` quando não existe ou foi desativado. */
export async function getReferrerPublicByCode(code: string): Promise<ReferrerPublic | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, avatar_url, email, is_active")
    .eq("referral_code", code)
    .maybeSingle();
  if (error) {
    log.error("getReferrerPublicByCode failed", { error: error.message });
    return null;
  }
  if (!data || data.is_active === false) return null;

  return {
    firstName: firstNameOf(data.display_name, data.email),
    avatarUrl: (data.avatar_url as string | null) ?? null,
  };
}

/**
 * Primeiro nome, com um fallback que nunca vira vergonha na tela.
 *
 * A conta vem do Google, então `display_name` quase sempre existe; quando não
 * existe, o pedaço do e-mail antes do `@` é o que a pessoa reconheceria como
 * si mesma. E o e-mail INTEIRO nunca sai daqui, expor endereço de alguém num
 * selo público seria um vazamento por conveniência.
 */
function firstNameOf(displayName: string | null, email: string | null): string {
  const name = displayName?.trim();
  if (name) return name.split(/\s+/)[0];
  const handle = email?.split("@")[0]?.trim();
  return handle || "um amigo";
}

/**
 * Os números da página `/indicar`.
 *
 * SÓ AGREGADOS, pela mesma regra do painel do parceiro
 * (`lib/db/partner-panel.ts`): nenhuma função aqui devolve linha que
 * represente uma pessoa. Quem indicou vê "3 amigos entraram", nunca "estes 3",
 * e isso não é excesso de zelo, é que o dado não tem por que trafegar: quem
 * mandou o link já sabe para quem mandou.
 *
 * `head: true` com `count: "exact"` para que nem linha trafegue, e para que um
 * refactor distraído não passe a devolvê-las.
 */
export type ReferralPanel = {
  /** Contas criadas pelo link ou pelo código desta pessoa. */
  signups: number;
  /** Quantas delas assinaram (e portanto pagaram a segunda recompensa). */
  subscribers: number;
  /** Moedas somadas das duas recompensas. */
  coinsEarned: number;
  /** Cadastros premiados no mês corrente, o numerador do teto. */
  signupsThisMonth: number;
};

export async function loadReferralPanel(userId: string): Promise<ReferralPanel> {
  const admin = createAdminClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [signupsRes, rewardsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_user_id", userId),
    admin
      .from("referral_rewards")
      .select("event, coins, created_at")
      .eq("beneficiary_user_id", userId)
      .eq("program", "friend"),
  ]);

  if (signupsRes.error) {
    log.error("painel: contagem de cadastros falhou", { error: signupsRes.error.message });
  }
  if (rewardsRes.error) {
    log.error("painel: leitura de recompensas falhou", { error: rewardsRes.error.message });
  }

  let subscribers = 0;
  let coinsEarned = 0;
  let signupsThisMonth = 0;
  const monthIso = monthStart.toISOString();

  for (const row of rewardsRes.data ?? []) {
    coinsEarned += row.coins as number;
    if (row.event === "subscription") subscribers += 1;
    if (row.event === "signup" && (row.created_at as string) >= monthIso) signupsThisMonth += 1;
  }

  return {
    signups: signupsRes.count ?? 0,
    subscribers,
    coinsEarned,
    signupsThisMonth,
  };
}
