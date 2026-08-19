/**
 * Session-wide tuning constants. These control how the recorder + LLM
 * pipelines pace themselves during a live recording. Keep the units in the
 * name (Ms, Chars) so callers don't need to guess.
 */

export const SILENCE_RMS_THRESHOLD = 0.005;

export const SUMMARY_WARMUP_CHUNKS = 3;
export const SUMMARY_EVERY_N_CHUNKS = 1;

export const INSIGHTS_EVERY_N_CHUNKS = 5;

export const CONSOLIDATE_EVERY_N_CHUNKS = 6;
export const CONSOLIDATE_PULSE_MS = 5000;

/**
 * Cap the transcript sent to summarize/insights so long recordings don't
 * balloon the prompt (and cost/latency). The previousSummary already carries
 * older context — the model only needs the recent tail to keep going.
 */
export const RECENT_TRANSCRIPT_CHARS = 6000;

export const RECORDER_MIN_CHUNK_MS = 20_000;
export const RECORDER_MAX_CHUNK_MS = 45_000;
export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;

export const TICK_INTERVAL_MS = 250;
