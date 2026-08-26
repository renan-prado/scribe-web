import { NextResponse } from "next/server";
import { z } from "zod";
import { updateSessionFinal } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import { FeedItemSchema } from "@/lib/domain/feed";
import { parseSummaryFromLLM } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { devLog } from "@/lib/log";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

// Sermons run 30-90min in practice; the transcript we've observed maxes out
// around ~150k chars. 300k is 2× headroom without letting a bot smuggle an
// unbounded prompt through this endpoint (which is expensive: gpt-4-class
// model, 12k output tokens).
// feedItems is strictly validated — this array is persisted to the DB, so a
// malformed entry from a compromised client would poison future reads.
// 2000 items is far above any real recording; the live feed rarely tops 150.
const MAX_TEXT_CHARS = 300_000;
const MAX_FEED_ITEMS = 2000;
const MAX_SESSION_HOURS_MS = 12 * 60 * 60 * 1000;

const BodySchema = z
  .object({
    sessionId: UuidSchema,
    text: z.string().max(MAX_TEXT_CHARS),
    feedItems: z.array(FeedItemSchema).max(MAX_FEED_ITEMS).optional(),
    durationMs: z.number().finite().nonnegative().max(MAX_SESSION_HOURS_MS).optional(),
    speakerName: z.string().max(200).optional(),
    speakerLocation: z.string().max(200).optional(),
  })
  .strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single-shot final summary. Runs once after the recording stops, consuming
 * the full transcript AND the feed items already surfaced live. The prompt
 * treats the feed as high-priority curated context: cited verses and speaker
 * highlights should carry through, AI suggestions are kept only if they still
 * fit in the whole. Produces a SummaryPayload rendered by the same view used
 * for the previous live summary.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["final-summary"], auth.user.id);
  if (limited) return limited;

  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const sessionId = body.sessionId;
  const text = body.text.trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  const feedItems = body.feedItems ?? [];

  const userMessage = `feedItems:\n${JSON.stringify(feedItems)}\n\n---\ntranscript:\n${text}`;

  const result = await callChat({
    model,
    temperature: 0.2,
    // 4k was truncating dense 40-60min sermons (Nicodemus, expositional
    // preaching): the finishReason=length warn was firing and the resumo
    // was arriving cut short. 12k gives room for the resumo to grow
    // proportionally to content density without capping doctrinal depth.
    maxTokens: 12000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: FINAL_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "final-summary", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[final-summary] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    console.error("[final-summary] upstream error", {
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
  const payload = parseSummaryFromLLM(content, "final");

  devLog("[final-summary] ok", {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
    feedItems: feedItems.length,
  });
  if (finishReason === "length") {
    console.warn("[final-summary] output truncated by max_tokens", {
      completionTokens: usage.completionTokens,
    });
  }
  await recordChatUsage({
    sessionId,
    route: "final-summary",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    latencyMs,
  });

  // Fill the row created at start. Never fail the request on save error —
  // the user already sat through the recording; return the summary and log
  // for investigation. RLS scopes the update to the session's owner.
  let saved = false;
  try {
    await updateSessionFinal(sessionId, {
      transcript: text,
      feedItems,
      summary: payload,
      durationMs: body.durationMs ?? null,
      speakerName: body.speakerName?.trim() || null,
      speakerLocation: body.speakerLocation?.trim() || null,
    });
    saved = true;
    devLog("[final-summary] saved", { sessionId });
  } catch (err) {
    console.error("[final-summary] save failed", { sessionId, error: (err as Error).message });
  }

  return NextResponse.json({ ...payload, latencyMs, model, sessionId, saved });
}
