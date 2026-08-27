/**
 * Coin ("moeda") pricing — the single source of truth mirrored by the
 * corresponding SQL migration (0012_coin_balance.sql). Client-safe: this
 * module is imported by both the API routes and the UI so the price shown on
 * a button matches the amount the server actually debits.
 *
 * Every account starts with 100 coins. Recording modes are billed per
 * started minute (ceil), ticked from the client every 60s. Aprofundar is a
 * flat single-shot charge inside POST /api/deepening.
 */

export const INITIAL_COIN_BALANCE = 100;

export const COIN_COSTS = {
  /** Per started minute of live recording. */
  liveMinute: 10,
  /** Per started minute of audio-only recording. */
  audioOnlyMinute: 3,
  /** One-shot cost of running /api/deepening. */
  deepening: 10,
  /** One-shot cost of re-running /api/final-summary/reprocess on a saved session. */
  reprocessSummary: 10,
  /** One-shot cost of re-running /api/deepening/reprocess on an existing study. */
  reprocessDeepening: 10,
} as const;

/**
 * Reason strings persisted in coin_transactions.reason. The server maps each
 * reason to its cost in COIN_COST_BY_REASON — clients never send an amount.
 */
export const CHARGE_REASONS = [
  "live_minute",
  "audio_only_minute",
  "deepening",
  "reprocess_summary",
  "reprocess_deepening",
] as const;
export type ChargeReason = (typeof CHARGE_REASONS)[number];

export const COIN_COST_BY_REASON: Record<ChargeReason, number> = {
  live_minute: COIN_COSTS.liveMinute,
  audio_only_minute: COIN_COSTS.audioOnlyMinute,
  deepening: COIN_COSTS.deepening,
  reprocess_summary: COIN_COSTS.reprocessSummary,
  reprocess_deepening: COIN_COSTS.reprocessDeepening,
};

export function isChargeReason(value: unknown): value is ChargeReason {
  return typeof value === "string" && (CHARGE_REASONS as readonly string[]).includes(value);
}
