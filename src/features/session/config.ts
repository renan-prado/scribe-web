/**
 * Session-wide tuning constants. These control how the recorder + LLM
 * pipelines pace themselves during a live recording. Keep the units in the
 * name (Ms, Chars) so callers don't need to guess.
 */

export const SILENCE_RMS_THRESHOLD = 0.005;

/**
 * "Extract" pulls from what the speaker actually said (cited verses, speaker
 * highlights, third-party citations attributed live). It runs on every chunk
 * so a quoted verse or a marquee phrase shows up in the feed nearly
 * immediately.
 */
export const EXTRACT_EVERY_N_CHUNKS = 1;

/**
 * "Suggest" is AI-authored enrichment (related verses, historical/linguistic
 * context, suggested quotes). It benefits from a bit of accumulated context
 * before the first fire, but shouldn't lag too far behind extract — the
 * listener is hearing the intro right now.
 */
export const SUGGEST_EVERY_N_CHUNKS = 2;
export const SUGGEST_WARMUP_CHUNKS = 1;

/**
 * Cap the transcript sent to extract/suggest. Two reasons: (1) cost/latency,
 * (2) the model must stay anchored to the CURRENT moment of the talk — items
 * about things that were mentioned 5+ minutes ago and dropped confuse the
 * listener. ~3000 chars ≈ 2-3 minutes of speech, which is the window we want
 * the AI thinking inside of.
 */
export const RECENT_TRANSCRIPT_CHARS = 3000;

/**
 * Minimum growth of the transcript tail (in chars) between two extract/suggest
 * calls. With 8s chunks a speaker produces ~80–120 chars of speech, so the
 * thresholds are set below that floor to avoid skipping real content.
 * Extract fires every chunk; suggest every 2 chunks (~16s) so its bar is
 * slightly higher to avoid firing on almost-identical context.
 */
export const EXTRACT_MIN_TAIL_DELTA_CHARS = 40;
export const SUGGEST_MIN_TAIL_DELTA_CHARS = 80;

/**
 * Minimum spacing between two feed cards becoming visible. The extract/suggest
 * pipelines may return 2+ items in a single burst; a client-side drip queue
 * spreads them out so the listener has time to read each one instead of being
 * flooded.
 */
export const FEED_MIN_GAP_MS = 3500;

// Smaller chunks reduce the lag between the speaker saying something and the
// first extract/suggest firing on it. 8s min gives Whisper enough audio to
// transcribe accurately while keeping latency under 10s in practice.
// Max stays at 20s so a sentence that runs long doesn't wait indefinitely.
export const RECORDER_MIN_CHUNK_MS = 8_000;
export const RECORDER_MAX_CHUNK_MS = 20_000;
export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;

export const TICK_INTERVAL_MS = 250;
