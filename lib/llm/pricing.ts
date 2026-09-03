/**
 * OpenAI list prices (USD) for the models this app uses. Prices change; when
 * OpenAI updates them, edit this table and past rows in llm_usage_events stay
 * historically accurate (they store the resolved cost, not the model name
 * alone). Values are per 1,000,000 tokens for chat, per audio-minute for STT.
 *
 * Sources checked against https://developers.openai.com/api/docs/pricing.
 * Keep both canonical IDs and the aliases we see in serverEnv.OPENAI_*_MODEL
 * defaults.
 *
 * **Um modelo que falta aqui não custa zero — ele custa e o painel não vê.**
 * `computeChatCost` devolve 0 para modelo desconhecido, e esse zero entra no
 * banco como se fosse medição. Foi o que aconteceu com o gpt-5.1, padrão das
 * três etapas do estudo e do próprio analista do /admin desde que existem:
 * toda margem calculada sobre essas rotas saiu inflada. Ao trocar o default de
 * um `OPENAI_*_MODEL` em lib/env/server.ts, confira que o modelo novo está
 * nesta tabela ANTES do deploy — o painel avisa (`unpricedModels`), mas só
 * depois de o dinheiro já ter sido gasto.
 */

export type ChatPricing = {
  inputPer1M: number;
  /**
   * Preço do token de entrada que bateu no cache automático da OpenAI. NÃO é
   * uma fração fixa do de entrada: é 50% no 4o, 25% na família 4.1 e 10% na
   * família 5. Era uma constante única de 50% aqui, e ela superestimava o
   * custo de toda rota com prompt grande e estável — que são justamente as do
   * feed ao vivo, onde a margem é decidida.
   */
  cachedInputPer1M: number;
  outputPer1M: number;
};

export type AudioPricing = {
  perMinute: number;
};

const CHAT_PRICES: Record<string, ChatPricing> = {
  "gpt-4o": { inputPer1M: 2.5, cachedInputPer1M: 1.25, outputPer1M: 10 },
  "gpt-4o-2024-11-20": { inputPer1M: 2.5, cachedInputPer1M: 1.25, outputPer1M: 10 },
  "gpt-4o-2024-08-06": { inputPer1M: 2.5, cachedInputPer1M: 1.25, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, cachedInputPer1M: 0.075, outputPer1M: 0.6 },
  "gpt-4o-mini-2024-07-18": { inputPer1M: 0.15, cachedInputPer1M: 0.075, outputPer1M: 0.6 },
  "gpt-4.1": { inputPer1M: 2, cachedInputPer1M: 0.5, outputPer1M: 8 },
  "gpt-4.1-mini": { inputPer1M: 0.4, cachedInputPer1M: 0.1, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, cachedInputPer1M: 0.025, outputPer1M: 0.4 },
  "gpt-5": { inputPer1M: 1.25, cachedInputPer1M: 0.125, outputPer1M: 10 },
  "gpt-5-mini": { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 2 },
  // Os três passos do estudo (perguntar, responder, escrever) e o analista do
  // /admin. Ver OPENAI_STUDY_*_MODEL e OPENAI_ADMIN_INSIGHTS_MODEL.
  "gpt-5.1": { inputPer1M: 1.25, cachedInputPer1M: 0.125, outputPer1M: 10 },
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
  completionTokens: number | undefined,
  cachedTokens: number | undefined = 0
): ChatCost {
  const price = CHAT_PRICES[model];
  if (!price) {
    return { inputUsd: 0, outputUsd: 0, totalUsd: 0 };
  }
  const pt = promptTokens ?? 0;
  const ct = completionTokens ?? 0;
  // usage.prompt_tokens_details.cached_tokens é SUBCONJUNTO de prompt_tokens
  // (não se soma a ele), então o token fresco é a diferença.
  const cached = Math.min(cachedTokens ?? 0, pt);
  const fresh = pt - cached;
  const inputUsd =
    (fresh / 1_000_000) * price.inputPer1M + (cached / 1_000_000) * price.cachedInputPer1M;
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
