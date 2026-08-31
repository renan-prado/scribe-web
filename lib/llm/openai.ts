import { serverEnv } from "@/lib/env/server";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TIMEOUT_MS = 60_000;

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type ChatUsage = {
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  totalTokens: number | undefined;
  cachedTokens: number | undefined;
};

export type ChatResult = {
  content: string;
  finishReason: string;
  usage: ChatUsage;
  latencyMs: number;
};

export type ChatParams = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
  /**
   * When true, OpenAI persists the completion in the platform Logs UI. Pair
   * with `metadata` to filter logs by route/session/user in the dashboard.
   * Note: retains prompts/responses for 30 days on OpenAI's side.
   */
  store?: boolean;
  /** Up to 16 string→string entries. Shown in the OpenAI Logs UI. */
  metadata?: Record<string, string>;
};

export type TranscribeParams = {
  model: string;
  file: Blob;
  filename: string;
  prompt?: string;
  language?: string;
  timeoutMs?: number;
  /** Extra payload to request. `logprobs` only works with the gpt-*-transcribe
   * family em response_format json (não suportado por whisper-1 nem pelos
   * modelos -diarize) — o caller decide quando pedir. */
  include?: "logprobs"[];
};

export type TranscribeResult = {
  text: string;
  latencyMs: number;
  /** Média dos logprobs por token quando `include: ["logprobs"]` foi pedido e
   * o upstream respondeu com eles; null caso contrário. Proxy de confiança:
   * mais próximo de 0 = decodificação confiante. */
  avgLogprob: number | null;
};

export type LLMFailure =
  | { kind: "fetch"; message: string }
  | { kind: "http"; status: number; message: string; snippet: string; latencyMs: number };

export type Result<T> = { ok: true; data: T } | { ok: false; error: LLMFailure };

/**
 * OpenAI's 429 response body carries a "Please try again in Xs" hint. Pull
 * it out so backoff can wait roughly the right amount instead of guessing.
 * Returns milliseconds, or null if the hint isn't present.
 */
function parseRetryAfterMs(body: string): number | null {
  const match = /try again in (\d+(?:\.\d+)?)(ms|s)/i.exec(body);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2].toLowerCase() === "ms" ? value : value * 1000;
}

/**
 * Call the OpenAI Chat Completions endpoint. Wraps fetch with an abort-based
 * timeout and returns a Result so callers can format their own error responses
 * and success logs. Does no logging itself — the calling route owns that.
 *
 * 429 (rate limit) responses are retried up to twice with the delay the
 * OpenAI error message suggests (or a small linear backoff). Under a busy
 * live session — extract + suggest + parallel verse fetches — TPM is easy
 * to bump into; a short wait usually clears it far cheaper than surfacing
 * an empty payload to the UI.
 */
export async function callChat(params: ChatParams): Promise<Result<ChatResult>> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let upstream: Response;
  let raw = "";
  const maxAttempts = 3;
  try {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        upstream = await fetch(CHAT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: params.model,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            response_format: params.responseFormat,
            messages: params.messages,
            store: params.store,
            metadata: params.metadata,
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
      const waitMs = parseRetryAfterMs(raw) ?? 500 * attempt;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  if (!upstream.ok) {
    return {
      ok: false,
      error: {
        kind: "http",
        status: upstream.status,
        message: `upstream ${upstream.status}: ${raw.slice(0, 500)}`,
        snippet: raw.slice(0, 500),
        latencyMs,
      },
    };
  }

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through — content stays empty
  }

  return {
    ok: true,
    data: {
      content: parsed.choices?.[0]?.message?.content?.trim() ?? "",
      finishReason: parsed.choices?.[0]?.finish_reason ?? "",
      usage: {
        promptTokens: parsed.usage?.prompt_tokens,
        completionTokens: parsed.usage?.completion_tokens,
        totalTokens: parsed.usage?.total_tokens,
        cachedTokens: parsed.usage?.prompt_tokens_details?.cached_tokens,
      },
      latencyMs,
    },
  };
}

/**
 * Call the OpenAI Audio Transcriptions endpoint. Same contract as callChat.
 */
export async function callTranscribe(params: TranscribeParams): Promise<Result<TranscribeResult>> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const form = new FormData();
  form.append("file", params.file, params.filename);
  form.append("model", params.model);
  if (params.language) form.append("language", params.language);
  form.append("response_format", "json");
  if (params.prompt) form.append("prompt", params.prompt);
  for (const inc of params.include ?? []) form.append("include[]", inc);

  let upstream: Response;
  try {
    upstream = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}` },
      body: form,
    });
  } catch (err) {
    return {
      ok: false,
      error: { kind: "fetch", message: (err as Error).message ?? "network error" },
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    return {
      ok: false,
      error: {
        kind: "http",
        status: upstream.status,
        message: `upstream ${upstream.status}: ${raw.slice(0, 500)}`,
        snippet: raw.slice(0, 500),
        latencyMs,
      },
    };
  }

  let parsed: { text?: string; logprobs?: { logprob?: number }[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { text: raw };
  }

  const logprobs = Array.isArray(parsed.logprobs)
    ? parsed.logprobs.map((l) => l?.logprob).filter((v): v is number => Number.isFinite(v))
    : [];
  const avgLogprob =
    logprobs.length > 0 ? logprobs.reduce((a, b) => a + b, 0) / logprobs.length : null;

  return { ok: true, data: { text: parsed.text ?? "", latencyMs, avgLogprob } };
}
