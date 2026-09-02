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
  api/billing/{checkout,portal,summary}/route.ts
                                — Stripe Checkout / portal / resumo de plano (autenticadas)
  api/stripe/webhook/route.ts   — ÚNICA porta de crédito. Pública + assinatura HMAC.
  (app)/billing/retorno/page.tsx
                                — retorno do Checkout (decorativa: não credita nada)
  (app)/recording/[id]/{live,audio,transcribe}/page.tsx
                                — recording pages, one per capture mode (orchestration only)
  (app)/recording/[id]/{summary,transcript}/page.tsx
                                — saved session: summary, or transcription for transcript_only
  page.tsx                      — landing that links into the app. ESTÁTICA: não pode ler
                                  cookie/sessão (o redirect de quem já está logado mora no
                                  proxy.ts). Ver "Landing page" abaixo.
  layout.tsx, globals.css
components/ui/                  — shadcn primitives (Dialog, DropdownMenu, Button)
lib/
  billing/plans.ts              — catálogo CLIENT-SAFE (nome, moedas, preço de tela)
  billing/catalog.ts            — server-only: chave↔Price ID e Price ID↔moedas
  billing/stripe.ts             — cliente Stripe (null se não configurado) + helpers
  billing/customer.ts           — getOrCreateCustomer (nunca aceita id do request)
  db/billing.ts                 — assinaturas, grantCoins, clawbackCoins, idempotência
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
src/features/billing/
  components/{BillingDialog,PlanCard,CheckoutReturn}.tsx
  lib/api.ts                    — só envia CHAVE de plano / quantidade, nunca preço
  store.ts                      — resumo de plano (leitura)
