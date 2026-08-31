import "server-only";
import type Stripe from "stripe";
import {
  creditCheckoutSession,
  creditInvoice,
  type FulfillSource,
  invoiceShouldGrant,
  syncSubscriptionState,
} from "@/lib/billing/fulfill";
import { customerIdOf } from "@/lib/billing/stripe";
import { findUserIdByCustomerId, type SubscriptionRecord } from "@/lib/db/billing";

/**
 * As duas verificações "de tempos em tempos" do faturamento.
 *
 * O sistema tem três linhas de defesa para o mesmo dinheiro, em ordem de
 * latência:
 *
 *   1. WEBHOOK — segundos. O caminho normal.
 *   2. RECONCILIAÇÃO no retorno do checkout — segundos, mas depende de o
 *      usuário voltar para a aba. Cobre compras; NÃO cobre renovações
 *      mensais, que não têm página de retorno.
 *   3. ESTE ARQUIVO — minutos a um dia. Cobre o que sobrou: renovações cujo
 *      webhook falhou, compras cuja aba de retorno nunca carregou, espelho de
 *      assinatura defasado.
 *
 * Tudo aqui é seguro de rodar quantas vezes for: o crédito passa pelo mesmo
 * `fulfill.ts` de sempre, e o `external_ref` UNIQUE faz repetição virar no-op.
 * O custo de uma passada em falso é só algumas chamadas de leitura ao Stripe.
 */

// ---------------------------------------------------------------------------
// Camada preguiçosa (por usuário, no read do resumo de cobrança)
// ---------------------------------------------------------------------------

/**
 * Cooldown em memória por usuário. Em serverless cada instância tem o seu —
 * está ótimo assim: é uma economia de chamadas ao Stripe, não uma trava de
 * correção (a correção vem da idempotência). 15 min segura o caso patológico
 * de uma assinatura past_due com period_end no passado, que sem isto
 * dispararia uma busca no Stripe a cada abertura do diálogo de moedas.
 */
const lazyCheckAt = new Map<string, number>();
const LAZY_COOLDOWN_MS = 15 * 60_000;

/** Margem sobre o period_end antes de considerar o espelho "vencido". Faturas
 * de renovação levam alguns minutos entre gerar e liquidar; sem folga, todo
 * usuário que abrisse o diálogo NO minuto da virada dispararia uma busca. */
const PERIOD_END_SLACK_MS = 10 * 60_000;

const ACTIVEISH = new Set(["active", "trialing", "past_due"]);

/**
 * True quando vale a pena conferir esta assinatura no Stripe: ela se diz viva,
 * mas o período que conhecemos já acabou — ou a renovação aconteceu e o
 * webhook perdeu (crédito faltando!), ou ela foi cancelada e o webhook perdeu
 * (espelho mentindo "renova em..."). Nos dois casos a resposta está no Stripe.
 */
export function subscriptionLooksStale(sub: SubscriptionRecord | null): boolean {
  if (!sub?.stripeSubscriptionId) return false;
  if (!ACTIVEISH.has(sub.status)) return false;
  if (!sub.currentPeriodEnd) return false;
  return Date.now() - new Date(sub.currentPeriodEnd).getTime() > PERIOD_END_SLACK_MS;
}

/**
 * Confere uma assinatura vencida direto no Stripe: ressincroniza o espelho e
 * credita faturas pagas que ainda não estejam no ledger. Melhor-esforço — um
 * erro aqui nunca deve derrubar o read que a disparou.
 *
 * Retorna quantas moedas foram recuperadas (0 no caso normal).
 */
export async function lazySubscriptionCheck(
  stripe: Stripe,
  userId: string,
  subscriptionId: string
): Promise<number> {
  const last = lazyCheckAt.get(userId) ?? 0;
  if (Date.now() - last < LAZY_COOLDOWN_MS) return 0;
  lazyCheckAt.set(userId, Date.now());
  // O Map cresce um item por usuário ativo; poda barata para não vazar.
  if (lazyCheckAt.size > 10_000) {
    const cutoff = Date.now() - LAZY_COOLDOWN_MS;
    for (const [k, v] of lazyCheckAt) if (v < cutoff) lazyCheckAt.delete(k);
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionState(subscription, userId, "summary");

    let credited = 0;
    if (subscription.status !== "canceled") {
      const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 3 });
      for (const invoice of invoices.data) {
        if (invoice.status !== "paid" || !invoiceShouldGrant(invoice)) continue;
        const result = await creditInvoice(invoice, userId, "summary");
        credited += result.credited;
      }
    }

    if (credited > 0) {
      console.warn("[billing:summary] recovered a renewal the webhook had missed", {
        userId,
        subscriptionId,
        credited,
      });
    }
    return credited;
  } catch (err) {
    console.warn("[billing:summary] lazy subscription check failed", {
      subscriptionId,
      error: (err as Error).message,
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Camada periódica (global, cron)
// ---------------------------------------------------------------------------

export type SweepReport = {
  windowHours: number;
  checkoutSessionsSeen: number;
  invoicesSeen: number;
  /** Moedas creditadas nesta passada — no regime normal, sempre 0. */
  coinsRecovered: number;
  /** Pagamentos de dono desconhecido — exigem olhar humano. */
  unresolved: string[];
};

/**
 * Varre os pagamentos recentes no Stripe e credita qualquer um que não esteja
 * no ledger. É a rede final: pega renovações perdidas, compras cuja aba de
 * retorno nunca abriu, e qualquer coisa que os caminhos rápidos deixaram cair.
 *
 * `coinsRecovered > 0` numa passada é sinal de incidente nas outras camadas —
 * o valor é logado em `warn` de propósito para não passar batido.
 */
export async function sweepRecentPayments(
  stripe: Stripe,
  windowHours: number,
  source: FulfillSource = "sweep"
): Promise<SweepReport> {
  const gte = Math.floor(Date.now() / 1000) - windowHours * 3600;
  const report: SweepReport = {
    windowHours,
    checkoutSessionsSeen: 0,
    invoicesSeen: 0,
    coinsRecovered: 0,
    unresolved: [],
  };

  // Compras avulsas -----------------------------------------------------------
  const sessions = await stripe.checkout.sessions.list({ created: { gte }, limit: 100 });
  for (const session of sessions.data) {
    if (session.mode !== "payment" || session.payment_status !== "paid") continue;
    report.checkoutSessionsSeen += 1;

    const customerId = customerIdOf(session.customer);
    const userId = customerId ? await findUserIdByCustomerId(customerId) : null;
    if (!userId) {
      report.unresolved.push(`session:${session.id}`);
      continue;
    }
    const result = await creditCheckoutSession(stripe, session, userId, source);
    report.coinsRecovered += result.credited;
  }

  // Faturas de assinatura -----------------------------------------------------
  const invoices = await stripe.invoices.list({ created: { gte }, limit: 100 });
  for (const invoice of invoices.data) {
    if (invoice.status !== "paid" || !invoiceShouldGrant(invoice)) continue;
    report.invoicesSeen += 1;

    const customerId = customerIdOf(invoice.customer);
    const userId = customerId ? await findUserIdByCustomerId(customerId) : null;
    if (!userId) {
      report.unresolved.push(`invoice:${invoice.id}`);
      continue;
    }
    const result = await creditInvoice(invoice, userId, source);
    report.coinsRecovered += result.credited;
  }

  const level = report.coinsRecovered > 0 || report.unresolved.length > 0 ? "warn" : "info";
  console[level]("[billing:sweep] pass complete", report);
  return report;
}
