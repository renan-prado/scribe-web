import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  mergeEnrichmentIntoBlocks,
  parseEnrichmentFromLLM,
  parseSummaryFromLLM,
  type SummaryPayload,
} from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";
import { SUMMARY_ENRICHMENT_SYSTEM_PROMPT } from "@/lib/prompts/summary-enrichment";

/**
 * Shared LLM chain that produces a final SummaryPayload from a transcript +
 * curated feed items. Used by:
 *   - POST /api/final-summary          (first pass, right after stop)
 *   - POST /api/final-summary/reprocess (re-run on a saved session)
 *
 * Runs the two-shot flow: sermon-organizer prompt then optional enrichment
 * that layers contextCard + relatedVerse into the blocks. Enrichment failure
 * is best-effort — the caller still gets a valid summary, just without AI
 * cards. Both calls emit usage telemetry via recordChatUsage.
 */

export type GenerateFinalSummarySuccess = {
  ok: true;
  payload: SummaryPayload;
  latencyMs: number;
  model: string;
};

export type GenerateFinalSummaryError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number };

export type GenerateFinalSummaryResult = GenerateFinalSummarySuccess | GenerateFinalSummaryError;

export type GenerateFinalSummaryInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  /** Log tag — "final-summary" or "final-summary-reprocess". */
  logPrefix: string;
  /** Metadata route tag on the OpenAI store record + usage rows. */
  metadataRoute: Extract<UsageRoute, "final-summary" | "final-summary-reprocess">;
};

export async function generateFinalSummary(
  input: GenerateFinalSummaryInput
): Promise<GenerateFinalSummaryResult> {
  const { userId, sessionId, transcript, feedItems, logPrefix, metadataRoute } = input;
  const log = createLogger(logPrefix);
  const enrichmentLog = log.scoped("enrichment");
  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  const userMessage = `feedItems:\n${JSON.stringify(feedItems)}\n\n---\ntranscript:\n${transcript}`;

  const result = await callChat({
    model,
    temperature: 0.2,
    maxTokens: 12000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: FINAL_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: metadataRoute, userId, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      log.error(`upstream fetch failed`, { error: result.error.message });
      return { ok: false, kind: "fetch", message: result.error.message };
    }
    log.error(`upstream error`, {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return {
      ok: false,
      kind: "upstream",
      message: result.error.message,
      status: result.error.status,
      latencyMs: result.error.latencyMs,
    };
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const payload = parseSummaryFromLLM(content, "final");

  log.debug(`ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
    feedItems: feedItems.length,
  });
  if (finishReason === "length") {
    log.warn(`output truncated by max_tokens`, {
      completionTokens: usage.completionTokens,
    });
  }
  await recordChatUsage({
    sessionId,
    route: metadataRoute,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });

  if (payload.blocks.length > 0) {
    const enrichmentModel = serverEnv.OPENAI_SUMMARY_ENRICHMENT_MODEL;
    // O enriquecimento herda o passe que o chamou. Marcado sempre como
    // "summary-enrichment", metade do custo de um reprocessamento ia parar na
    // linha da gravação e o preço de reprocessar resumo parecia mais barato do
    // que é — ver /admin/precificacao.
    const enrichmentRoute: UsageRoute =
      metadataRoute === "final-summary-reprocess"
        ? "summary-enrichment-reprocess"
        : "summary-enrichment";
    const indexedBlocks = payload.blocks.map((block, index) => ({ index, ...block }));
    const enrichmentUserMessage =
      `blocks (indexed):\n${JSON.stringify(indexedBlocks)}\n\n---\n` +
      `feedItems:\n${JSON.stringify(feedItems)}\n\n---\n` +
      `transcript:\n${transcript}`;

    const enrichmentResult = await callChat({
      model: enrichmentModel,
      temperature: 0.5,
      maxTokens: 6000,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: SUMMARY_ENRICHMENT_SYSTEM_PROMPT },
        { role: "user", content: enrichmentUserMessage },
      ],
      store: true,
      metadata: buildLlmMetadata({
        route: enrichmentRoute,
        userId,
        sessionId,
      }),
    });

    if (!enrichmentResult.ok) {
      const err = enrichmentResult.error;
      const kind = err.kind === "fetch" ? "fetch" : "upstream";
      enrichmentLog.warn(`failed — sermon returned without AI cards`, {
        kind,
        message: err.message,
      });
    } else {
      const insertions = parseEnrichmentFromLLM(enrichmentResult.data.content);
      if (insertions.length > 0) {
        payload.blocks = mergeEnrichmentIntoBlocks(payload.blocks, insertions);
      }
      enrichmentLog.debug(`ok`, {
        latencyMs: enrichmentResult.data.latencyMs,
        finishReason: enrichmentResult.data.finishReason,
        promptTokens: enrichmentResult.data.usage.promptTokens,
        completionTokens: enrichmentResult.data.usage.completionTokens,
        insertions: insertions.length,
        totalBlocksAfterMerge: payload.blocks.length,
      });
      await recordChatUsage({
        sessionId,
        route: enrichmentRoute,
        model: enrichmentModel,
        promptTokens: enrichmentResult.data.usage.promptTokens,
        completionTokens: enrichmentResult.data.usage.completionTokens,
        cachedTokens: enrichmentResult.data.usage.cachedTokens,
        latencyMs: enrichmentResult.data.latencyMs,
      });
    }
  }

  return { ok: true, payload, latencyMs, model };
}
        reasoningTokens: enrichmentResult.data.usage.reasoningTokens,
