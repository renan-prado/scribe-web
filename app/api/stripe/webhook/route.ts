import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  creditCheckoutSession,
  creditInvoice,
  invoiceShouldGrant,
  syncSubscriptionState,
} from "@/lib/billing/fulfill";
import { customerIdOf, getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import {
  claimStripeEvent,
  clawbackCoins,
  findUserIdByCustomerId,
  releaseStripeEvent,
} from "@/lib/db/billing";
import { reverseCommissionForUser } from "@/lib/db/partners";
import { serverEnv } from "@/lib/env/server";
import { createLogger } from "@/lib/log";

const log = createLogger("stripe/webhook");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Stripe — o ÚNICO lugar do sistema que credita moedas.
 *
 * Rota pública por necessidade (o Stripe não tem cookie de sessão). Ela está
 * na allowlist do proxy.ts; sem isso o Next redirecionaria para /sign-in e
 * toda entrega falharia. Como é pública, cada uma das defesas abaixo importa:
 *
 * 1. ASSINATURA. `constructEventAsync` sobre o corpo CRU + o header
 *    `stripe-signature` + o `STRIPE_WEBHOOK_SECRET`. Sem isso, qualquer pessoa
 *    poderia dar POST num JSON de "pagamento aprovado". Nada é lido do corpo
 *    antes da verificação passar.
 * 2. IDEMPOTÊNCIA DE EVENTO. `claimStripeEvent` insere o id do evento numa
 *    tabela com PK — a reentrega (que o Stripe faz de propósito, e um atacante
 *    poderia tentar replicar reenviando um payload assinado legítimo) sai como
 *    duplicata e não credita.
 * 3. IDEMPOTÊNCIA DE CRÉDITO. Cada lançamento carrega um `external_ref` UNIQUE
 *    derivado da linha de fatura / sessão de checkout. Mesmo que dois eventos
 *    DIFERENTES apontem para o mesmo dinheiro, o crédito acontece uma vez.
 * 4. VALOR DERIVADO, NUNCA RECEBIDO. Quantas moedas creditar sai de
 *    `entitlementForPrice(priceId)` — o catálogo server-only. O `metadata` do
 *    evento é usado só para diagnóstico. Um Price desconhecido credita ZERO.
 * 5. DONO DERIVADO, NUNCA RECEBIDO. A quem creditar sai de
 *    `findUserIdByCustomerId(customer)`, isto é, do vínculo que NÓS gravamos
 *    quando o usuário autenticado criou o customer.
 * 6. SÓ DINHEIRO DE VERDADE CREDITA. Assinatura credita em `invoice.paid`
 *    (fatura efetivamente liquidada), não em `checkout.session.completed` —
 *    que dispara também quando o pagamento fica pendente. Avulso exige
 *    `payment_status === "paid"`.
 *
 * Falha depois do claim → `releaseStripeEvent` + resposta 5xx, para o Stripe
 * reentregar e o crédito não se perder.
 */

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoiceShouldGrant(invoice)) {
    log.info("invoice.paid ignored", {
      id: invoice.id,
      reason: invoice.billing_reason,
      amountPaid: invoice.amount_paid,
    });
    return;
  }

  const customerId = customerIdOf(invoice.customer);
  if (!customerId) {
    log.error("invoice without customer", { id: invoice.id });
    return;
  }
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    log.error("no user for customer", { customerId, invoice: invoice.id });
    return;
  }

  await creditInvoice(invoice, userId, "webhook");
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  // Assinaturas são creditadas por invoice.paid — aqui só o avulso.
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") {
    log.info("checkout not paid yet", {
      id: session.id,
      status: session.payment_status,
    });
    return;
  }

  const customerId = customerIdOf(session.customer);
  const userId = customerId ? await findUserIdByCustomerId(customerId) : null;
  if (!userId) {
    log.error("no user for checkout session", {
      session: session.id,
      customerId,
    });
    return;
  }

  await creditCheckoutSession(stripe, session, userId, "webhook");
}

async function handleSubscriptionChanged(
  stripe: Stripe,
  eventSubscription: Stripe.Subscription
): Promise<void> {
  const customerId = customerIdOf(eventSubscription.customer);
  if (!customerId) return;
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) {
    log.error("no user for subscription", {
      subscription: eventSubscription.id,
      customerId,
    });
    return;
  }

  // O Stripe NÃO garante ordem de entrega: um `subscription.updated` atrasado
  // (retry de rede, reentrega) pode carregar estado mais velho que o já
  // aplicado — um "active" antigo chegando depois do "canceled" reativaria o
  // plano na nossa tabela. Por isso o payload do evento serve só de GATILHO;
  // o estado gravado vem de uma busca fresca na API, que devolve o presente.
  // Se a busca falhar, o payload entra como fallback: estado possivelmente
  // velho ainda é melhor que nenhum.
  let subscription = eventSubscription;
  try {
    subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
  } catch (err) {
    log.warn("subscription refetch failed — using event payload", {
      subscription: eventSubscription.id,
      error: (err as Error).message,
    });
  }

  await syncSubscriptionState(subscription, userId, "webhook");
}

