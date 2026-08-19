<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project overview

scribe-web is a live sermon/lecture transcription + summarization app. A recorder emits ~30s audio chunks that stream through five OpenAI-backed API routes (transcribe, summarize, consolidate, insights, verse, format-paragraphs) and land in a live-updating summary UI with block-level LLM insights and a bible-verse lookup dialog.

Stack: Next.js 16 (App Router), React 19, Supabase SSR, Tailwind v4 + shadcn/base-ui components, Biome, Zod.

## Folder layout

```
app/
  api/{transcribe,summarize,consolidate,insights,verse,format-paragraphs}/route.ts
  spike/page.tsx                — the recording session page (orchestration only)
  page.tsx                      — landing that links to /spike
  layout.tsx, globals.css
components/ui/                  — shadcn primitives (Dialog, DropdownMenu, Button)
lib/
  env/{server,client}.ts        — Zod-parsed env vars (throw at import)
  domain/{summary,consolidate,insights,verse,recorder}.ts
                                — shared types + Zod schemas + parseXxxFromLLM helpers
  llm/openai.ts                 — callChat / callTranscribe (Result<T>, AbortController timeout)
  prompts/*.ts                  — system prompts as exported constants
  supabase/{server,client}.ts
  recorder.ts                   — MediaRecorder + VAD factory (createRecorder)
  vocabulario.ts                — biblical books + theology vocab for the STT prompt
  utils.ts                      — cn()
src/features/session/
  components/*.tsx              — every UI piece of the recording page
  hooks/                        — useElapsedTimer, useWakeLock, useVisibilityWarning, useVerseFetch
  lib/                          — audio (isSilentBlob), text (tail/format), chunks (grouping),
                                  proposals (apply/remap), api (typed fetch wrappers)
  config.ts                     — pacing constants (chunk cadences, warmup, timeouts)
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
- **New UI element for the session page**: put it under `src/features/session/components/`. Keep `app/spike/page.tsx` as pure orchestration. Pure helpers go to `src/features/session/lib/`; reusable stateful behaviour goes to `src/features/session/hooks/`.
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

The session page has three pipelines (summarize, insights, consolidate) coordinated by four flight-flag booleans (`summarizing`, `insighting`, `consolidating`, `finalizing`) and one pending-index set. The `useEffect` guard order matters — dropping or reordering guards can cause a summary response to clobber a pending consolidate merge. When touching `app/spike/page.tsx`, keep the guard predicates and dependency arrays intact unless the change is intentional.

The recorder's `startedAtRef` is seeded by `start()` *before* flipping `setRunning(true)` so `useElapsedTimer` observes a valid origin on first render. Preserve this order.
