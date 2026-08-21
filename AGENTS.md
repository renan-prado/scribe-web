<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project overview

scribe-web is a live sermon/lecture transcription + summarization app. A recorder emits ~30s audio chunks that stream through OpenAI-backed API routes:
- LIVE (while recording): `transcribe` on every chunk. Two enrichment pipelines then run in parallel with very different cadences:
  - `bible` (fast, regex-gated) — only emits `citedVerse`. A cheap regex on the transcript tail (`lib/bible/detect.ts`) decides whether the LLM is even called; while `readingMode` is on the gate is bypassed so the passage card can keep expanding as the pastor reads more verses.
  - `insights` (slow, ~45s interval) — emits the other five kinds (`speakerHighlight`, `speakerCitation`, `relatedVerse`, `context`, `suggestedQuote`). Paused while `readingMode` is on.
  - `sermon-echo` (streak-based) — injects a single verbatim `speakerEcho` phrase whenever the feed accumulates too many AI-authored cards in a row.
  Items append to a scroll feed — nothing is rewritten.
- FINAL (after stop): `final-summary` runs once, consuming the full transcript AND the curated feed items, producing the definitive structured summary rendered by SummaryView.
- ALSO: `verse` (on-click bible lookup dialog) and `format-paragraphs` (transcript display).

Stack: Next.js 16 (App Router), React 19, Supabase SSR, Tailwind v4 + shadcn/base-ui components, Biome, Zod.

## Folder layout

```
app/
  api/{transcribe,bible,insights,sermon-echo,final-summary,verse,format-paragraphs}/route.ts
  (app)/recording/[id]/live/page.tsx — the recording session page (orchestration only)
  page.tsx                      — landing that links into the app
  layout.tsx, globals.css
components/ui/                  — shadcn primitives (Dialog, DropdownMenu, Button)
lib/
  bible/detect.ts               — regex-gate that decides whether /api/bible is called
  env/{server,client}.ts        — Zod-parsed env vars (throw at import)
  domain/{summary,feed,verse,recorder}.ts
                                — shared types + Zod schemas + parseXxxFromLLM helpers
  llm/openai.ts                 — callChat / callTranscribe (Result<T>, AbortController timeout)
  prompts/*.ts                  — system prompts as exported constants
  supabase/{server,client}.ts
  recorder.ts                   — MediaRecorder + VAD factory (createRecorder)
  vocabulario.ts                — biblical books + theology vocab for the STT prompt
  utils.ts                      — cn()
src/features/session/
  components/*.tsx              — every UI piece of the recording page (Feed + FeedItemCard
                                  drive the live view; SummaryView renders the post-stop
                                  final payload)
  hooks/                        — useElapsedTimer, useWakeLock, useVisibilityWarning, useVerseFetch
  lib/                          — audio (isSilentBlob), text (tail/format), chunks (grouping),
                                  api (typed fetch wrappers)
  config.ts                     — pacing constants (chunk cadences, insights interval, deltas, timeouts)
  types.ts                      — ChunkRow, FinalAudio, TranscriptState, VerseFetchState
```

## Import rules

- `@/*` resolves to both `./*` and `./src/*` (see `tsconfig.json`). Prefer the most specific path.
- **Client code MUST NOT import from `app/api/*/route.ts`.** All shared types live in `lib/domain/`; the API route files only re-export them for backward compat during the refactor.
- **Server-only env vars** (`OPENAI_API_KEY`, model overrides) come from `@/lib/env/server` — never reference `process.env.OPENAI_*` directly.
- **Client-safe env vars** (`NEXT_PUBLIC_SUPABASE_*`) come from `@/lib/env/client`.
- **Every OpenAI call** goes through `callChat` / `callTranscribe` in `@/lib/llm/openai`. Do not call `fetch("https://api.openai.com/...")` from a route.
- **Every system prompt** lives in `lib/prompts/*` as an exported constant, not inline.
- **LLM response parsing** lives in `lib/domain/*` as `parseXxxFromLLM(content, ...)`. Do not re-implement JSON.parse + shape guards in routes.

## Adding a new feature

- **New API route calling OpenAI**: (1) add a prompt in `lib/prompts/foo.ts`, (2) add the schema + `parseFooFromLLM` in `lib/domain/foo.ts`, (3) create `app/api/foo/route.ts` that reads env from `serverEnv`, invokes `callChat({...})`, and delegates parsing to the domain helper. Log `[foo] ok { latencyMs, finishReason, promptTokens, completionTokens, ... }` on success and `[foo] upstream {fetch failed|error}` on failure.
- **New UI element for the session page**: put it under `src/features/session/components/`. Keep `app/(app)/recording/[id]/live/page.tsx` as pure orchestration. Pure helpers go to `src/features/session/lib/`; reusable stateful behaviour goes to `src/features/session/hooks/`.
- **New env var**: add to the Zod schema in `lib/env/server.ts` (or `client.ts`) — this is intentionally strict so a missing var fails at boot, not on the first request.