src/features/session/
  components/*.tsx              — every UI piece of the recording page (Feed + FeedItemCard
                                  drive the live view; SummaryView renders the post-stop
                                  final payload)
  hooks/                        — useElapsedTimer, useWakeLock, useVisibilityWarning, useVerseFetch
  lib/                          — audio (isSilentBlob), text (tail/format), chunks (grouping),
                                  api (typed fetch wrappers)
  config.ts                     — pacing constants (chunk cadences, insights interval, deltas, timeouts)
  types.ts                      — ChunkRow, FinalAudio, TranscriptState, VerseFetchState
src/shared/
  assets/avatars/*.webp         — avatares dos depoimentos e do hero da LP (136px, ~3 KB cada)
  components/LandingMocks.tsx   — as telas dentro dos mockups de celular da LP. Markup
                                  estático PRÓPRIO, não os componentes do app — ver abaixo.
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

## Marca — a pena mora em um lugar só

A pena e o logotipo saem de `src/shared/brand/`, e o `<path>` do desenho
existe em **um** arquivo: `ScribaMark.tsx`. Não cole o path em nenhum outro
lugar, nem crie um SVG inline "só desta vez".

- `ScribaMark` — a pena sozinha, pintando com `currentColor`.
- `ScribaLogo` — pena + a palavra "scriba" em Poppins (`--font-poppins`),
  com `subtitle` opcional (hoje só o "Admin" da sidebar).
- `ScribaAvatar` — a pena branca no disco com gradiente, usada quando o
  Scriba fala como autor (cartões de IA no feed e nos blocos de estudo).

**A cor do logotipo vem do container, nunca de uma classe própria em cada
metade.** Pena e palavra são uma marca só: o `<path>` usa `currentColor` e o
texto herda o `color`. Pintar um dos dois separadamente é exatamente o que os
desencontra — já aconteceu, e o conserto virou commit.

**Os consumos de fora do React vivem em `public/brand/`** — `pena.svg` e os
dois favicons — porque favicon, manifest e dados estruturados não passam por
componente. Eles NÃO se atualizam sozinhos quando `ScribaMark` muda. Quando a
marca mudar, os cinco pontos abaixo mudam juntos:

1. `src/shared/brand/ScribaMark.tsx` — a aplicação inteira.
2. `public/brand/pena.svg` — a mesma pena para consumo externo.
3. `public/brand/favicon-{light,dark}-theme.svg` — a aba do navegador.
4. `app/opengraph-image.tsx` — o card de compartilhamento (Satori não lê
   componente React do app nem `clip-path`; o SVG ali é inline de propósito).
5. `app/manifest.ts` + `app/layout.tsx` + `LandingJsonLd.tsx` — só apontam
   para `/brand/`, mas confira se o arquivo apontado ainda existe.

**Não crie `app/icon.svg` nem `app/favicon.ico`.** São convenções de arquivo
do Next que injetam um `<link rel="icon">` **sem `media`**, e a marca precisa
trocar com o tema — por isso os ícones são declarados em `metadata.icons` no
`app/layout.tsx`. As duas coisas não se substituem, elas se SOMAM: enquanto
`app/favicon.ico` existiu (o padrão do Next, vindo do scaffold), o `<head>`
saía com três `<link rel="icon">` e o ícone do Next vencia na aba.

## Billing (Stripe) — invariantes que não se negociam

Créditos ("moedas") são dinheiro. As regras abaixo existem para que nenhuma
mudança futura reabra um caminho de crédito grátis. Migrações: `0026_billing_stripe.sql`
(planos, assinaturas, `grant_coins`) e `0027_coin_clawback.sql` (estorno).

- **Todo crédito passa por `lib/billing/fulfill.ts` — sem exceção.** Quatro
  pontos de entrada, três linhas de defesa em ordem de latência:
  (1) `POST /api/stripe/webhook` — segundos, o caminho normal;
  (2) `POST /api/billing/reconcile` — no retorno do checkout, cobre compras
  cujo webhook falhou;
  (3) check preguiçoso em `GET /api/billing/summary` — assinatura viva com
  `current_period_end` vencido dispara conferência no Stripe (cooldown 15min),
  cobrindo renovações perdidas exatamente quando o usuário estranha o saldo;
  (4) `GET /api/billing/sweep` — cron diário (vercel.json), varre pagamentos
  recentes no Stripe e credita o que não estiver no ledger; guardado por
  `CRON_SECRET` (comparação em tempo constante) e público no proxy como o
  webhook. `coinsRecovered > 0` numa passada = incidente nas camadas de cima.
  Tudo idempotente pelo `external_ref` UNIQUE: os quatro caminhos sobre o
  mesmo pagamento creditam UMA vez. Um quinto caminho, se surgir, também usa
  `fulfill.ts` — duas implementações de "quanto creditar" divergem.
- **A reconciliação não afrouxa nada.** Ela recebe um `cs_...`, mas o id só
  ENDEREÇA: a sessão é buscada na API do Stripe, o `customer` dela tem de bater
  com o `stripe_customer_id` de quem está autenticado (senão 403), o pagamento
  tem de estar `paid`, e o `external_ref` UNIQUE faz webhook e reconciliação
  juntos creditarem uma vez só. A página de retorno segue decorativa: forjar
  `?status=sucesso` não produz crédito nenhum.
- **A landing page NÃO tem números próprios.** Nome, preço e créditos dos
  cards de `/#planos` saem de `lib/billing/plans.ts` — o mesmo catálogo do
  diálogo de compra e do /profile. Só a lista de recursos (`PLAN_FEATURES` em
  `app/page.tsx`) é copy local, porque descreve capacidades, não valores.
  Antes disso a LP anunciava 2.000/5.000/100 créditos contra os 1.000/2.500/50
  reais: preço de tela errado é promessa quebrada no checkout.
- **A intenção de plano sobrevive ao login.** CTA da LP aponta para
  `/sign-in?next=%2Fbilling%2Fassinar%3Fplan%3D<plano>`; `/billing/assinar`
  (dentro de `(app)`, logo protegida) abre o Checkout. A chave do plano viaja
  pela URL e isso é seguro — ela só ENDEREÇA; preço e moedas continuam vindo
  do catálogo server-only. Trocar `?plan=` muda qual plano é oferecido, nunca
  quanto custa. O `?next=` passa por `safeNextPath` no proxy e por checagem
  equivalente no `/auth/callback`: caminho relativo, recusando `//host`,
  `/\host` e `/%2F…` — um `next` frouxo no fluxo de login é open redirect
  assinado pelo nosso domínio.
- **O front nunca envia valor nem quantidade de moedas.** O corpo aceito por
  `/api/billing/checkout` é uma chave de plano (`pessoal`/`estudioso`) ou o
  pacote avulso com uma quantidade inteira clampeada. Preço vem do Price object
  no Stripe; moedas vêm de `entitlementForPrice(priceId)` em
  `lib/billing/catalog.ts`. Um Price fora do catálogo credita **zero**.
- **O dono do crédito vem do vínculo que nós gravamos**, `profiles.stripe_customer_id`,
  resolvido por `findUserIdByCustomerId`. Nunca de metadata ou do corpo do request.
- **`grant_coins` e `clawback_coins` têm EXECUTE revogado de `anon`/`authenticated`.**
  Só `service_role` chama. Verificado: com o anon key a RPC devolve 42501.
- **`profiles` tem GRANT por coluna.** `authenticated` só escreve
  `display_name/avatar_url/email`. `coin_balance`, `stripe_customer_id`, `role` e
  `is_active` estão fora do alcance do cliente — RLS não restringe coluna, GRANT sim.
  (Antes desta mudança, um usuário com o anon key podia dar
  `update profiles set coin_balance = 999999 where id = auth.uid()`.)
- **O espelho `subscriptions` se cura sozinho em três pontos** (webhook,
  reconciliação e o guard do checkout), sempre via
  `syncSubscriptionState` em `fulfill.ts`, e sempre a partir de uma busca
  FRESCA na API — nunca do payload de um evento, porque o Stripe não garante
  ordem de entrega e um `updated` atrasado sobrescreveria estado novo. O guard
  anti-cobrança-dupla do checkout NUNCA deve confiar só no espelho local:
  antes de criar assinatura, ele confere no Stripe se já existe uma viva.
- **Idempotência em duas camadas.** `stripe_events` (PK = event id) descarta
  reentrega; `coin_transactions.external_ref` (UNIQUE) impede crédito duplo
  mesmo vindo de eventos diferentes. Falha depois do claim → `releaseStripeEvent`
  + 5xx, para o Stripe reentregar.
- **Assinatura credita em `invoice.paid`**, não em `checkout.session.completed`
  (que dispara com pagamento pendente). Avulso exige `payment_status === "paid"`
  e as linhas são relidas da API do Stripe, não do payload.
- **Refund e chargeback estornam** (`charge.refunded`, `charge.dispute.created`)
  via `clawback_coins`, que nunca deixa o saldo negativo e loga em `warn` quando
  os créditos já tinham sido gastos.
- `/api/stripe` está na allowlist do `proxy.ts` porque o Stripe chega sem cookie.
  Não remova sem quebrar todo o faturamento.
- Ferramentas: `npm run stripe:doctor` (diagnóstico da configuração — chave,
  conta, preços, endpoints de webhook) e `npm run stripe:listen` (sobe o
  `stripe listen` no ambiente certo e confere o `whsec_`). Guia completo e
  armadilhas conhecidas em `docs/stripe-setup.md`.

## Créditos durante a gravação

Acabar o saldo no meio de um sermão **congela** a captura, não a encerra —
ver `useCoinGuard` (`src/features/session/hooks/`), usado pelos três modos.
Fluxo: aviso em 5 min e 2 min restantes → ao zerar, `pause()` + `PausedOverlay`
com `outOfCoins` → o usuário compra em **aba nova** (sair da página mataria o
MediaRecorder e a fila de chunks) → o saldo é ressincronizado por `focus`,
`visibilitychange` e polling curto → a trava cai e "Retomar" reaparece.
O hook nunca retoma sozinho: reabrir o microfone sem gesto do usuário seria
surpreendente e, em alguns navegadores, bloqueado.

Sessões que nunca foram encerradas (`ended_at is null`) saem da lista principal
e aparecem numa faixa "Gravações em aberto" no `/list`, com opção de continuar
ou apagar — ver `listUnfinishedSessions`.

## Landing page — o que não pode voltar

A LP é a única página que um visitante anônimo carrega, e é ela que decide se
ele fica. Duas regras existem só para protegê-la, e as duas são fáceis de
desfazer sem perceber.

- **`app/page.tsx` é ESTÁTICA. Nada nela pode ler cookie, sessão ou header.**
  Uma única chamada a `supabase.auth.getUser()` ali dentro basta para o Next
  marcar a rota como dinâmica, e o efeito é desproporcional: a resposta passa a
  sair com `Cache-Control: private, no-store` e `X-Vercel-Cache: MISS`, ou seja,
  HTML remontado na origem a cada visita, com DUAS idas ao Supabase antes do
  primeiro byte — uma no `proxy.ts` e outra na página. Numa página cujo conteúdo
  é idêntico para todo mundo que não está logado. O `no-store` ainda derrubava o
  bfcache, então voltar para a LP recarregava tudo. O redirect de quem já está
  logado mora no `proxy.ts` (junto do guard de `/sign-in`), que já tem o usuário
  resolvido — sai de graça e não custa a estaticidade.
  O proxy também sai cedo, ANTES de instanciar o client do Supabase, quando o
  path é `/` e não há nenhum cookie `sb-*`: sem sessão não há o que renovar, e
  isso poupa uma ida à rede na rota mais visitada.

- **A LP NÃO importa componentes de `src/features/session/` que sejam
  `"use client"`.** As telas dentro dos mockups de celular são markup estático
  em `src/shared/components/LandingMocks.tsx`. Antes elas montavam o `<Feed>` e
  o `<SummaryView>` reais, e isso arrastava `FeedItemCard`, `VerseDialog` (com o
  Dialog do base-ui), `useVerseFetch`, `PassageVerses`, `ScribaComment` e os
  skeletons para o bundle da landing page — o app de gravação inteiro baixado
  para exibir cinco cards que nunca mudam e nunca respondem a clique. Reusar um
  server component (o `BlockRenderer`, por exemplo) continua liberado: ele não
  custa bundle. O preço de reproduzir o visual à mão é real — mexer no
  `FeedItemCard` não atualiza mais a LP — e é aceito de propósito: as duas telas
  mudam por razões diferentes.

Imagens: nada de `<img>` para host externo. Sete avatares placeholder de
`mockmind-api.uifaces.co` (1024×1024 para desenhar círculos de 34 px) custavam
724 KB, e o React 19 ainda os promovia a `<link rel="preload" as="image">` no
`<head>`, disputando a banda inicial com o CSS. Hoje são sete WebP de 136 px em
`src/shared/assets/avatars/` (20 KB no total) servidos por `next/image` com
import estático — que também traz `width`/`height` de graça, sem CLS.

## Adding a new feature

- **New API route calling OpenAI**: (1) add a prompt in `lib/prompts/foo.ts`, (2) add the schema + `parseFooFromLLM` in `lib/domain/foo.ts`, (3) create `app/api/foo/route.ts` that reads env from `serverEnv`, invokes `callChat({...})`, and delegates parsing to the domain helper. Log `[foo] ok { latencyMs, finishReason, promptTokens, completionTokens, ... }` on success and `[foo] upstream {fetch failed|error}` on failure. Every new route MUST call `enforceRateLimit(request, RATE_LIMITS.foo, auth.user.id)` right after `requireAuth()` — add a bucket to `RATE_LIMITS` in `lib/rate-limit.ts` sized to the expected client cadence (per-user + per-IP).
- **New UI element for the session page**: put it under `src/features/session/components/`. Keep `app/(app)/recording/[id]/live/page.tsx` as pure orchestration. Pure helpers go to `src/features/session/lib/`; reusable stateful behaviour goes to `src/features/session/hooks/`.
- **New env var**: add to the Zod schema in `lib/env/server.ts` (or `client.ts`) — this is intentionally strict so a missing var fails at boot, not on the first request. As variáveis do Stripe são a exceção: ficam `.optional()` para o app subir sem cobrança configurada, e as rotas de billing respondem 503 `billing_unavailable`.
- **Nova rota que mexe em moedas**: débito passa por `chargeCoins` (`lib/db/coins.ts`); crédito NÃO tem rota — ver a seção de Billing acima.

## What is deliberately NOT here yet

Do not add these unprompted (the user is aware and defers them):
- Streaming (SSE) responses.
- A test runner or tests.
- An i18n framework — pt-BR strings live inline for now; extraction can wait.

## Ambientes (dev × produção)

Dois conjuntos independentes de recursos — Supabase, Stripe e URL —
selecionados por dois arquivos: `.env.dev` e `.env.prod`. Guia completo em
`docs/ambientes.md`.

- **Nenhum dos dois é lido pelo Next automaticamente.** `scripts/with-env.mjs`
  injeta o arquivo certo em `process.env` e só então sobe o comando. Isso é
  deliberado: com um `.env.local` na pasta, um `next dev` distraído fala com o
  Supabase e o Stripe de PRODUÇÃO sem avisar. O `with-env` **aborta** se
  encontrar qualquer arquivo que o Next carregue sozinho (`.env`, `.env.local`,
  `.env.development[.local]`, `.env.production[.local]`).
- **Não crie `.env.local`.** O modelo é `.env.example` — único da família no git.
- O `with-env` também aborta com `sk_live_` no `.env.dev` e quando os dois
  arquivos apontam para o mesmo Supabase.
- Nova variável de ambiente: além do schema Zod em `lib/env/{server,client}.ts`,
  acrescente a linha em `.env.example`, nos dois arquivos locais e no painel da
  Vercel (escopos Production **e** Preview).
- Na Vercel é um projeto só: `master` → `scriba.cc` (Production), `develop` →
  `dev.scriba.cc` (Preview, env vars fixadas nesse branch). Cron da Vercel só
  roda em produção, então `/api/billing/sweep` não existe em dev.

## Commands

- `npm run dev` — Next dev server com `.env.dev`.
- `npm run prod` — Next dev server com `.env.prod`. **Dados reais, Stripe LIVE.**
  Imprime banner vermelho. Use só para reproduzir bug que depende de produção.
- `npm run typecheck` — `tsc --noEmit`. Run this before commits.
- `npm run check` — Biome check + write (imports, format, lint).
- `npm run lint` / `npm run format` — Biome subcommands.
- `npm run db:push` — aplica `supabase/migrations/` no Supabase de **dev**. O ref
  vem de `.env.dev` e o script religa o CLI antes do push (o vínculo em
  `supabase/.temp/` é global à pasta e não é confiável). **Standing permission
  granted by the user**: after creating a new file under `supabase/migrations/`,
  run this without asking for confirmation.
- `npm run db:push:prod -- --yes` — o mesmo em **produção**. O `--yes` é
  obrigatório e esta é a única exceção à permissão acima: sempre confirme antes.

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
