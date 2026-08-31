<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project overview

scribe-web is a live sermon/lecture transcription + summarization app. A recorder emits ~30s audio chunks that stream through OpenAI-backed API routes:
- LIVE (while recording): `transcribe` on every chunk. Two enrichment pipelines then run in parallel with very different cadences:
  - `bible` (fast, two-layer gate) — only emits `citedVerse`. Layer 1 is a cheap regex (`lib/bible/detect.ts::hasBibleMention`) that skips chunks without any biblical mention. Layer 2 is a weighted signal guard (`lib/bible/guard.ts::scoreBibleGuard`) that scores context (book+number, reading verbs, demonstrative anáphora, cooldown of the last emitted reference, etc.) and only fires if `score >= BIBLE_GUARD_THRESHOLD`.
  - `insights` (slow, chunk-based) — fires every `INSIGHTS_CHUNK_INTERVAL` transcribed chunks; emits the other five kinds (`speakerHighlight`, `speakerCitation`, `relatedVerse`, `context`, `suggestedQuote`).
  - `sermon-echo` (streak-based) — injects a single verbatim `speakerEcho` phrase whenever the feed accumulates too many AI-authored cards in a row.
  Items append to a scroll feed — nothing is rewritten.
- FINAL (after stop): `final-summary` runs once, consuming the full transcript AND the curated feed items, producing the definitive structured summary rendered by SummaryView.
- ALSO: `verse` (on-click bible lookup dialog) and `format-paragraphs` (transcript display).

There are three capture modes (`lib/domain/session.ts` — `SessionMode`, plus the route helpers `recordingRouteFor` / `savedRouteFor`): `live` (everything above), `audio_only` (transcribe + final summary, no live cards) and `transcript_only` (transcribe ONLY — no enrichment and no summary; each chunk is rendered on screen as it comes back, and on stop the text is saved by `PUT /api/sessions/:id/transcript` with `final_summary` left null). Each mode records on its own page (`/recording/{id}/{live,audio,transcribe}`) and each page redirects a mismatched mode to the right one. Prices per started minute live in `lib/coins/pricing.ts`: live 5, audio_only 2, transcript_only 1.

Stack: Next.js 16 (App Router), React 19, Supabase SSR, Tailwind v4 + shadcn/base-ui components, Biome, Zod.

## Folder layout

