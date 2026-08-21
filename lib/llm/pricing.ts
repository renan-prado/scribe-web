/**
 * OpenAI list prices (USD) for the models this app uses. Prices change; when
 * OpenAI updates them, edit this table and past rows in llm_usage_events stay
 * historically accurate (they store the resolved cost, not the model name
 * alone). Values are per 1,000,000 tokens for chat, per audio-minute for STT.
 *
 * Sources checked against https://platform.openai.com/pricing. Keep both
 * canonical IDs and the aliases we see in serverEnv.OPENAI_*_MODEL defaults.
 */

export type ChatPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

export type AudioPricing = {
  perMinute: number;
};

const CHAT_PRICES: Record<string, ChatPricing> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-2024-11-20": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-2024-08-06": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o-mini-2024-07-18": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gpt-5": { inputPer1M: 5, outputPer1M: 15 },
  "gpt-5-mini": { inputPer1M: 0.5, outputPer1M: 2 },
};

const AUDIO_PRICES: Record<string, AudioPricing> = {
  "whisper-1": { perMinute: 0.006 },
  "gpt-4o-transcribe": { perMinute: 0.006 },
  "gpt-4o-mini-transcribe": { perMinute: 0.003 },
  // Env default is the alias "gpt-transcribe" — treat as the full model.
  "gpt-transcribe": { perMinute: 0.006 },
};

export type ChatCost = {
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
};

export function computeChatCost(
  model: string,
  promptTokens: number | undefined,
  completionTokens: number | undefined
): ChatCost {
  const price = CHAT_PRICES[model];
  if (!price) {
    return { inputUsd: 0, outputUsd: 0, totalUsd: 0 };
  }
  const pt = promptTokens ?? 0;
  const ct = completionTokens ?? 0;
  const inputUsd = (pt / 1_000_000) * price.inputPer1M;
  const outputUsd = (ct / 1_000_000) * price.outputPer1M;
  return { inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

export function computeAudioCost(model: string, seconds: number): number {
  const price = AUDIO_PRICES[model];
  if (!price || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return (seconds / 60) * price.perMinute;
}

export function hasChatPricing(model: string): boolean {
  return model in CHAT_PRICES;
}

export function hasAudioPricing(model: string): boolean {
  return model in AUDIO_PRICES;
}
