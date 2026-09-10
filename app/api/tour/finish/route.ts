import { NextResponse } from "next/server";
import { z } from "zod";
import { finishTour } from "@/lib/db/tours";
import { TOUR_KEYS } from "@/lib/domain/tour";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("tour/finish");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    tour: z.enum(TOUR_KEYS),
    /** Índice 0-based do passo em que o tour terminou. */
    step: z.number().int().min(0).max(50),
    outcome: z.enum(["completed", "dismissed"]),
  })
  .strict();

/**
 * POST /api/tour/finish, o desfecho: chegou ao fim, ou fechou no passo N.
 *
 * Não decide nada sobre o tour voltar, isso já foi decidido em
 * `/api/tour/start`, quando a linha nasceu. Esta rota existe para a pergunta
 * que só se responde depois: um tour que quase todo mundo abandona no mesmo
 * passo não precisa de mais um passo, precisa que aquele saia.
 *
 * Por isso ela também não é crítica. O cliente a chama e segue a vida sem
 * olhar a resposta, inclusive no `pagehide`, onde a única coisa que chega até
 * o fim é um `sendBeacon`.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["tour-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    await finishTour({ userId: auth.user.id, ...parsed.data });
  } catch (err) {
    log.warn("falha ao gravar desfecho", { error: (err as Error).message });
  }
  return NextResponse.json({ ok: true });
}