/**
 * Estorno após refund ou chargeback.
 *
 * O buraco que isto tapa é o mais rentável para quem quer abusar: comprar
 * créditos, gastar tudo (o que nos custa API de verdade) e então pedir
 * estorno ou abrir disputa no cartão. Sem isto, o prejuízo é integralmente
 * nosso e invisível.
 *
 * O crédito original é reencontrado pelo PREFIXO do external_ref no ledger:
 * uma cobrança ligada a fatura vira 'invoice:<id>:'; uma compra avulsa vira
 * 'checkout:<id>:'. Para a segunda, a sessão de checkout é buscada pelo
 * payment_intent — a mesma chave que o Stripe usa para ligar a cobrança.
 */
async function handleMoneyBack(
  stripe: Stripe,
  charge: Stripe.Charge,
  reason: "refund" | "chargeback"
): Promise<void> {
  const customerId = customerIdOf(charge.customer);
  const userId = customerId ? await findUserIdByCustomerId(customerId) : null;
  if (!userId) {
    log.error("money-back with no known user", {
      charge: charge.id,
      customerId,
      reason,
    });
    return;
  }

  const prefixes: string[] = [];

  const loose = charge as unknown as { invoice?: string | { id?: string } | null };
  const invoiceId = typeof loose.invoice === "string" ? loose.invoice : loose.invoice?.id;
  if (invoiceId) prefixes.push(`invoice:${invoiceId}:`);

  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (paymentIntent) {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntent,
      limit: 5,
    });
    for (const session of sessions.data) prefixes.push(`checkout:${session.id}:`);
  }

  if (prefixes.length === 0) {
    log.error("money-back could not be traced to a grant", {
      charge: charge.id,
      userId,
      reason,
    });
    return;
  }

  // A comissão do parceiro acompanha o dinheiro: se o pagamento voltou atrás,
  // ela também volta. Sem isto, um chargeback custaria duas vezes — as moedas
  // já consumidas E a comissão paga sobre uma venda que não existiu.
  //
  // Roda ANTES do clawback e fora do laço: é uma comissão por pessoa,
  // independente de quantos prefixos de crédito a cobrança tenha gerado. E
  // falhar aqui não pode impedir o estorno das moedas, que é a parte que
  // protege o caixa.
  await reverseCommissionForUser(userId, reason).catch((err) => {
    log.error("commission reversal failed", {
      userId,
      charge: charge.id,
      error: (err as Error).message,
    });
  });

  for (const prefix of prefixes) {
    const balance = await clawbackCoins({ userId, refPrefix: prefix, reason });
    if (balance === null) throw new Error("clawback_coins failed");
    // Nível de log alto de propósito: se o saldo resultante for 0, é sinal de
    // que os créditos já tinham sido consumidos — vale olhar a conta.
    log.warn("coins clawed back", {
      userId,
      reason,
      prefix,
      charge: charge.id,
      balance,
    });
  }
}

const HANDLED = new Set([
  "invoice.paid",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
]);

/**
 * Teto de corpo aceito. O webhook é público: ler um payload arbitrariamente
 * grande antes mesmo de conferir a assinatura seria um convite a exaustão de
 * memória. Eventos reais do Stripe ficam bem abaixo disso.
 */
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !isBillingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  // Corpo CRU — qualquer reserialização quebra a assinatura HMAC.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (err) {
    // Único ponto do sistema em que "assinatura inválida" pode acontecer, e
    // por isso vale um log alto: é o sinal de alguém tentando forjar crédito.
    log.error("signature verification failed", {
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    // 200 para o Stripe parar de reentregar o que não nos interessa.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  let claimed: boolean;
  try {
    claimed = await claimStripeEvent(event.id, event.type);
  } catch (err) {
    log.error("claim failed", { error: (err as Error).message });
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }
  if (!claimed) {
    log.info("duplicate delivery ignored", {
      id: event.id,
      type: event.type,
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(stripe, event.data.object);
        break;
      case "charge.refunded":
        await handleMoneyBack(stripe, event.data.object, "refund");
        break;
      case "charge.dispute.created": {
        const dispute = event.data.object;
        const chargeId =
          typeof dispute.charge === "string" ? dispute.charge : (dispute.charge?.id ?? null);
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId);
          await handleMoneyBack(stripe, charge, "chargeback");
        }
        break;
      }
    }
  } catch (err) {
    // Solta a trava para que a reentrega do Stripe tenha efeito — caso
    // contrário um erro transitório perderia o crédito para sempre.
    await releaseStripeEvent(event.id);
    log.error("handler failed", {
      id: event.id,
      type: event.type,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
