import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  isCompletePracticesPayload,
  type PracticesPayload,
  parsePracticesFromLLM,
} from "@/lib/domain/practices";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { PRACTICES_SYSTEM_PROMPT } from "@/lib/prompts/practices";

/**
 * Gera 5 sugestões de "Coloque em prática" para uma sessão a partir do
 * transcript, feedItems curados e finalSummary já produzido. Usado como
 * best-effort dentro dos routes /api/final-summary e /api/final-summary/reprocess.
 *
 * A falha aqui NÃO deve derrubar a resposta do resumo — o chamador loga e
 * segue. Um payload incompleto (menos que 5 itens ou faltando algum offset)
 * também é tratado como falha pra evitar persistir estado inconsistente
 * (a UI espera exatamente os 5 slots).
 */

export type GeneratePracticesSuccess = {
  ok: true;
  payload: PracticesPayload;
  latencyMs: number;
  model: string;
};

export type GeneratePracticesError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  | { ok: false; kind: "incomplete"; payload: PracticesPayload; latencyMs: number };

export type GeneratePracticesResult = GeneratePracticesSuccess | GeneratePracticesError;

export type GeneratePracticesInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  finalSummary: SummaryPayload;
  feedItems: FeedItem[];
  logPrefix: string;
  /** Rota gravada na telemetria: "practices" na primeira geração,
   * "practices-reprocess" quando quem chamou foi o reprocessamento. */
  metadataRoute: Extract<UsageRoute, "practices" | "practices-reprocess">;
};

export async function generatePractices(
  input: GeneratePracticesInput
): Promise<GeneratePracticesResult> {
  const { userId, sessionId, transcript, finalSummary, feedItems, logPrefix, metadataRoute } =
    input;
  const log = createLogger(logPrefix);
  const model = serverEnv.OPENAI_PRACTICES_MODEL;

  const userMessage = [
    `finalSummary:\n${JSON.stringify(finalSummary)}`,
    `feedItems:\n${JSON.stringify(feedItems)}`,
    `transcript:\n${transcript}`,
  ].join("\n\n---\n");

  const result = await callChat({
    model,
    // Temperatura mais alta pra fugir do óbvio ("liste 3 coisas pelas quais…"),
    // sem chegar em criatividade descontrolada — o prompt já dá âncoras fortes.
    temperature: 0.7,
    maxTokens: 2000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: PRACTICES_SYSTEM_PROMPT },
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
  const payload = parsePracticesFromLLM(content);

  log.debug(`ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    items: payload.items.length,
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

  if (!isCompletePracticesPayload(payload)) {
    log.warn(`incomplete payload — expected 5 items covering all offsets`, {
      got: payload.items.length,
      offsets: payload.items.map((i) => i.dayOffset),
    });
    return { ok: false, kind: "incomplete", payload, latencyMs };
  }

  return { ok: true, payload, latencyMs, model };
}
