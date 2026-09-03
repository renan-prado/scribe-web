import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { clampTopupQuantity, priceIdForPlan, priceIdForTopup } from "@/lib/billing/catalog";
import { getOrCreateCustomer } from "@/lib/billing/customer";
import { syncSubscriptionState } from "@/lib/billing/fulfill";
import { PAID_PLAN_KEYS, TOPUP_MAX_QUANTITY } from "@/lib/billing/plans";
import { appUrl, getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { getOwnSubscription } from "@/lib/db/billing";
import { getCurrentProfile } from "@/lib/db/profiles";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("billing/checkout");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre uma sessão de Stripe Checkout e devolve a URL hospedada.
 *
 * O corpo aceito é o MÍNIMO possível — uma chave de plano, ou o pacote avulso
 * com uma quantidade. Repare no que ele NÃO aceita: preço, moeda, quantidade
 * de créditos, id de customer, id de price. Tudo isso o servidor resolve:
 *
 *   plano/pacote  →  Price ID (env, via lib/billing/catalog)
 *   Price ID      →  valor cobrado (definido no dashboard do Stripe)
 *   Price pago    →  moedas creditadas (webhook, via mesmo catálogo)
 *
 * Ou seja: nem o valor nem o crédito passam pelo navegador em nenhum momento.
 * O retorno é só uma URL do domínio do Stripe.
 *
 * Também não creditamos nada no `success_url`. Ele é puramente cosmético — a
 * pessoa pode forjar `?checkout=success` à vontade que não acontece nada. O
 * crédito só existe depois de um evento assinado chegar em
 * POST /api/stripe/webhook.
 */

const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("subscription"), plan: z.enum(PAID_PLAN_KEYS) }).strict(),
  z
    .object({
      kind: z.literal("topup"),
      quantity: z.number().int().min(1).max(TOPUP_MAX_QUANTITY).optional(),
    })
    .strict(),
]);

/** Para onde o Stripe manda o usuário de volta. `returnPath` vem de um
 * allowlist implícito: só usamos caminhos do próprio app, montados aqui. */
function urls(kind: "subscription" | "topup") {
  return {
    // `{CHECKOUT_SESSION_ID}` é substituído pelo Stripe no redirect. A tela de
    // retorno usa esse id para pedir a reconciliação — que confere a sessão
    // direto na API do Stripe e credita se o webhook não tiver creditado.
    // O id sozinho não autoriza nada: /api/billing/reconcile recusa qualquer
    // sessão cujo customer não seja o do usuário autenticado.
    success: appUrl(`/billing/retorno?status=sucesso&tipo=${kind}&cs={CHECKOUT_SESSION_ID}`),
    cancel: appUrl("/billing/retorno?status=cancelado"),
  };
}

/**
 * Confere que o Price apontado pela env var é do tipo certo ANTES de abrir o
 * checkout.
 *
 * Existe porque a confusão é fácil de cometer e difícil de diagnosticar: criar
 * o pacote avulso como preço recorrente (ou o plano como preço único) faz o
 * Stripe responder um erro genérico de API, que virava "não consegui abrir o
 * pagamento" na tela — sem dizer o que consertar. Pior: o erro só aparece na
 * primeira compra, e reaparece quando os produtos são recriados em modo live.
 *
 * Custa uma chamada extra ao Stripe por clique em comprar — barato para um
 * gesto explícito do usuário, e a mensagem que sai do outro lado diz
 * exatamente qual variável está apontando para o preço errado.
 */