## What is deliberately NOT here yet

Do not add these unprompted (the user is aware and defers them):
- Authentication on `/api/*` routes.
- Rate limiting.
- Streaming (SSE) responses.
- Dark mode wiring (the `.dark` selector exists in `globals.css` but no toggle applies it).
- A test runner or tests.
- An i18n framework — pt-BR strings live inline for now; extraction can wait.

## Commands

- `npm run dev` — Next dev server.
- `npm run typecheck` — `tsc --noEmit`. Run this before commits.
- `npm run check` — Biome check + write (imports, format, lint).
- `npm run lint` / `npm run format` — Biome subcommands.

## Behaviour-preservation guardrails

The session page runs two live pipelines coordinated by flight-flag booleans (`bibleInFlight`, `insightsInFlight`, `finalizing`):
- **`bible`** fires per-chunk, gated by `hasBibleMention(recentTail)` (see `lib/bible/detect.ts`) OR by the current `readingMode`. The regex tolerates missing accents, ordinal variants (`1`, `I`, `primeiro`), and also fires on the reading triggers `capítulo` / `versículo` / `verso` even when no book name shows up in the chunk (contextual anchoring during a reading).
- **`insights`** fires on a `setInterval(INSIGHTS_INTERVAL_MS)` — currently 45s. It's paused while `readingMode` is on and has a `INSIGHTS_MIN_TAIL_DELTA_CHARS` gate so ticks in near-silence no-op.
Both pipelines are ADDITIVE — they only append to `feedItems`; nothing is rewritten or reordered mid-recording. Client-side dedup via `feedItemDedupKey` protects against equivalent items landing from overlapping calls. When touching `RecordingLive.tsx`, keep the guard predicates and dependency arrays intact unless the change is intentional.

**Do not merge `bible` back into `insights` or vice-versa.** They exist as separate routes because their cost/latency profiles are fundamentally different: `bible` needs to appear on screen the moment the pastor starts reading (low-latency, cheap because regex-gated); `insights` needs accumulated context and can wait (higher-latency, tolerated because slower cadence bounds cost). `citedVerse` is exclusive to `/api/bible`; the other five kinds are exclusive to `/api/insights`.

Exception to "additive only" — RANGE SUPERSEDE for `citedVerse`: when an incoming reference strictly contains an already-visible one (same book/chapter, wider verse span — e.g., `Tiago 1:1-4` arrives while `Tiago 1:1` is visible), the narrower card is removed so a single card tracks the passage as the pastor reads. Containment is asymmetric: chapter-only refs never cover verse-specific refs (`João 4` does NOT supersede `João 4:7`), matching the bible-prompt rule. See `referenceStrictlyContains` in `lib/domain/feed.ts`.

Reading-mode fast path: while `readingMode` is true, `citedVerse` items bypass the `FEED_MIN_GAP_MS` drip queue and append immediately. The drip exists to space out NEW cards for readability; a verse card whose range is expanding isn't new from the listener's viewpoint, so gating it just adds felt lag. The recorder also switches to `RECORDER_MIN_CHUNK_MS_READING` / `RECORDER_MAX_CHUNK_MS_READING` (via `setChunkTiming`) while `readingMode` is on so `bible` fires more often on each new verse. Insights stays paused during reading — the listener is meant to be focused on Scripture, not distracted by AI enrichment.

The final summary is single-shot: on stop, `/api/final-summary` runs once with the full transcript + accumulated `feedItems`. The prompt treats the feed as high-priority curated context (cited verses and speaker highlights must carry through; AI suggestions are kept only if they still fit the whole).

Visual convention in the feed: cards for items ORIGINATED from the speaker (`citedVerse`, `speakerHighlight`, `speakerCitation`) use the quote-gradient surface; cards for AI-authored items (`relatedVerse`, `context`, `suggestedQuote`) use a dashed outlined surface. Origin is derived from `kind` via `feedItemOrigin`; do not add an explicit `origin` field.

The recorder's `startedAtRef` is seeded by `start()` *before* flipping `setRunning(true)` so `useElapsedTimer` observes a valid origin on first render. Preserve this order.
