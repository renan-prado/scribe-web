import { serverEnv } from "@/lib/env/server";
import type { LLMFailure, Result } from "@/lib/llm/openai";

const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BATCH_SIZE = 100;

export type EmbeddingUsage = {
  promptTokens: number | undefined;
  totalTokens: number | undefined;
};

export type EmbedManyResult = {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage: EmbeddingUsage;
  latencyMs: number;
};

export type EmbedOneResult = {
  embedding: number[];
  model: string;
  dimensions: number;
  usage: EmbeddingUsage;
  latencyMs: number;
};

export type EmbedParams = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

function parseRetryAfterMs(body: string): number | null {
  const match = /try again in (\d+(?:\.\d+)?)(ms|s)/i.exec(body);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2].toLowerCase() === "ms" ? value : value * 1000;
}

async function callEmbeddings(
  input: string[],
  opts?: EmbedParams
): Promise<Result<EmbedManyResult>> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Chain caller-provided signal into our controller so cancellation propagates.
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let upstream: Response;
  let raw = "";
  const maxAttempts = 4;
  try {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        upstream = await fetch(EMBEDDINGS_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: serverEnv.OPENAI_EMBEDDING_MODEL,
            input,
            dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
            encoding_format: "float",
          }),
        });
      } catch (err) {
        return {
          ok: false,
          error: { kind: "fetch", message: (err as Error).message ?? "network error" },
        };
      }
      raw = await upstream.text();
      if (upstream.status !== 429 || attempt >= maxAttempts) break;
      const waitMs = parseRetryAfterMs(raw) ?? Math.min(2000 * 2 ** (attempt - 1), 30_000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  if (!upstream.ok) {
    const err: LLMFailure = {
      kind: "http",
      status: upstream.status,
      message: `upstream ${upstream.status}: ${raw.slice(0, 500)}`,
      snippet: raw.slice(0, 500),
      latencyMs,
    };
    return { ok: false, error: err };
  }

  let parsed: {
    data?: { embedding?: number[]; index?: number }[];
    model?: string;
    usage?: { prompt_tokens?: number; total_tokens?: number };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: {
        kind: "http",
        status: upstream.status,
        message: "invalid JSON in embeddings response",
        snippet: raw.slice(0, 500),
        latencyMs,
      },
    };
  }

  const rows = parsed.data ?? [];
  const embeddings: number[][] = new Array(input.length);
  for (const row of rows) {
    if (typeof row?.index !== "number" || !Array.isArray(row.embedding)) continue;
    embeddings[row.index] = row.embedding;
  }
  // Fill any gaps with empty arrays so callers can detect partial failure.
  for (let i = 0; i < input.length; i++) {
    if (!embeddings[i]) embeddings[i] = [];
  }

  return {
    ok: true,
    data: {
      embeddings,
      model: parsed.model ?? serverEnv.OPENAI_EMBEDDING_MODEL,
      dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
      usage: {
        promptTokens: parsed.usage?.prompt_tokens,
        totalTokens: parsed.usage?.total_tokens,
      },
      latencyMs,
    },
  };
}

/**
 * Embed a single string. Thin wrapper over embedTexts for callers that want
 * a scalar result — used by searchKnowledge for the query embedding.
 */
export async function embedText(
  input: string,
  opts?: EmbedParams
): Promise<Result<EmbedOneResult>> {
  const batch = await callEmbeddings([input], opts);
  if (!batch.ok) return batch;
  return {
    ok: true,
    data: {
      embedding: batch.data.embeddings[0] ?? [],
      model: batch.data.model,
      dimensions: batch.data.dimensions,
      usage: batch.data.usage,
      latencyMs: batch.data.latencyMs,
    },
  };
}

/**
 * Embed many strings. Batches internally to stay under the OpenAI per-request
 * cap of 100 inputs and aggregates usage/latency across batches.
 */
export async function embedTexts(
  inputs: string[],
  opts?: EmbedParams
): Promise<Result<EmbedManyResult>> {
  if (inputs.length === 0) {
    return {
      ok: true,
      data: {
        embeddings: [],
        model: serverEnv.OPENAI_EMBEDDING_MODEL,
        dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
        usage: { promptTokens: 0, totalTokens: 0 },
        latencyMs: 0,
      },
    };
  }
  if (inputs.length <= MAX_BATCH_SIZE) return callEmbeddings(inputs, opts);

  const out: number[][] = [];
  let promptTokens = 0;
  let totalTokens = 0;
  let latencyMs = 0;
  let modelSeen = serverEnv.OPENAI_EMBEDDING_MODEL;
  for (let i = 0; i < inputs.length; i += MAX_BATCH_SIZE) {
    const slice = inputs.slice(i, i + MAX_BATCH_SIZE);
    const res = await callEmbeddings(slice, opts);
    if (!res.ok) return res;
    for (const v of res.data.embeddings) out.push(v);
    promptTokens += res.data.usage.promptTokens ?? 0;
    totalTokens += res.data.usage.totalTokens ?? 0;
    latencyMs += res.data.latencyMs;
    modelSeen = res.data.model;
  }
  return {
    ok: true,
    data: {
      embeddings: out,
      model: modelSeen,
      dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
      usage: { promptTokens, totalTokens },
      latencyMs,
    },
  };
}
