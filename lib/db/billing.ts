import "server-only";
import type { PlanKey } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistência de cobrança.
 *
 * Divisão deliberada de clientes Supabase:
 *   - LEITURAS do próprio usuário usam o cliente com cookie (RLS scoping).
 *   - Toda ESCRITA usa o service-role, porque as tabelas de cobrança não têm
 *     policy de insert/update para `authenticated`. Essas escritas só devem
 *     acontecer a partir do webhook, DEPOIS da verificação de assinatura.
 *
 * Nenhuma função aqui aceita "quantidade de moedas" vinda de um request. O
 * único crédito possível é `grantCoins`, cujo `amount` o chamador deriva do
 * catálogo server-only a partir de um Price ID confirmado pelo Stripe.
 */

export type SubscriptionRecord = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: PlanKey;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function rowToSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    plan: (row.plan === "pessoal" || row.plan === "estudioso" ? row.plan : "free") as PlanKey,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

const SELECT =
  "user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end";

/** Assinatura do usuário autenticado (RLS garante o escopo). */
export async function getOwnSubscription(): Promise<SubscriptionRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select(SELECT)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`getOwnSubscription failed: ${error.message}`);
  return data ? rowToSubscription(data as SubscriptionRow) : null;
}

/** stripe_customer_id já vinculado a um usuário, se houver. */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`getStripeCustomerId failed: ${error.message}`);
  return (data?.stripe_customer_id as string | null) ?? null;
}

/**
 * Grava o vínculo usuário ↔ customer. O índice UNIQUE parcial em
 * profiles.stripe_customer_id impede que o mesmo customer acabe apontando
 * para duas contas (o que permitiria pagar uma assinatura e creditar outra).
 */
export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);
  if (error) throw new Error(`setStripeCustomerId failed: ${error.message}`);
}

/**
 * Resolve o dono de um customer do Stripe. É assim que o webhook descobre a
 * quem creditar — nunca por um id vindo do payload do cliente. Procura no
 * profiles (vínculo canônico) e, se falhar, na tabela de assinaturas.
 */
export async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (profileErr) throw new Error(`findUserIdByCustomerId failed: ${profileErr.message}`);
  if (profile?.id) return profile.id as string;

  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (subErr) throw new Error(`findUserIdByCustomerId (subs) failed: ${subErr.message}`);
  return (sub?.user_id as string | undefined) ?? null;
}

export type UpsertSubscriptionInput = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: PlanKey;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Espelha o estado do Stripe na tabela local. Só o webhook chama. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      plan: input.plan,
      status: input.status,
      current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`upsertSubscription failed: ${error.message}`);
}

export type GrantReason =
  | "subscription_grant"
  | "topup_pack"
  | "admin_grant"
  | "refund_reversal_block";

/**
 * ÚNICA porta de crédito da aplicação.
 *
 * `externalRef` é a chave de idempotência e deve identificar unicamente o
 * fato econômico no Stripe (linha de fatura, sessão de checkout). Com ela,
 * reentregas do webhook — que o Stripe faz de propósito — creditam uma vez só.
 *
 * Retorna o saldo resultante, ou null se a RPC falhar (o chamador deve
 * devolver não-2xx para o Stripe reentregar).
 */
export async function grantCoins(args: {
  userId: string;
  amount: number;
  reason: GrantReason;
  externalRef: string;
}): Promise<number | null> {
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    console.error("[billing] grantCoins refused non-positive amount", { amount: args.amount });
    return null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_coins", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_external_ref: args.externalRef,
  });
  if (error) {
    console.error("[billing] grant_coins failed", {
      userId: args.userId,
      reason: args.reason,
      externalRef: args.externalRef,
      error: error.message,
    });
    return null;
  }
  return typeof data === "number" ? data : Number(data);
}

/**
 * Quais destes `external_ref` já existem no ledger.
 *
 * Serve para responder com precisão "este crédito aconteceu AGORA ou já
 * estava lá?" — `grant_coins` devolve o saldo nos dois casos, então comparar
 * saldos não distingue um do outro. A resposta importa porque é ela que
 * decide o que a tela de retorno diz ao usuário depois de pagar.
 */
export async function existingExternalRefs(refs: string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coin_transactions")
    .select("external_ref")
    .in("external_ref", refs);
  if (error) throw new Error(`existingExternalRefs failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.external_ref as string));
}

/**
 * Estorno de crédito após refund ou chargeback. `refPrefix` identifica a
 * origem do crédito no ledger ('invoice:in_xxx:' ou 'checkout:cs_xxx:').
 *
 * Nunca deixa o saldo negativo: se a pessoa já gastou tudo, deduzimos o que
 * houver e o resto vira prejuízo — mas prejuízo LOGADO, que é o ponto. O
 * caminho silencioso (não estornar nada) é o que transforma chargeback em
 * modelo de negócio para quem abusa.
 */
export async function clawbackCoins(args: {
  userId: string;
  refPrefix: string;
  reason: "refund" | "chargeback";
}): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("clawback_coins", {
    p_user_id: args.userId,
    p_ref_prefix: args.refPrefix,
    p_reason: args.reason,
  });
  if (error) {
    console.error("[billing] clawback_coins failed", {
      userId: args.userId,
      refPrefix: args.refPrefix,
      error: error.message,
    });
    return null;
  }
  return typeof data === "number" ? data : Number(data);
}

/**
 * Trava de idempotência de evento. Retorna `true` na PRIMEIRA vez que este
 * event id aparece e `false` em qualquer reentrega. A PK da tabela é o id do
 * evento, então duas entregas concorrentes disputam o insert e só uma vence —
 * não dá para creditar duas vezes nem com paralelismo.
 */
export async function claimStripeEvent(eventId: string, type: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_events").insert({ id: eventId, type });
  if (!error) return true;
  // 23505 = unique_violation → já processado.
  if ((error as { code?: string }).code === "23505") return false;
  throw new Error(`claimStripeEvent failed: ${error.message}`);
}

/**
 * Desfaz a trava quando o processamento explode DEPOIS do claim. Sem isto, um
 * erro transitório (ex.: Supabase fora do ar no meio do handler) faria a
 * reentrega do Stripe ser descartada como duplicata e o crédito se perderia
 * de vez.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_events").delete().eq("id", eventId);
  if (error) {
    console.error("[billing] releaseStripeEvent failed", { eventId, error: error.message });
  }
}
