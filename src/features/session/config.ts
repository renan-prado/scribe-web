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
export const EXTRACT_EVERY_N_CHUNKS = 2;
// During reading mode the recorder cuts chunks smaller (4-8s), so firing
// extract on every chunk means firing every 4-8s — which at ~4500 tokens
// per call blows past gpt-4o's 30k TPM. Firing every 2 chunks (~8-16s) is
// comparable to the non-reading cadence and stays under the tier limit.
export const EXTRACT_EVERY_N_CHUNKS_READING = 1;

/**
 * "Suggest" is AI-authored enrichment (related verses, historical/linguistic
 * context, suggested quotes). It benefits from a bit of accumulated context
 * before the first fire, but shouldn't lag too far behind extract — the
 * listener is hearing the intro right now.
 */
export const SUGGEST_EVERY_N_CHUNKS = 3;
export const SUGGEST_WARMUP_CHUNKS = 3;

/**
 * Cap the transcript sent to extract/suggest. Two reasons: (1) cost/latency,
 * (2) the model must stay anchored to the CURRENT moment of the talk — items
 * about things that were mentioned 5+ minutes ago and dropped confuse the
 * listener. ~3000 chars ≈ 2-3 minutes of speech, which is the window we want
 * the AI thinking inside of.
 */
export const RECENT_TRANSCRIPT_CHARS = 2500;

/**
 * Minimum growth of the transcript tail (in chars) between two extract/suggest
 * calls. With 12s chunks a speaker produces ~120–180 chars of speech; the
 * threshold is set below that floor so meaningful growth still fires. Raised
 * from 40 → 120 because extract was firing on chunks that added almost no
 * new material and burning tokens for no yield.
 */
export const EXTRACT_MIN_TAIL_DELTA_CHARS = 120;
export const SUGGEST_MIN_TAIL_DELTA_CHARS = 240;

/**
 * Every time the visible feed accumulates a run of this many AI-authored
 * cards without a speaker-origin card breaking it up, the client fires
 * /api/sermon-echo to pull one literal phrase from the speaker. The exact
 * threshold is sorted uniformly in [MIN, MAX] on each fire so the cadence
 * doesn't feel mechanical.
 *
 * ECHO_MIN_TAIL_DELTA_CHARS gates the fire: if the transcript tail hasn't
 * grown meaningfully since the last echo request, there's no fresh material
 * to echo — skip and save the tokens.
 */
export const ECHO_STREAK_MIN = 3;
export const ECHO_STREAK_MAX = 6;
export const ECHO_MIN_TAIL_DELTA_CHARS = 200;

/**
 * Minimum spacing between two feed cards becoming visible. The extract/suggest
 * pipelines may return 2+ items in a single burst; a client-side drip queue
 * spreads them out so the listener has time to read each one instead of being
 * flooded.
 */
export const FEED_MIN_GAP_MS = 60000; // 60s

// Chunk cadence trades cost for feed latency. Raised from 8s→12s min and
// 30s→40s max after profiling showed extract dominated cost with only
// marginal freshness benefit at the tighter cadence — the FEED_MIN_GAP_MS
// drip already spaces cards at 60s, so firing extract every 8s just wasted
// tokens on chunks that never made it to the user faster.
export const RECORDER_MIN_CHUNK_MS = 12_000;
export const RECORDER_MAX_CHUNK_MS = 40_000;

// Reading mode still cuts smaller so the passage card can grow verse-by-verse
// in near-real time, but bumped from 4s→6s min and 8s→12s max to match the
// same cost-tightening pass. Whisper still gets enough audio since reading
// cadence is slow and diction is deliberate.
export const RECORDER_MIN_CHUNK_MS_READING = 6_000;
export const RECORDER_MAX_CHUNK_MS_READING = 12_000;

// During an active reading, the passage card silently prefetches this many
// verses beyond the confirmed end so that when extract grows the range, the
// new verses render instantly from cache. Each unit costs one /api/verse call.
export const LIVE_READING_LOOKAHEAD_PREFETCH = 6;

// Grace period before an "active" reading passage collapses its lookahead
// verses. Extract's readingMode can briefly flip false between verses (a
// pause, a short interjection, transcription noise) — collapsing on the
// first false would hide verses mid-passage. Only when readingMode stays
// false for this long do we treat the passage as truly ended.
export const LIVE_READING_ACTIVE_GRACE_MS = 15_000;
export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;

export const TICK_INTERVAL_MS = 300;
