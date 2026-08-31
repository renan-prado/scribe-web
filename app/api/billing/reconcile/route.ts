import { NextResponse } from "next/server";
import { z } from "zod";
import {
  creditCheckoutSession,
  creditInvoice,
  invoiceShouldGrant,
  syncSubscriptionState,
} from "@/lib/billing/fulfill";
import { customerIdOf, getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { getStripeCustomerId } from "@/lib/db/billing";
import { parseJsonBody } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rede de segurança do crédito: confirma uma sessão de checkout DIRETO com o
 * Stripe e credita se o webhook ainda não creditou.
 *
 * POR QUE EXISTE. O webhook é o caminho normal, mas é um caminho que pode
 * falhar em silêncio — o listener fora do ar em desenvolvimento, um deploy no
 * meio do pagamento, o endpoint respondendo 5xx até o Stripe esgotar os
 * retries. Em todos esses casos o dinheiro sai da conta do usuário e o crédito
 * não entra, sem erro em lugar nenhum. Um segundo caminho, disparado no
 * retorno do Checkout, transforma a falha silenciosa em recuperação
 * automática.
 *
 * POR QUE ISSO NÃO ABRE UM BURACO. É a pergunta certa: uma rota que credita
 * moedas e recebe um id do cliente parece exatamente o que não devíamos ter.
 * As defesas:
 *
 *  1. O id só endereça, nunca autoriza. A sessão é buscada na API do Stripe;
 *     nada do corpo do request é usado como fato.
 *  2. DONO CONFERIDO. O `customer` da sessão precisa bater com o
 *     `stripe_customer_id` gravado no perfil de quem está autenticado. Pegar o
 *     `cs_...` de outra pessoa (do log, do histórico do navegador) devolve 403
 *     e não credita nada para ninguém.
 *  3. PAGAMENTO CONFERIDO. Só `payment_status === "paid"` (ou fatura de
 *     assinatura efetivamente liquidada) segue adiante.
 *  4. VALOR DERIVADO. As moedas saem de `entitlementForPrice`, o mesmo
 *     catálogo server-only do webhook — via `lib/billing/fulfill`, que é
 *     literalmente o mesmo código.
 *  5. IDEMPOTÊNCIA. O `external_ref` UNIQUE é compartilhado com o webhook.
 *     Rodar os dois sobre o mesmo pagamento credita uma vez só; chamar esta
 *     rota mil vezes credita uma vez só.
 *
 * Ou seja: o pior que alguém consegue fazendo força bruta em ids de sessão é
 * gastar o próprio rate limit.
 */

const BodySchema = z
  .object({
    // Ids de sessão do Stripe: cs_test_… / cs_live_…
    sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{8,120}$/, "invalid_session_id"),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["billing-reconcile"], auth.user.id);
  if (limited) return limited;

  const stripe = getStripe();
  if (!stripe || !isBillingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId } = parsed.data;

  const ownCustomerId = await getStripeCustomerId(auth.user.id).catch(() => null);
  if (!ownCustomerId) {
    // Nunca comprou nada: não há sessão que possa ser dele.
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.warn("[billing/reconcile] session not found", {
      sessionId,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // Defesa 2: a sessão tem de ser DESTE usuário.
  const sessionCustomer = customerIdOf(session.customer);
  if (!sessionCustomer || sessionCustomer !== ownCustomerId) {
    console.warn("[billing/reconcile] session does not belong to caller", {
      userId: auth.user.id,
      sessionId,
      sessionCustomer,
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    if (session.mode === "payment") {
      if (session.payment_status !== "paid") {
        return NextResponse.json({ credited: 0, pending: true });
      }
      const result = await creditCheckoutSession(stripe, session, auth.user.id, "reconcile");
      if (result.credited > 0) {
        console.warn("[billing/reconcile] recovered a payment the webhook had not credited", {
          userId: auth.user.id,
          sessionId,
          credited: result.credited,
        });
      }
      devLog("[billing/reconcile] topup", { sessionId, credited: result.credited });
      return NextResponse.json({ credited: result.credited, balance: result.balance });
    }

    if (session.mode === "subscription") {
      // Em assinatura o crédito nasce da FATURA, não da sessão — então
      // buscamos a fatura mais recente da assinatura criada por este checkout.
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      if (!subscriptionId) {
        return NextResponse.json({ credited: 0, pending: true });
      }

      // Curar o espelho vem ANTES de creditar, e não é cosmético: a tabela
      // `subscriptions` alimenta o guard anti-cobrança-dupla do checkout e o
      // plano exibido na UI. Se o webhook perdeu o subscription.created e a
      // reconciliação creditasse sem sincronizar, o usuário pagante ficaria
      // marcado como "free" — e o checkout deixaria ele assinar DE NOVO.
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionState(subscription, auth.user.id, "reconcile");
      } catch (err) {
        console.warn("[billing/reconcile] subscription sync failed", {
          subscriptionId,
          error: (err as Error).message,
        });
      }

      const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 3 });
      let credited = 0;
      let balance: number | null = null;

      for (const invoice of invoices.data) {
        if (invoice.status !== "paid" || !invoiceShouldGrant(invoice)) continue;
        const result = await creditInvoice(invoice, auth.user.id, "reconcile");
        credited += result.credited;
        balance = result.balance ?? balance;
      }

      if (credited > 0) {
        console.warn("[billing/reconcile] recovered a subscription grant the webhook had missed", {
          userId: auth.user.id,
          subscriptionId,
          credited,
        });
      }
      devLog("[billing/reconcile] subscription", { subscriptionId, credited });
      return NextResponse.json({ credited, balance, pending: credited === 0 });
    }

    return NextResponse.json({ credited: 0 });
  } catch (err) {
    console.error("[billing/reconcile] failed", {
      sessionId,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}
