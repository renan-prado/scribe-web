import { NextResponse } from "next/server";
import type { BillingSummary } from "@/lib/billing/plans";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { lazySubscriptionCheck, subscriptionLooksStale } from "@/lib/billing/sweep";
import { getOwnSubscription } from "@/lib/db/billing";
import { getCurrentBalance } from "@/lib/db/coins";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado de cobrança do usuário: plano, status, saldo e se o servidor tem
 * Stripe configurado. Alimenta o diálogo de moedas e o card do /profile.
 *
 * Traz embutida a verificação PREGUIÇOSA de renovação: se a assinatura se diz
 * viva mas o período que conhecemos já venceu, ou a renovação aconteceu e o
 * webhook perdeu (crédito faltando), ou ela foi cancelada e o espelho está
 * mentindo. Este endpoint é aberto exatamente quando o usuário estranha o
 * saldo — o melhor momento possível para conferir no Stripe e se curar.
 * Cooldown de 15 min por usuário; no regime normal (webhook saudável) o
 * período nunca está vencido e nada disso roda.
 *
 * Continua sendo leitura da PRÓPRIA conta: o único "efeito" possível é
 * creditar dinheiro comprovadamente pago pelo próprio dono, via o mesmo
 * `fulfill.ts` idempotente de sempre.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["billing-read"], auth.user.id);
  if (limited) return limited;

  let subscription = await getOwnSubscription().catch(() => null);

  const stripe = getStripe();
  if (stripe && subscription?.stripeSubscriptionId && subscriptionLooksStale(subscription)) {
    await lazySubscriptionCheck(stripe, auth.user.id, subscription.stripeSubscriptionId);
    // O check pode ter mudado plano/status/period_end — relê o espelho.
    subscription = await getOwnSubscription().catch(() => subscription);
  }

  const balance = await getCurrentBalance().catch(() => null);

  const body: BillingSummary = {
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "inactive",
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    balance: balance ?? 0,
    configured: isBillingConfigured(),
  };

  return NextResponse.json(body);
}
