/**
 * Coin ("moeda") pricing — the single source of truth mirrored by the
 * corresponding SQL migration (0017_coin_balance.sql / 0026_billing_stripe.sql).
 * Client-safe: this module is imported by both the API routes and the UI so
 * the price shown on a button matches the amount the server actually debits.
 *
 * Recording modes are billed per started minute (ceil), ticked from the client
 * every 60s. Aprofundar is a flat single-shot charge inside POST /api/deepening.
 *
 * NOTE: this file governs SPENDING only. Crediting lives in lib/billing/* and
 * only ever happens server-side from a verified Stripe webhook.
 */

/** Grant given to a brand-new account. Mirrors the DEFAULT on
 * profiles.coin_balance set in migration 0026. */
export const INITIAL_COIN_BALANCE = 50;

/**
 * Reference used by the coin ring/gauge in the UI to decide "how full" the
 * balance looks. Deliberately NOT the signup grant: since a plan tops the
 * account up to 1.000+ credits, anchoring the gauge to 50 would peg it at
 * 100% forever. 300 ≈ one hour of Modo Estudo, which is the amount that
 * actually feels like "a full tank" to a user about to record.
 */
export const COIN_RING_REFERENCE = 300;

export const COIN_COSTS = {
  /**
   * Per started minute of live recording.
   *
   * 7 e não 5: medido sobre a janela do painel, o minuto ao vivo fechava 63%
   * de margem contra o alvo de 70% da régua. Ele paga transcrição MAIS os três
   * pipelines do feed — é o minuto mais caro do produto, e era o mais barato
   * por moeda.
   */
  liveMinute: 7,
  /**
   * Per started minute of audio-only recording.
   *
   * 6 e não 2: a 2 moedas o minuto de áudio fechava 24,5% de margem — cada
   * milheiro de moeda debitado custava R$ 10,01 de OpenAI contra os R$ 5,97
   * que o alvo comporta. O modo dispensa o feed, mas NÃO dispensa a
   * transcrição nem o resumo final, que é onde o dinheiro está; cobrar menos
   * da metade do ao vivo era supor uma economia que a medição não mostrou.
   * Amostra de 50 execuções — vale reconferir quando ela crescer.
   */
  audioOnlyMinute: 6,
  /** Per started minute of transcript-only recording (no LLM beyond STT). */
  transcriptMinute: 1,
  /**
   * One-shot cost of running /api/deepening.
   *
   * 50 e não 5: o estudo deixou de ser uma chamada de LLM e virou um pipeline
   * de cinco etapas — três delas num modelo de raciocínio — que produz um
   * artigo de três a quatro mil palavras e leva perto de quatro minutos. É a
   * ação mais cara do produto por uma ordem de grandeza, e a única restrita a
   * um plano (ver lib/entitlements/features.ts).
   */
  deepening: 50,
  /**
   * One-shot cost of re-running /api/final-summary/reprocess on a saved
   * session.
   *
   * 15 e não 5: a 5 moedas o reprocessamento rodava NO PREJUÍZO (−5,4% de
   * margem) — ele reexecuta o resumo inteiro sobre a transcrição completa,
   * num modelo grande, e 5 moedas não pagavam a chamada. A régua pedia 18
   * para fechar os 70%; 15 é a decisão do produto, e deixa a margem em ~65%.
   */
  reprocessSummary: 15,
  /**
   * Reprocessar roda o MESMO pipeline do zero, então custa o mesmo. Deixá-lo
   * mais barato que a geração abriria uma arbitragem óbvia: gerar uma vez pelo
   * preço cheio e reprocessar indefinidamente pelo preço de banana, pagando 5
   * por um trabalho de 50.
   */
  reprocessDeepening: 50,
} as const;

/**
 * Reason strings persisted in coin_transactions.reason. The server maps each
 * reason to its cost in COIN_COST_BY_REASON — clients never send an amount.
 */
export const CHARGE_REASONS = [
  "live_minute",
  "audio_only_minute",
  "transcript_minute",
  "deepening",
  "reprocess_summary",
  "reprocess_deepening",
] as const;
export type ChargeReason = (typeof CHARGE_REASONS)[number];

export const COIN_COST_BY_REASON: Record<ChargeReason, number> = {
  live_minute: COIN_COSTS.liveMinute,
  audio_only_minute: COIN_COSTS.audioOnlyMinute,
  transcript_minute: COIN_COSTS.transcriptMinute,
  deepening: COIN_COSTS.deepening,
  reprocess_summary: COIN_COSTS.reprocessSummary,
  reprocess_deepening: COIN_COSTS.reprocessDeepening,
};

export function isChargeReason(value: unknown): value is ChargeReason {
  return typeof value === "string" && (CHARGE_REASONS as readonly string[]).includes(value);
}
