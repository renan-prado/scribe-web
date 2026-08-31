import "server-only";
import type Stripe from "stripe";
import { entitlementForPrice } from "@/lib/billing/catalog";
import { isPlanKey, type PlanKey, TOPUP_MAX_QUANTITY } from "@/lib/billing/plans";
import { customerIdOf, priceIdOf, subscriptionPeriodEnd } from "@/lib/billing/stripe";
import { existingExternalRefs, grantCoins, upsertSubscription } from "@/lib/db/billing";

/**
 * O núcleo do crédito: dado um pagamento que o Stripe confirma como pago,
 * quantas moedas ele vale e para quem.
 *
 * Vive aqui, e não dentro da rota do webhook, porque DOIS caminhos precisam
 * dele e precisam concordar byte a byte:
 *
 *   1. o webhook (`/api/stripe/webhook`), o caminho normal;
 *   2. a reconciliação (`/api/billing/reconcile`), o caminho de recuperação
 *      para quando o webhook não chega — listener fora do ar em dev, deploy
 *      no meio do pagamento, retries esgotados em produção.
 *
 * Se essas duas cópias divergissem, um dos caminhos creditaria valores
 * diferentes do outro para o mesmo dinheiro. Uma implementação só elimina a
 * classe inteira desse bug.
 *
 * As três invariantes de segurança valem igual nos dois caminhos:
 *  - O VALOR vem de `entitlementForPrice(priceId)`, o catálogo server-only.
 *    Preço desconhecido credita ZERO, nunca "o que o metadata disser".
 *  - A QUANTIDADE vem do que o Stripe reporta como pago, clampeada.
 *  - A IDEMPOTÊNCIA vem do `external_ref` UNIQUE. É ele que torna seguro
 *    rodar webhook e reconciliação sobre o mesmo pagamento: o segundo a
 *    chegar não credita nada.
 */

/**
 * Quem está pedindo o crédito/sync — só para os logs contarem a história
 * certa. Hoje são cinco origens: o webhook (caminho normal), a reconciliação
 * da página de retorno, o guard anti-dupla do checkout, o check preguiçoso do
 * resumo de cobrança e a varredura periódica do cron.
 */
export type FulfillSource = "webhook" | "reconcile" | "checkout-guard" | "summary" | "sweep";

export type FulfillResult = {
  /** Moedas efetivamente creditadas nesta chamada (0 se já estava creditado). */
  credited: number;
  /** Saldo após a operação, ou null se nada foi tocado. */
  balance: number | null;
};

type LineLike = {
  quantity?: number | null;
  priceId: string | null;
  /** Identificador estável da linha, usado no external_ref. */
  lineId: string;
};

/**
 * Normaliza as linhas de uma fatura. Na API atual o preço vive em
 * `pricing.price_details.price`; versões anteriores expunham `line.price`.
 * Lemos as duas formas para que uma atualização de API não interrompa
 * silenciosamente os créditos — um crédito que para de acontecer sem erro é
 * exatamente o tipo de falha que ninguém percebe.
 */
export function invoiceLines(invoice: Stripe.Invoice): LineLike[] {
  const lines = invoice.lines?.data ?? [];
  return lines.map((line) => {
    const loose = line as unknown as {
      price?: { id?: string } | string | null;
      pricing?: { price_details?: { price?: string | { id?: string } | null } | null } | null;
    };
    const fromPricing = loose.pricing?.price_details?.price ?? null;
    const priceId = priceIdOf(fromPricing) ?? priceIdOf(loose.price ?? null);
    return { quantity: line.quantity, priceId, lineId: line.id };
  });
}

/** Motivos de fatura que representam uma recarga da franquia mensal. */
const GRANTING_BILLING_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
]);

/** True quando esta fatura deve gerar recarga (paga, com dinheiro, do ciclo). */
export function invoiceShouldGrant(invoice: Stripe.Invoice): boolean {
  if (!GRANTING_BILLING_REASONS.has(invoice.billing_reason ?? "")) return false;
  // Fatura de R$ 0 (proração para baixo, cupom de 100%): não houve dinheiro,
  // não há recarga.
  return (invoice.amount_paid ?? 0) > 0;
}

/**
 * Credita as linhas de assinatura de uma fatura paga.
 * Lança se a RPC falhar — o chamador decide se devolve 5xx (webhook, para o
 * Stripe reentregar) ou um erro ao usuário (reconciliação).
 */
