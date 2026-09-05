import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeCoins } from "@/lib/db/coins";
import { getDeepening, updateDeepening } from "@/lib/db/deepenings";
import { getSession } from "@/lib/db/sessions";
import { requireFeature } from "@/lib/entitlements/server";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateStudy } from "@/lib/study/generate";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("deepening-reprocess");

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O pipeline do estudo são três chamadas a um modelo de raciocínio e leva
// perto de quatro minutos. Sem este teto explícito a função morre no padrão
// da plataforma — e morreria DEPOIS de debitar as moedas.
export const maxDuration = 300;

/**
 * POST /api/deepening/reprocess
 *
 * Re-runs the study prompt on an already-generated deepening, overwriting
 * the persisted payload. Same inputs as /api/deepening (transcript + feed
 * items + final_summary). Costs `reprocess_deepening` coins — charged before
 * the LLM call, following the same pattern as /api/final-summary/reprocess.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["deepening-reprocess"], auth.user.id);
  if (limited) return limited;

  // Gate de plano ANTES de qualquer trabalho — e, principalmente, antes de
  // cobrar. Esconder o botão é UX; isto é a proteção. Ver
  // lib/entitlements/features.ts.
  const gated = await requireFeature("study_generation");
  if (gated) return gated;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const sessionId = parsed.data.sessionId;

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.finalSummary) {
    return NextResponse.json({ error: "session_not_finalized" }, { status: 409 });
  }
  const transcript = session.transcript.trim();
  if (!transcript) {
    return NextResponse.json({ error: "empty_transcript" }, { status: 409 });
  }

  const existing = await getDeepening(sessionId);
  if (!existing) {
    return NextResponse.json({ error: "deepening_not_found" }, { status: 404 });
  }

  const charge = await chargeCoins("reprocess_deepening", sessionId, auth.user.id);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    log.error("charge failed", {
      error: charge.error,
      message: charge.message,
    });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const result = await generateStudy({
    userId: auth.user.id,
    sessionId,
    transcript,
    feedItems: session.feedItems,
    finalSummary: session.finalSummary,
    logPrefix: "deepening-reprocess",
  });

  if (!result.ok) {
    if (result.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.message}` },
        { status: 502 }
      );
    }
    if (result.kind === "pipeline") {
      return NextResponse.json({ error: result.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: result.message, latencyMs: result.latencyMs },
      { status: 502 }
    );
  }

  const { payload, record, latencyMs, model } = result;

  let saved = false;
  try {
    await updateDeepening(sessionId, payload, record);
    saved = true;
    log.debug("saved", { sessionId });
  } catch (err) {
    log.error("save failed", {
      sessionId,
      error: (err as Error).message,
    });
  }

  return NextResponse.json({ ...payload, latencyMs, model, sessionId, saved });
}
