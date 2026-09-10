import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import { parseSummaryFromLLM, type SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";

/**
 * Shared LLM chain that produces a final SummaryPayload from a transcript +
 * curated feed items. Used by:
 *   - POST /api/final-summary          (first pass, right after stop)
 *   - POST /api/final-summary/reprocess (re-run on a saved session)
 *   - POST /api/final-summary/from-transcript
 *   - a importação do YouTube (`lib/youtube/*`)
 *
 * **É UMA chamada só.** Havia uma segunda, o "enriquecimento", que recebia os
 * blocks já organizados e devolvia inserções de `contextCard` e `relatedVerse`,
 * os comentários do Scriba que a tela desenhava num balão. Ela saiu inteira:
 * prompt, tipos de bloco, rotas de telemetria (`summary-enrichment*`) e o
 * componente. Era a segunda chamada mais cara do produto (entrada com o sermão
 * inteiro de novo) para uma camada que o usuário não usava. Se um dia voltar,
 * volta como decisão de produto, não como "faltou algo aqui".
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
  /** Log tag, "final-summary" or "final-summary-reprocess". */
  logPrefix: string;
  /** Metadata route tag on the OpenAI store record + usage rows. */
  metadataRoute: Extract<
    UsageRoute,
    | "final-summary"
    | "final-summary-reprocess"
    | "final-summary-from-transcript"
    | "final-summary-youtube"
  >;
};

export async function generateFinalSummary(
  input: GenerateFinalSummaryInput
): Promise<GenerateFinalSummaryResult> {
  const { userId, sessionId, transcript, feedItems, logPrefix, metadataRoute } = input;
  const log = createLogger(logPrefix);
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
    userId,
    sessionId,
    route: metadataRoute,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });

  return { ok: true, payload, latencyMs, model };
}
