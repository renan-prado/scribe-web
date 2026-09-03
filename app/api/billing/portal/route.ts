import { NextResponse } from "next/server";
import { appUrl, getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { getStripeCustomerId } from "@/lib/db/billing";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("billing/portal");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * URL do portal de faturamento do Stripe — onde o usuário troca de plano,
 * atualiza o cartão, baixa recibos e cancela.
 *
 * Não recebe corpo nenhum. O customer é lido do profiles do usuário
 * autenticado, então não há como pedir o portal de outra conta: enviar um id
 * qualquer não muda nada porque nada é lido do request.
 *
 * Toda mudança feita lá dentro volta para nós como webhook assinado — a UI
 * nunca "acredita" no que aconteceu no portal.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["billing-write"], auth.user.id);
  if (limited) return limited;

  const stripe = getStripe();
  if (!stripe || !isBillingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const customerId = await getStripeCustomerId(auth.user.id).catch(() => null);
  if (!customerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/profile"),
      locale: "pt-BR",
    });
    log.info("session", { userId: auth.user.id });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error("stripe error", { error: (err as Error).message });
    return NextResponse.json({ error: "portal_failed" }, { status: 502 });
  }
}
