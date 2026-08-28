import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeCoins } from "@/lib/db/coins";
import { getSession, updateSessionSummary } from "@/lib/db/sessions";
import { generateFinalSummary } from "@/lib/final-summary/generate";
import { generateAndSaveHighlights } from "@/lib/highlights/save";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { generateAndSavePractices } from "@/lib/practices/save";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateAndSaveReminders } from "@/lib/reminders/save";
import { generateAndSaveRereads } from "@/lib/rereads/save";
import { requireAuth } from "@/lib/supabase/require-auth";

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/final-summary/reprocess
 *
 * Re-runs the final-summary LLM chain on an already-saved session, using the
 * transcript and curated feed items already stored on the row. Overwrites the
 * previous final_summary payload. Costs `reprocess_summary` coins — charged
 * before the LLM call, following the same pattern as /api/deepening (a 402
 * here means the account is dry; downstream LLM failures do not refund).
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["final-summary-reprocess"], auth.user.id);
  if (limited) return limited;

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

  const charge = await chargeCoins("reprocess_summary", sessionId);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    console.error("[final-summary-reprocess] charge failed", {
      error: charge.error,
      message: charge.message,
    });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const result = await generateFinalSummary({
    userId: auth.user.id,
    sessionId,
    transcript,
    feedItems: session.feedItems,
    logPrefix: "final-summary-reprocess",
    metadataRoute: "final-summary-reprocess",
  });

  if (!result.ok) {
    if (result.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.message, latencyMs: result.latencyMs },
      { status: 502 }
    );
  }

  const { payload, latencyMs, model } = result;

  let saved = false;
  try {
    await updateSessionSummary(sessionId, payload);
    saved = true;
    devLog("[final-summary-reprocess] saved", { sessionId });
  } catch (err) {
    console.error("[final-summary-reprocess] save failed", {
      sessionId,
      error: (err as Error).message,
    });
  }

  // Regenera "Coloque em prática" (5), "Releia este texto" (10), "Lembra
  // disso?" (10) e "Frases marcantes" (até 12, sem IA) em paralelo com o
  // resumo atualizado — upsert sobrescreve o payload anterior de cada.
  // Best-effort, mesmo padrão do route de primeira geração.
  const [practices, rereads, reminders, highlights] = await Promise.all([
    generateAndSavePractices({
      userId: auth.user.id,
      sessionId,
      transcript,
      feedItems: session.feedItems,
      finalSummary: payload,
      logPrefix: "practices-reprocess",
    }),
    generateAndSaveRereads({
      userId: auth.user.id,
      sessionId,
      transcript,
      feedItems: session.feedItems,
      finalSummary: payload,
      logPrefix: "rereads-reprocess",
    }),
    generateAndSaveReminders({
      userId: auth.user.id,
      sessionId,
      transcript,
      feedItems: session.feedItems,
      finalSummary: payload,
      logPrefix: "reminders-reprocess",
    }),
    generateAndSaveHighlights({
      sessionId,
      feedItems: session.feedItems,
      finalSummary: payload,
      logPrefix: "highlights-reprocess",
    }),
  ]);

  return NextResponse.json({
    ...payload,
    latencyMs,
    model,
    sessionId,
    saved,
    practices,
    rereads,
    reminders,
    highlights,
  });
}