async function assertPriceShape(
  stripe: Stripe,
  priceId: string,
  expected: "recurring" | "one_time",
  envVar: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (err) {
    log.error("price not found", {
      envVar,
      priceId,
      error: (err as Error).message,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "price_misconfigured" }, { status: 503 }),
    };
  }

  if (!price.active) {
    log.error(`${envVar} points to an ARCHIVED price`, { priceId });
    return {
      ok: false,
      response: NextResponse.json({ error: "price_misconfigured" }, { status: 503 }),
    };
  }

  const actual = price.recurring ? "recurring" : "one_time";
  if (actual !== expected) {
    log.error(
      `${envVar} points to a ${actual} price but a ${expected} price is required.` +
        (expected === "one_time"
          ? " Crie um preço com cobrança ÚNICA no produto de créditos avulsos e aponte a variável para o novo price_..."
          : " Crie um preço RECORRENTE mensal no produto do plano e aponte a variável para o novo price_..."),
      { priceId }
    );
    return {
      ok: false,
      response: NextResponse.json({ error: "price_misconfigured" }, { status: 503 }),
    };
  }

  return { ok: true };
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["billing-write"], auth.user.id);
  if (limited) return limited;

  const stripe = getStripe();
  if (!stripe || !isBillingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const profile = await getCurrentProfile().catch(() => null);

  let customerId: string;
  try {
    customerId = await getOrCreateCustomer({
      stripe,
      userId: auth.user.id,
      email: profile?.email ?? null,
      name: profile?.displayName ?? null,
    });
  } catch (err) {
    log.error("customer failed", { error: (err as Error).message });
    return NextResponse.json({ error: "customer_failed" }, { status: 502 });
  }

  try {
    if (body.kind === "subscription") {
      const priceId = priceIdForPlan(body.plan);
      if (!priceId) {
        log.error("missing price id for plan", { plan: body.plan });
        return NextResponse.json({ error: "plan_unavailable" }, { status: 503 });
      }

      // Já assinante: o Checkout criaria uma SEGUNDA assinatura e cobraria
      // duas vezes. Trocar de plano é trabalho do portal de faturamento.
      const current = await getOwnSubscription().catch(() => null);
      if (current?.stripeSubscriptionId && current.status !== "canceled") {
        return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
      }

      // O espelho local disse "sem assinatura" — mas ele pode estar defasado
      // (webhook perdido). A conferência final é com quem tem a verdade: se o
      // Stripe conhece uma assinatura viva deste customer, bloqueia a segunda
      // cobrança E cura o espelho no caminho. `incomplete` fica de fora de
      // propósito: é um primeiro pagamento abandonado no meio, e bloquear por
      // ele trancaria o usuário fora de uma nova tentativa até ela expirar.
      const BLOCKING_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const live = existing.data.find((sub) => BLOCKING_STATUSES.has(sub.status));
      if (live) {
        log.warn("local mirror was stale — healing and blocking", {
          userId: auth.user.id,
          subscription: live.id,
          status: live.status,
        });
        await syncSubscriptionState(live, auth.user.id, "checkout-guard").catch(() => undefined);
        return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
      }

      const shape = await assertPriceShape(
        stripe,
        priceId,
        "recurring",
        body.plan === "pessoal" ? "STRIPE_PRICE_PESSOAL" : "STRIPE_PRICE_ESTUDIOSO"
      );
      if (!shape.ok) return shape.response;

      const { success, cancel } = urls("subscription");
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: success,
          cancel_url: cancel,
          locale: "pt-BR",
          allow_promotion_codes: true,
          // Redundância para o webhook: a fonte de verdade continua sendo o
          // customer, mas isto ajuda a diagnosticar um vínculo quebrado.
          client_reference_id: auth.user.id,
          metadata: { userId: auth.user.id, plan: body.plan },
          subscription_data: { metadata: { userId: auth.user.id, plan: body.plan } },
        },
        // Chave de idempotência por (usuário, plano, minuto): dois cliques
        // rápidos no botão reaproveitam a mesma sessão em vez de abrirem duas.
        { idempotencyKey: `sub:${auth.user.id}:${body.plan}:${Math.floor(Date.now() / 60_000)}` }
      );

      log.info("subscription session", {
        userId: auth.user.id,
        plan: body.plan,
        sessionId: session.id,
      });
      return NextResponse.json({ url: session.url });
    }

    // ---- pacote avulso -----------------------------------------------------
    const priceId = priceIdForTopup();
    if (!priceId) {
      log.error("missing topup price id");
      return NextResponse.json({ error: "topup_unavailable" }, { status: 503 });
    }

    // Reaplica o clamp mesmo com o Zod já tendo validado: o valor final que
    // vale é este, e ele é conferido de novo no webhook contra a quantidade
    // que o Stripe reportar como paga.
    const shape = await assertPriceShape(stripe, priceId, "one_time", "STRIPE_PRICE_TOPUP_500");
    if (!shape.ok) return shape.response;

    const quantity = clampTopupQuantity(body.quantity ?? 1);
    const { success, cancel } = urls("topup");

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [{ price: priceId, quantity }],
        success_url: success,
        cancel_url: cancel,
        locale: "pt-BR",
        client_reference_id: auth.user.id,
        metadata: { userId: auth.user.id, pack: "topup500" },
        payment_intent_data: { metadata: { userId: auth.user.id } },
      },
      {
        idempotencyKey: `top:${auth.user.id}:${quantity}:${Math.floor(Date.now() / 60_000)}`,
      }
    );

    log.info("topup session", {
      userId: auth.user.id,
      quantity,
      sessionId: session.id,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = (err as Error).message;
    // "No valid payment method types" quase nunca é bug de código: é a conta
    // do Stripe ainda sem poder cobrar (em análise ou com dados pendentes), ou
    // sem nenhum método ligado para a moeda. Sem esta dica, o rastro é um 502
    // genérico e horas de caça ao erro errado.
    if (message.includes("payment method types")) {
      log.error(
        "a conta do Stripe não tem método de pagamento disponível para esta moeda. " +
          "Rode `node scripts/stripe-doctor.mjs` — em geral é `charges_enabled: false` " +
          "(conta em análise ou com dados pendentes) ou nenhum método ligado em " +
          "dashboard.stripe.com/settings/payment_methods.",
        { error: message }
      );
      return NextResponse.json({ error: "payment_methods_unavailable" }, { status: 503 });
    }
    log.error("stripe error", { error: message });
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