export async function creditInvoice(
  invoice: Stripe.Invoice,
  userId: string,
  source: FulfillSource
): Promise<FulfillResult> {
  const planned: Array<{ externalRef: string; amount: number; plan: string }> = [];

  for (const line of invoiceLines(invoice)) {
    const entitlement = entitlementForPrice(line.priceId);
    if (!entitlement) {
      console.warn(`[billing:${source}] unknown price on paid invoice — nothing credited`, {
        invoice: invoice.id,
        priceId: line.priceId,
      });
      continue;
    }
    if (entitlement.kind !== "subscription") continue;

    // Quantidade de assinatura é 1 na prática; clampeamos para que um dado
    // estranho não vire um crédito enorme.
    const quantity = Math.min(Math.max(1, line.quantity ?? 1), 5);
    planned.push({
      externalRef: `invoice:${invoice.id}:${line.lineId}`,
      amount: entitlement.coinsPerUnit * quantity,
      plan: entitlement.plan,
    });
  }

  const already = await existingExternalRefs(planned.map((p) => p.externalRef));
  let credited = 0;
  let balance: number | null = null;

  for (const p of planned) {
    const isNew = !already.has(p.externalRef);
    const next = await grantCoins({
      userId,
      amount: p.amount,
      reason: "subscription_grant",
      externalRef: p.externalRef,
    });
    if (next === null) throw new Error(`grant_coins failed for ${p.externalRef}`);
    balance = next;
    if (isNew) {
      credited += p.amount;
      console.info(`[billing:${source}] subscription credited`, {
        userId,
        plan: p.plan,
        amount: p.amount,
        balance,
        invoice: invoice.id,
      });
    }
  }

  return { credited, balance };
}

/** Deriva a chave de plano a partir dos preços dos itens da assinatura. */
export function planFromSubscription(subscription: Stripe.Subscription): PlanKey {
  for (const item of subscription.items?.data ?? []) {
    const entitlement = entitlementForPrice(priceIdOf(item.price ?? null));
    if (entitlement?.kind === "subscription") return entitlement.plan;
  }
  // Fallback só para telemetria; nunca gera crédito.
  const meta = subscription.metadata?.plan;
  return isPlanKey(meta) ? meta : "free";
}

/**
 * Espelha o estado de uma assinatura do Stripe na tabela local.
 *
 * Compartilhado entre webhook e reconciliação pelo mesmo motivo do crédito:
 * a tabela `subscriptions` alimenta o guard anti-cobrança-dupla do checkout e
 * o plano mostrado na UI. Se só o webhook a escrevesse, um evento perdido
 * deixaria o usuário pagante marcado como "free" — e o checkout deixaria ele
 * assinar DE NOVO, cobrando duas mensalidades. A reconciliação, ao creditar,
 * também cura o espelho.
 *
 * O chamador deve passar uma assinatura RECÉM-BUSCADA na API sempre que
 * possível (não o payload de um evento): o Stripe não garante ordem de
 * entrega, e um `subscription.updated` atrasado carregando estado velho
 * sobrescreveria estado novo. A API devolve sempre o presente.
 */
export async function syncSubscriptionState(
  subscription: Stripe.Subscription,
  userId: string,
  source: FulfillSource
): Promise<void> {
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) return;

  const canceled = subscription.status === "canceled";
  await upsertSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    // Cancelada volta a 'free' na nossa tabela; o SALDO permanece intacto —
    // o modelo acordado é "gasta o que tem, só não recarrega mais".
    plan: canceled ? "free" : planFromSubscription(subscription),
    status: subscription.status,
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });

  console.info(`[billing:${source}] subscription synced`, {
    userId,
    status: subscription.status,
    subscription: subscription.id,
  });
}

/**
 * Credita os pacotes avulsos de uma sessão de checkout paga.
 *
 * As linhas são buscadas na API do Stripe, nunca lidas de um payload: é a
 * fonte mais confiável do que foi de fato comprado.
 */
export async function creditCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  userId: string,
  source: FulfillSource
): Promise<FulfillResult> {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  const planned: Array<{ externalRef: string; amount: number; quantity: number }> = [];

  for (const item of lineItems.data) {
    const entitlement = entitlementForPrice(priceIdOf(item.price ?? null));
    if (entitlement?.kind !== "topup") {
      console.warn(`[billing:${source}] unknown price on paid checkout — nothing credited`, {
        session: session.id,
        priceId: priceIdOf(item.price ?? null),
      });
      continue;
    }
    const quantity = Math.min(Math.max(1, item.quantity ?? 1), TOPUP_MAX_QUANTITY);
    planned.push({
      externalRef: `checkout:${session.id}:${item.id}`,
      amount: entitlement.coinsPerUnit * quantity,
      quantity,
    });
  }

  // Consultar o ledger ANTES é o que distingue "creditei agora" de "o outro
  // caminho já tinha creditado" — `grant_coins` devolve o saldo nos dois casos.
  const already = await existingExternalRefs(planned.map((p) => p.externalRef));
  let credited = 0;
  let balance: number | null = null;

  for (const p of planned) {
    const isNew = !already.has(p.externalRef);
    const next = await grantCoins({
      userId,
      amount: p.amount,
      reason: "topup_pack",
      externalRef: p.externalRef,
    });
    if (next === null) throw new Error(`grant_coins failed for ${p.externalRef}`);
    balance = next;
    if (isNew) {
      credited += p.amount;
      console.info(`[billing:${source}] topup credited`, {
        userId,
        amount: p.amount,
        quantity: p.quantity,
        balance,
        session: session.id,
      });
    }
  }

  return { credited, balance };
}
