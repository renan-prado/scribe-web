import { NextResponse } from "next/server";
import { z } from "zod";
import { createCoinGift } from "@/features/coins/server/gifts";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/users/coins");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Presenteia alguém com moedas, pelo painel. NÃO credita na hora.
 *
 * ## Por que ela deixou de ser um crédito instantâneo
 *
 * O crédito direto era invisível para quem recebia: a conta de alguém subia
 * 200 moedas no meio de um saldo que já muda toda hora, e o gesto se perdia
 * dentro de um número. Hoje o admin escreve um TÍTULO e uma MENSAGEM junto do
 * valor, e a pessoa vê um cartão na Biblioteca com um botão "Resgatar X
 * moedas" — o crédito de verdade só acontece quando ELA toca nele. Ver
 * `src/features/coins/server/gifts.ts` e a migração 0077.
 *
 * ## Ela ainda não é uma segunda porta de crédito
 *
 * Esta rota só INSERE a promessa (`coin_gifts`). Quem credita é
 * `redeem_coin_gift`, pela porta única (`grant_coins`, `lib/db/billing.ts`),
 * chamada por `POST /api/coins/gifts/:id/redeem` no momento do resgate.
 *
 * ## O que ela não deixa fazer
 *
 * **Só presenteia.** Não há valor negativo, e não é esquecimento: tirar moeda
 * de alguém é estorno, tem motivo próprio (`refund`/`chargeback`) e já tem
 * caminho (`clawbackCoins`). O teto de 50.000 por operação é a mesma folga de
 * sempre, vinte vezes a franquia mensal do plano mais caro.
 */
const MAX_GRANT = 50_000;

const BodySchema = z
  .object({
    amount: z.number().int().positive().max(MAX_GRANT),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const gift = await createCoinGift({
    userId: id,
    amount: parsed.data.amount,
    title: parsed.data.title,
    message: parsed.data.message,
    grantedBy: auth.user.id,
  });

  if (gift === null) {
    log.error("gift creation failed", { targetId: id, amount: parsed.data.amount });
    return NextResponse.json({ error: "grant_failed" }, { status: 422 });
  }

  // `info`, e não `debug`: é dinheiro prometido por decisão de uma pessoa, e é
  // o tipo de rastro que se vai querer numa auditoria. Ver `src/lib/AGENTS.md`.
  log.info("gift created", {
    targetId: id,
    byAdminId: auth.user.id,
    amount: gift.amount,
    giftId: gift.id,
  });

  return NextResponse.json({ ok: true, gift });
}
