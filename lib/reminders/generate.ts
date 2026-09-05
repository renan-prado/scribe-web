import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  isCompleteRemindersPayload,
  parseRemindersFromLLM,
  type RemindersPayload,
} from "@/lib/domain/reminders";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { REMINDERS_SYSTEM_PROMPT } from "@/lib/prompts/reminders";

/**
 * Gera 10 mini-cartões "Lembra disso?" para uma sessão. Chamada única de LLM
 * — o prompt orienta a MISTURAR fontes (verbatim de feed, paráfrase de
 * summary/context, generated do transcript). O caller trata falha/incompleto
 * como best-effort.
 */

export type GenerateRemindersSuccess = {
  ok: true;
  payload: RemindersPayload;
  latencyMs: number;
  model: string;
};

export type GenerateRemindersError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  | { ok: false; kind: "incomplete"; payload: RemindersPayload; latencyMs: number };

export type GenerateRemindersResult = GenerateRemindersSuccess | GenerateRemindersError;

export type GenerateRemindersInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  finalSummary: SummaryPayload;
  feedItems: FeedItem[];
  logPrefix: string;
  /** Rota gravada na telemetria: "reminders" na primeira geração,
   * "reminders-reprocess" quando quem chamou foi o reprocessamento. */
  metadataRoute: Extract<UsageRoute, "reminders" | "reminders-reprocess">;
};

export async function generateReminders(
  input: GenerateRemindersInput
): Promise<GenerateRemindersResult> {
  const { userId, sessionId, transcript, finalSummary, feedItems, logPrefix, metadataRoute } =
    input;
  const log = createLogger(logPrefix);
  const model = serverEnv.OPENAI_REMINDERS_MODEL;

  const userMessage = [
    `finalSummary:\n${JSON.stringify(finalSummary)}`,
    `feedItems:\n${JSON.stringify(feedItems)}`,
    `transcript:\n${transcript}`,
  ].join("\n\n---\n");

  const result = await callChat({
    model,
    // Um pouco mais alta que rereads pra permitir voz coloquial variada nos
    // 10 cartões sem cair em fórmulas repetidas. O prompt já restringe forma.
    temperature: 0.7,
    maxTokens: 3500,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: REMINDERS_SYSTEM_PROMPT },
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
  const payload = parseRemindersFromLLM(content);

  log.debug(`ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    items: payload.items.length,
    origins: countByOrigin(payload),
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

  if (!isCompleteRemindersPayload(payload)) {
    log.warn(`incomplete payload — expected 10 items covering all offsets`, {
      got: payload.items.length,
      offsets: payload.items.map((i) => i.dayOffset),
    });
    return { ok: false, kind: "incomplete", payload, latencyMs };
  }

  return { ok: true, payload, latencyMs, model };
}

function countByOrigin(payload: RemindersPayload): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of payload.items) {
    out[item.origin] = (out[item.origin] ?? 0) + 1;
  }
  return out;
}
