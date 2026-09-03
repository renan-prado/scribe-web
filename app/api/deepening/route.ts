import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeCoins } from "@/lib/db/coins";
import { createDeepening, hasDeepening } from "@/lib/db/deepenings";
import { getSession } from "@/lib/db/sessions";
import { generateDeepening } from "@/lib/deepening/generate";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("deepening");

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single-shot study ("estudo"). Consumes the full transcript, curated feed
 * items AND the final_summary already produced for the session, and produces
 * a standalone theological study on the same theme — not a repackage of the
 * sermon. Persisted in session_deepenings (unique per session_id).
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.deepening, auth.user.id);
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

  if (await hasDeepening(sessionId)) {
    return NextResponse.json({ error: "deepening_already_exists" }, { status: 409 });
  }

  // Charge coins BEFORE we call the LLM — a 402 here means the account is
  // dry and there's no point spending upstream tokens on a request the user
  // can't afford. Any downstream failure below leaves the ledger entry in
  // place (intentional: this is a mechanism-testing pass and refunds add
  // complexity we don't need yet).
  const charge = await chargeCoins("deepening", sessionId);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    log.error("charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const result = await generateDeepening({
    userId: auth.user.id,
    sessionId,
    transcript,
    feedItems: session.feedItems,
    finalSummary: session.finalSummary,
    logPrefix: "deepening",
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
    await createDeepening(sessionId, payload);
    saved = true;
    log.debug("saved", { sessionId });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "deepening_already_exists") {
      return NextResponse.json({ error: "deepening_already_exists" }, { status: 409 });
    }
    log.error("save failed", { sessionId, error: message });
  }

  return NextResponse.json({ ...payload, latencyMs, model, sessionId, saved });
}
