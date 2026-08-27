import "server-only";
import { recordChatUsage } from "@/lib/db/usage";
import { type DeepeningPayload, parseDeepeningFromLLM } from "@/lib/domain/deepening";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { devLog } from "@/lib/log";
import { DEEPENING_SYSTEM_PROMPT } from "@/lib/prompts/deepening";
import { DEEPENING_AUDIT_SYSTEM_PROMPT } from "@/lib/prompts/deepening-audit";

/**
 * Shared LLM chain that produces a DeepeningPayload — the standalone
 * theological study over a session. Used by:
 *   - POST /api/deepening           (first-time generation)
 *   - POST /api/deepening/reprocess (re-run on an existing study)
 *
 * Single-shot: consumes the transcript, curated feed items, and the
 * final_summary already produced for the session. Persistence is left
 * to the caller.
 */

export type GenerateDeepeningSuccess = {
  ok: true;
  payload: DeepeningPayload;
  latencyMs: number;
  model: string;
};

export type GenerateDeepeningError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number };

export type GenerateDeepeningResult = GenerateDeepeningSuccess | GenerateDeepeningError;

export type GenerateDeepeningInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
};

export async function generateDeepening(
  input: GenerateDeepeningInput
): Promise<GenerateDeepeningResult> {
  const { userId, sessionId, transcript, feedItems, finalSummary, logPrefix } = input;
  const model = serverEnv.OPENAI_DEEPENING_MODEL;

  const userMessage = [
    `finalSummary:\n${JSON.stringify(finalSummary)}`,
    `feedItems:\n${JSON.stringify(feedItems)}`,
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
    metadata: buildLlmMetadata({ route: "deepening", userId, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error(`[${logPrefix}] upstream fetch failed`, { error: result.error.message });
      return { ok: false, kind: "fetch", message: result.error.message };
    }
    console.error(`[${logPrefix}] upstream error`, {
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
  const payload = parseDeepeningFromLLM(content);

  devLog(`[${logPrefix}] ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
  });
  if (finishReason === "length") {
    console.warn(`[${logPrefix}] output truncated by max_tokens`, {
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

  // AUDIT PASS — hands the draft + finalSummary to a second model whose job
  // is to reject repetition, enforce quotas (quotes, palavras originais,
  // distinções, autoexame) and reshape 2-3 h1 mergulhos. Best-effort: any
  // failure keeps the first-pass draft, matching the summary-enrichment
  // pattern.
  if (payload.blocks.length > 0) {
    const auditModel = serverEnv.OPENAI_DEEPENING_AUDIT_MODEL;
    const auditUserMessage = [
      `finalSummary:\n${JSON.stringify(finalSummary)}`,
      `draft:\n${JSON.stringify(payload)}`,
    ].join("\n\n---\n");

    const auditResult = await callChat({
      model: auditModel,
      // Auditor é controle de qualidade, não criatividade — temperatura baixa
      // para reduzir alucinação de citação/atribuição e forçar aderência
      // rigorosa à blocklist/whitelist do prompt.
      temperature: 0.15,
      maxTokens: 16000,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: DEEPENING_AUDIT_SYSTEM_PROMPT },
        { role: "user", content: auditUserMessage },
      ],
      store: true,
      metadata: buildLlmMetadata({ route: "deepening-audit", userId, sessionId }),
    });

    if (!auditResult.ok) {
      const err = auditResult.error;
      const kind = err.kind === "fetch" ? "fetch" : "upstream";
      console.warn(`[${logPrefix}-audit] failed — falling back to draft`, {
        kind,
        message: err.message,
      });
      return { ok: true, payload, latencyMs, model };
    }

    const audited = parseDeepeningFromLLM(auditResult.data.content);
    if (audited.blocks.length === 0) {
      console.warn(`[${logPrefix}-audit] returned empty payload — keeping draft`);
      return { ok: true, payload, latencyMs, model };
    }

    devLog(`[${logPrefix}-audit] ok`, {
      latencyMs: auditResult.data.latencyMs,
      finishReason: auditResult.data.finishReason,
      promptTokens: auditResult.data.usage.promptTokens,
      completionTokens: auditResult.data.usage.completionTokens,
      draftBlocks: payload.blocks.length,
      auditedBlocks: audited.blocks.length,
    });
    if (auditResult.data.finishReason === "length") {
      console.warn(`[${logPrefix}-audit] output truncated by max_tokens`, {
        completionTokens: auditResult.data.usage.completionTokens,
      });
    }
    await recordChatUsage({
      sessionId,
      route: "deepening-audit",
      model: auditModel,
      promptTokens: auditResult.data.usage.promptTokens,
      completionTokens: auditResult.data.usage.completionTokens,
      cachedTokens: auditResult.data.usage.cachedTokens,
      latencyMs: auditResult.data.latencyMs,
    });

    return { ok: true, payload: audited, latencyMs, model };
  }

  return { ok: true, payload, latencyMs, model };
}
