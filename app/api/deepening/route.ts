import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeCoins } from "@/lib/db/coins";
import { createDeepening, hasDeepening } from "@/lib/db/deepenings";
import { getSession } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import { parseDeepeningFromLLM } from "@/lib/domain/deepening";
import { serverEnv } from "@/lib/env/server";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { devLog } from "@/lib/log";
import { DEEPENING_SYSTEM_PROMPT } from "@/lib/prompts/deepening";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single-shot deepening ("aprofundamento"). Consumes the full transcript,
 * curated feed items AND the final_summary already produced for the session,
 * and produces a denser theological pass. Persisted in session_deepenings
 * (unique per session_id — one aprofundamento per sessão, forever).
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.deepening, auth.user.id);
  if (limited) return limited;

  const model = serverEnv.OPENAI_DEEPENING_MODEL;

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
    console.error("[deepening] charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const userMessage = [
    `finalSummary:\n${JSON.stringify(session.finalSummary)}`,
    `feedItems:\n${JSON.stringify(session.feedItems)}`,
    `transcript:\n${transcript}`,
  ].join("\n\n---\n");

  const result = await callChat({
    model,
    temperature: 0.3,
    maxTokens: 16000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: DEEPENING_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "deepening", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[deepening] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    console.error("[deepening] upstream error", {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs },
      { status: 502 }
    );
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const payload = parseDeepeningFromLLM(content);

  devLog("[deepening] ok", {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
  });
  if (finishReason === "length") {
    console.warn("[deepening] output truncated by max_tokens", {
      completionTokens: usage.completionTokens,
    });
  }
  await recordChatUsage({
    sessionId,
    route: "deepening",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    latencyMs,
  });

  let saved = false;
  try {
    await createDeepening(sessionId, payload);
    saved = true;
    devLog("[deepening] saved", { sessionId });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "deepening_already_exists") {
      return NextResponse.json({ error: "deepening_already_exists" }, { status: 409 });
    }
    console.error("[deepening] save failed", { sessionId, error: message });
  }

  return NextResponse.json({ ...payload, latencyMs, model, sessionId, saved });
}
