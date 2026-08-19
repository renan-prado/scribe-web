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
};

export type TranscribeParams = {
  model: string;
  file: Blob;
  filename: string;
  prompt?: string;
  language?: string;
  timeoutMs?: number;
};

export type TranscribeResult = {
  text: string;
  latencyMs: number;
};

export type LLMFailure =
  | { kind: "fetch"; message: string }
  | { kind: "http"; status: number; message: string; snippet: string; latencyMs: number };

export type Result<T> = { ok: true; data: T } | { ok: false; error: LLMFailure };

/**
 * Call the OpenAI Chat Completions endpoint. Wraps fetch with an abort-based
 * timeout and returns a Result so callers can format their own error responses
 * and success logs. Does no logging itself — the calling route owns that.
 */
export async function callChat(params: ChatParams): Promise<Result<ChatResult>> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let upstream: Response;
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
      }),
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

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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

  let parsed: { text?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { text: raw };
  }

  return { ok: true, data: { text: parsed.text ?? "", latencyMs } };
}
