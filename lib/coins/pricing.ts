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
  /** Per started minute of live recording. */
  liveMinute: 5,
  /** Per started minute of audio-only recording. */
  audioOnlyMinute: 2,
  /** Per started minute of transcript-only recording (no LLM beyond STT). */
  transcriptMinute: 1,
  /** One-shot cost of running /api/deepening. */
  deepening: 5,
  /** One-shot cost of re-running /api/final-summary/reprocess on a saved session. */
  reprocessSummary: 5,
  /** One-shot cost of re-running /api/deepening/reprocess on an existing study. */
  reprocessDeepening: 5,
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
