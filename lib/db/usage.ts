import "server-only";
import {
  type ChatCost,
  computeAudioCost,
  computeChatCost,
  hasAudioPricing,
  hasChatPricing,
} from "@/lib/llm/pricing";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist a single upstream LLM call into public.llm_usage_events.
 *
 * These helpers are fire-and-forget: routes await them so ordering in tests
 * is deterministic, but any insert failure is caught and logged — a broken
 * observability write must never surface as a 500 from a working /extract
 * or /transcribe.
 *
 * user_id is injected from the authenticated Supabase session (routes call
 * requireAuth() first); RLS then enforces that the row is written under the
 * correct owner. session_id is optional — on-demand routes (format,
 * lookups) run outside a recording.
 */

export type UsageRoute =
  | "bible"
  | "insights"
  | "sermon-echo"
  | "final-summary"
  | "format-paragraphs"
  | "transcribe";

export type RecordChatUsageInput = {
  sessionId: string | null;
  route: UsageRoute;
  model: string;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  cachedTokens: number | undefined;
  latencyMs: number;
};

export type RecordAudioUsageInput = {
  sessionId: string | null;
  route: Extract<UsageRoute, "transcribe">;
  model: string;
  audioSeconds: number;
  latencyMs: number;
};

export async function recordChatUsage(input: RecordChatUsageInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const cost: ChatCost = computeChatCost(
      input.model,
      input.promptTokens,
      input.completionTokens,
      input.cachedTokens
    );
    if (!hasChatPricing(input.model)) {
      console.warn("[usage] no chat pricing for model", { model: input.model });
    }

    const prompt = input.promptTokens ?? null;
    const completion = input.completionTokens ?? null;
    const cached = input.cachedTokens ?? null;
    const total = prompt !== null && completion !== null ? prompt + completion : null;

    const { error } = await supabase.from("llm_usage_events").insert({
      user_id: user.id,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cached_tokens: cached,
      total_tokens: total,
      audio_seconds: null,
      input_cost_usd: cost.inputUsd,
      output_cost_usd: cost.outputUsd,
      total_cost_usd: cost.totalUsd,
      latency_ms: input.latencyMs,
    });
    if (error) {
      console.error("[usage] insert failed", { route: input.route, error: error.message });
    }
  } catch (err) {
    console.error("[usage] insert threw", {
      route: input.route,
      error: (err as Error).message,
    });
  }
}

export async function recordAudioUsage(input: RecordAudioUsageInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const totalUsd = computeAudioCost(input.model, input.audioSeconds);
    if (!hasAudioPricing(input.model)) {
      console.warn("[usage] no audio pricing for model", { model: input.model });
    }

    const { error } = await supabase.from("llm_usage_events").insert({
      user_id: user.id,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      audio_seconds: Number.isFinite(input.audioSeconds) ? input.audioSeconds : null,
      input_cost_usd: totalUsd,
      output_cost_usd: 0,
      total_cost_usd: totalUsd,
      latency_ms: input.latencyMs,
    });
    if (error) {
      console.error("[usage] insert failed", { route: input.route, error: error.message });
    }
  } catch (err) {
    console.error("[usage] insert threw", {
      route: input.route,
      error: (err as Error).message,
    });
  }
}
