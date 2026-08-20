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
export const SUGGEST_WARMUP_CHUNKS = 2;

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

// While the speaker is reading Scripture verbatim (readingMode=true), the
// listener is watching a single verse card grow to match the passage being
// read. Cutting chunks sooner lets the extract fire more often on each new
// verse, so the range card catches up in near-real time. Whisper still gets
// enough audio because reading cadence is slow and diction is deliberate.
export const RECORDER_MIN_CHUNK_MS_READING = 4_000;
export const RECORDER_MAX_CHUNK_MS_READING = 8_000;

// During an active reading, the passage card renders verses BEYOND what the
// extract has confirmed so far — a sliding "look ahead" that fills instantly
// (from cache) when the pastor actually arrives at those verses. VISIBLE is
// what we render on-screen; PREFETCH warms the cache one buffer further out
// so the next visible expansion is also instant. Each unit costs one
// /api/verse call.
export const LIVE_READING_LOOKAHEAD_VISIBLE = 6;
export const LIVE_READING_LOOKAHEAD_PREFETCH = 6;

// Grace period before an "active" reading passage collapses its lookahead
// verses. Extract's readingMode can briefly flip false between verses (a
// pause, a short interjection, transcription noise) — collapsing on the
// first false would hide verses mid-passage. Only when readingMode stays
// false for this long do we treat the passage as truly ended.
export const LIVE_READING_ACTIVE_GRACE_MS = 15_000;
export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;

export const TICK_INTERVAL_MS = 250;