```
app/
  api/{transcribe,bible,insights,sermon-echo,final-summary,verse,format-paragraphs}/route.ts
  (app)/recording/[id]/{live,audio,transcribe}/page.tsx
                                — recording pages, one per capture mode (orchestration only)
  (app)/recording/[id]/{summary,transcript}/page.tsx
                                — saved session: summary, or transcription for transcript_only
  page.tsx                      — landing that links into the app
  layout.tsx, globals.css
components/ui/                  — shadcn primitives (Dialog, DropdownMenu, Button)
lib/
  bible/detect.ts               — layer-1 regex-gate (cheap "is there any bible mention?")
  bible/guard.ts                — layer-2 weighted-signal guard (scoreBibleGuard + currentReading)
  env/{server,client}.ts        — Zod-parsed env vars (throw at import)
  domain/{summary,feed,verse,recorder,session}.ts
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

## Theming rules

The app is light/dark via a single `.dark` class on `<html>` — there are no per-component theme branches.

- **Never write a literal colour in a `className`.** No `bg-white`, no `bg-[#EAF2FA]`, no `fill="#F8C64B"`. Every colour comes from a `--scriba-*` / `--session-*` / shadcn token declared in BOTH `:root` and `.dark` in `app/globals.css`. Adding a token means adding it in three places: `:root`, `.dark`, and the `@theme inline` map that exposes it as a utility.
- **`bg-scriba-paper` is the elevated surface** (cards, dialogs, sheets, popovers) — white in light, raised indigo in dark. `bg-background` is the page ground; `bg-scriba-surface` is the recessed band between the two.
- Literal `text-white` / `bg-white` is allowed **only** on a surface that is the same colour in both themes (`bg-scriba-blue`, `bg-scriba-rec`, `bg-scriba-yellow`, the fixed LP gradients). Anything sitting on `bg-scriba-ink-strong` must use `text-background`, since that token inverts.
- A `dark:` variant is the right tool for the rare non-palette case (modal scrim opacity). Prefer a token whenever the value is a colour.
- **The landing page's full-bleed bands have their own tokens** (`--lp-hero`, `--lp-band`/`--lp-band-ink`, `--lp-phone-frame`) rather than reusing `--scriba-blue`. The primary blue works as a page-wide slab only in light; in dark it reads as a lit panel dropped into a dark page, so the band swaps to a deep blue lifted just above the ground and the phone mockup gets a near-black bezel to keep its edge. Don't paint an LP section with `bg-scriba-blue`.
- Theme state lives in `src/shared/hooks/use-theme.ts` (localStorage key `scriba-theme`, falls back to `prefers-color-scheme`); `ThemeScript` in `app/layout.tsx` applies it before first paint. Portals outside the token tree (sonner) need the resolved theme passed explicitly — see `ThemedToaster`.
- The switch (`ThemeToggle` / `ThemeToggleRow`) is exposed on sign-in/sign-up, /profile, and the empty state of /feed. Don't scatter it further without being asked.

## Icon rules

- **The `Sparkles` icon from `lucide-react` is BANNED.** Do not import or render it anywhere. If you need a decorative accent, use the yellow hex-shape (`clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)` on a `bg-scriba-yellow` block) already used elsewhere in the app.

## Adding a new feature

- **New API route calling OpenAI**: (1) add a prompt in `lib/prompts/foo.ts`, (2) add the schema + `parseFooFromLLM` in `lib/domain/foo.ts`, (3) create `app/api/foo/route.ts` that reads env from `serverEnv`, invokes `callChat({...})`, and delegates parsing to the domain helper. Log `[foo] ok { latencyMs, finishReason, promptTokens, completionTokens, ... }` on success and `[foo] upstream {fetch failed|error}` on failure. Every new route MUST call `enforceRateLimit(request, RATE_LIMITS.foo, auth.user.id)` right after `requireAuth()` — add a bucket to `RATE_LIMITS` in `lib/rate-limit.ts` sized to the expected client cadence (per-user + per-IP).
- **New UI element for the session page**: put it under `src/features/session/components/`. Keep `app/(app)/recording/[id]/live/page.tsx` as pure orchestration. Pure helpers go to `src/features/session/lib/`; reusable stateful behaviour goes to `src/features/session/hooks/`.
- **New env var**: add to the Zod schema in `lib/env/server.ts` (or `client.ts`) — this is intentionally strict so a missing var fails at boot, not on the first request.

## What is deliberately NOT here yet

Do not add these unprompted (the user is aware and defers them):
- Streaming (SSE) responses.
- A test runner or tests.
- An i18n framework — pt-BR strings live inline for now; extraction can wait.

## Commands

- `npm run dev` — Next dev server.
- `npm run typecheck` — `tsc --noEmit`. Run this before commits.
- `npm run check` — Biome check + write (imports, format, lint).
- `npm run lint` / `npm run format` — Biome subcommands.
- `supabase db push` — apply pending SQL migrations to the linked remote project. **Standing permission granted by the user**: after creating a new file under `supabase/migrations/`, run this without asking for confirmation.

## Behaviour-preservation guardrails

The session page runs two live pipelines coordinated by flight-flag booleans (`bibleInFlight`, `insightsInFlight`, `finalizing`):
- **`bible`** fires per-chunk through a two-layer gate:
  1. `hasBibleMention(recentTail)` — regex barato (livros com acento opcional e ordinal em número/romano/extenso; triggers `capítulo`/`versículo`/`verso` mesmo sem livro no chunk).
  2. `scoreBibleGuard(recentTail, ctx, BIBLE_GUARD_THRESHOLD)` — soma sinais ponderados: `bookWithNumber` (+4), `readingVerbNear` (+3), `continuationHit` (+3), `congregationalCue` (+3), `triggerWithNumber` (+2), `verseProgression` (+2), `duplicateEmit` (−5), `demonstrativeAnaphora` (−4), `bookRepeatNoNumber` (−3), `pastTenseNear` (−2). Cada sinal contribui no máximo uma vez por chamada; só dispara se `score >= threshold`.
  - Contexto do guard vem do store: `currentReading` (livro/capítulo/verso mais recente resolvido, TTL de 5min) e `lastBibleEmit` (última referência emitida, com cooldown de 90s). Após um retorno bem-sucedido com `citedVerse` parseável, ambos são atualizados. Skips por camada 1 vs camada 2 contam em `bibleGateSkipped` vs `bibleGuardSkipped`.
- **`insights`** fires every `INSIGHTS_CHUNK_INTERVAL` chunks OK, with an `INSIGHTS_MIN_TAIL_DELTA_CHARS` gate so ticks in near-silence no-op.
Both pipelines are ADDITIVE — they only append to `feedItems`; nothing is rewritten or reordered mid-recording. Client-side dedup via `feedItemDedupKey` protects against equivalent items landing from overlapping calls. When touching `RecordingLive.tsx`, keep the guard predicates and dependency arrays intact unless the change is intentional.

**Do not merge `bible` back into `insights` or vice-versa.** They exist as separate routes because their cost/latency profiles are fundamentally different: `bible` needs to appear on screen the moment the pastor starts reading (low-latency, cheap because regex-gated); `insights` needs accumulated context and can wait (higher-latency, tolerated because slower cadence bounds cost). `citedVerse` is exclusive to `/api/bible`; the other five kinds are exclusive to `/api/insights`.

Exception to "additive only" — RANGE SUPERSEDE for `citedVerse`: when an incoming reference strictly contains an already-visible one (same book/chapter, wider verse span — e.g., `Tiago 1:1-4` arrives while `Tiago 1:1` is visible), the narrower card is removed so a single card tracks the passage as the pastor reads. Containment is asymmetric: chapter-only refs never cover verse-specific refs (`João 4` does NOT supersede `João 4:7`), matching the bible-prompt rule. See `referenceStrictlyContains` in `lib/domain/feed.ts`. A chapter-only `citedVerse` renders assuming the reading starts at verse 1 (`FeedItemCard` shows v1); in the REVERSE direction a verse-specific ref for the same book/chapter DOES replace the assumed chapter-only card (`referenceResolvesChapterOnly`) — the spoken verse corrects the assumption.

The final summary is single-shot: on stop, `/api/final-summary` runs once with the full transcript + accumulated `feedItems`. The prompt treats the feed as high-priority curated context (cited verses and speaker highlights must carry through; AI suggestions are kept only if they still fit the whole).

Visual convention in the feed: cards for items ORIGINATED from the speaker (`citedVerse`, `speakerHighlight`, `speakerCitation`) use the quote-gradient surface; cards for AI-authored items (`relatedVerse`, `context`, `suggestedQuote`) use a dashed outlined surface. Origin is derived from `kind` via `feedItemOrigin`; do not add an explicit `origin` field.

The recorder's `startedAtRef` is seeded by `start()` *before* flipping `setRunning(true)` so `useElapsedTimer` observes a valid origin on first render. Preserve this order.
