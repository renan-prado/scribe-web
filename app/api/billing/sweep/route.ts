import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { sweepRecentPayments } from "@/lib/billing/sweep";
import { serverEnv } from "@/lib/env/server";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("billing/sweep");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uma passada percorre até ~200 objetos do Stripe com uma chamada de crédito
// idempotente para cada pago — folga sobre o timeout default.
export const maxDuration = 300;

/**
 * Varredura periódica de pagamentos — a terceira e última linha de defesa do
 * crédito (as duas primeiras: webhook e reconciliação no retorno do checkout).
 * Percorre os pagamentos das últimas horas no Stripe e credita qualquer um
 * que não esteja no ledger. Ver `lib/billing/sweep.ts`.
 *
 * Disparada pelo Vercel Cron (ver vercel.json) uma vez por dia. GET porque é
 * o método que o cron da Vercel usa.
 *
 * AUTENTICAÇÃO: rota pública no proxy (o cron não tem cookie de sessão),
 * guardada por `CRON_SECRET` — a Vercel injeta o valor da env var
 * automaticamente como `Authorization: Bearer <CRON_SECRET>` nas requisições
 * de cron. Comparação em tempo constante; sem a variável configurada, a rota
 * responde 503 e não faz nada.
 *
 * Vale notar o que um invasor ganharia se acertasse o segredo: o poder de
 * mandar o servidor conferir pagamentos REAIS no Stripe e creditar os donos
 * LEGÍTIMOS — ou seja, nada além de gastar nossa cota de API. Ainda assim o
 * segredo existe, porque rota pública sem autenticação é convite para flood.
 */

/** Janela padrão: cron diário + folga para atrasos do próprio cron. */
const SWEEP_WINDOW_HOURS = 26;

function authorized(request: Request): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // timingSafeEqual exige buffers do mesmo tamanho; comprimentos diferentes
  // já são resposta suficiente (e o comprimento do header não é segredo).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, RATE_LIMITS["billing-sweep"]);
  if (limited) return limited;

  if (!serverEnv.CRON_SECRET) {
    return NextResponse.json({ error: "sweep_not_configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    log.warn("unauthorized attempt");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe || !isBillingConfigured()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  try {
    const report = await sweepRecentPayments(stripe, SWEEP_WINDOW_HOURS);
    return NextResponse.json(report);
  } catch (err) {
    log.error("failed", { error: (err as Error).message });
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}
