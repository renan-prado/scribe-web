import { NextResponse } from "next/server";
import { z } from "zod";
import { updateSessionFinal } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import { FeedItemSchema } from "@/lib/domain/feed";
import {
  mergeEnrichmentIntoBlocks,
  parseEnrichmentFromLLM,
  parseSummaryFromLLM,
} from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { devLog } from "@/lib/log";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";
import { SUMMARY_ENRICHMENT_SYSTEM_PROMPT } from "@/lib/prompts/summary-enrichment";
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

  // Second call: enrichment (contextCard + relatedVerse). Runs after the
  // organized sermon is ready and receives the indexed blocks + transcript
  // + feedItems as context. Best-effort — a failure here does NOT block
  // the summary; the user still gets the organized sermon without AI cards.
  // Only run when we actually have blocks to enrich against.
  if (payload.blocks.length > 0) {
    const enrichmentModel = serverEnv.OPENAI_SUMMARY_ENRICHMENT_MODEL;
    // The enrichment prompt refers to blocks by index — send them with an
    // explicit "index" field so the model can't miscount.
    const indexedBlocks = payload.blocks.map((block, index) => ({ index, ...block }));
    const enrichmentUserMessage =
      `blocks (indexed):\n${JSON.stringify(indexedBlocks)}\n\n---\n` +
      `feedItems:\n${JSON.stringify(feedItems)}\n\n---\n` +
      `transcript:\n${text}`;

    const enrichmentResult = await callChat({
      model: enrichmentModel,
      // Slightly higher than the sermon call — enrichment benefits from
      // some variation in which angle to hit; sermon needs fidelity.
      temperature: 0.5,
      // ~40 insertions of 2-5 sentences ≈ 3-4k tokens ceiling. 6k gives
      // headroom without letting a runaway response cost too much.
      maxTokens: 6000,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: SUMMARY_ENRICHMENT_SYSTEM_PROMPT },
        { role: "user", content: enrichmentUserMessage },
      ],
      store: true,
      metadata: buildLlmMetadata({
        route: "summary-enrichment",
        userId: auth.user.id,
        sessionId,
      }),
    });

    if (!enrichmentResult.ok) {
      const err = enrichmentResult.error;
      const kind = err.kind === "fetch" ? "fetch" : "upstream";
      console.warn("[summary-enrichment] failed — sermon returned without AI cards", {
        kind,
        message: err.message,
      });
    } else {
      const insertions = parseEnrichmentFromLLM(enrichmentResult.data.content);
      if (insertions.length > 0) {
        payload.blocks = mergeEnrichmentIntoBlocks(payload.blocks, insertions);
      }
      devLog("[summary-enrichment] ok", {
        latencyMs: enrichmentResult.data.latencyMs,
        finishReason: enrichmentResult.data.finishReason,
        promptTokens: enrichmentResult.data.usage.promptTokens,
        completionTokens: enrichmentResult.data.usage.completionTokens,
        insertions: insertions.length,
        totalBlocksAfterMerge: payload.blocks.length,
      });
      await recordChatUsage({
        sessionId,
        route: "summary-enrichment",
        model: enrichmentModel,
        promptTokens: enrichmentResult.data.usage.promptTokens,
        completionTokens: enrichmentResult.data.usage.completionTokens,
        cachedTokens: enrichmentResult.data.usage.cachedTokens,
        latencyMs: enrichmentResult.data.latencyMs,
      });
    }
  }

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
