<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Scriba — guia do agente

Este arquivo é o índice. Ele carrega em toda sessão, então contém só o que
vale para o repositório inteiro. **As regras de cada área moram no `AGENTS.md`
da própria pasta** — abra o da área em que for mexer ANTES de escrever código.

## O que é o produto

Transcrição e resumo ao vivo de sermões e aulas bíblicas. O gravador emite
chunks de áudio de 15-20s que sobem para rotas de API com OpenAI atrás:

- **Ao vivo:** `transcribe` em todo chunk; três pipelines de enriquecimento
  com cadências diferentes (`bible`, `insights`, `sermon-echo`) alimentam um
  feed que só CRESCE — nada é reescrito.
- **No stop:** `final-summary` roda uma vez sobre a transcrição inteira mais
  os cards curados, e produz o resumo estruturado.
- **Depois:** `deepening` (estudo teológico sob demanda, uma vez por sessão)
  e os cards de acompanhamento — praticar / releia / lembra — que alimentam
  o `/feed`.

Três modos de captura (`lib/domain/session.ts`), cada um com sua página e seu
preço por minuto iniciado (`lib/coins/pricing.ts`):

| Modo | Página | O que roda | Moedas/min |
|---|---|---|---|
| `live` | `/recording/:id/live` | tudo acima | 5 |
| `audio_only` | `/recording/:id/audio` | transcribe + resumo final | 2 |
| `transcript_only` | `/recording/:id/transcribe` | só transcribe, sem LLM nem resumo | 1 |

Cada página redireciona um modo que não é o dela. Sessão salva abre em
`/recording/:id/summary`, ou `/transcript` no modo transcrição
(`savedRouteFor`).

**Stack:** Next.js 16 (App Router) · React 19 · Supabase SSR · Tailwind v4 +
shadcn sobre base-ui · Zod · Zustand · TanStack Query · Biome · Stripe.

## Mapa do repositório

```
app/          rotas, API, proxy, SEO, landing         → app/AGENTS.md
lib/          servidor: LLM, DB, env, log, auth        → lib/AGENTS.md
  billing/    Stripe, moedas e crédito                 → lib/billing/AGENTS.md
src/features/
  session/    gravação, pipelines ao vivo, feed        → src/features/session/AGENTS.md
  partners/   programa de divulgadores                 → src/features/partners/AGENTS.md
  admin/      painel interno, métricas, parceiros      → src/features/admin/AGENTS.md
  billing/    diálogo de compra e retorno do checkout  → lib/billing/AGENTS.md
src/shared/   tema, tokens, marca, a11y, UI base       → src/shared/AGENTS.md
supabase/     migrações, RLS, GRANT, RPC               → supabase/AGENTS.md
docs/         guias longos de operação                 → docs/README.md
```

## Regras que valem em todo lugar

**Imports.** `@/*` resolve para `./*` E `./src/*` (ver `tsconfig.json`), com
atalhos para `@/components/ui/*` (→ `src/shared/ui`), `@/components/*`
(→ `src/shared/components`), `@/hooks/*` e `@/components/icons/*`. Prefira
sempre o caminho mais específico.

**Fronteira servidor/cliente.** Todo módulo que carrega segredo, service-role
ou `serverEnv` começa com `import "server-only"`. Sem isso um import distraído
a partir de um `"use client"` compila e só quebra em runtime, no navegador do
usuário. Se um número precisa aparecer na TELA, ele mora num módulo
client-safe — nunca importe uma constante de um módulo `server-only` para um
componente cliente.

**Cliente não importa de `app/api/*/route.ts`.** Todo tipo compartilhado vive
em `lib/domain/`.

**Nada de `console.*`** em `app/`, `lib/` ou `src/`. O logger é
`createLogger(escopo)` de `@/lib/log` — ver `lib/AGENTS.md`.

**Nada de cor literal em `className`.** Toda cor vem de token declarado em
`app/globals.css` — ver `src/shared/AGENTS.md`.

**O ícone `Sparkles` do lucide-react é PROIBIDO.** Para um acento decorativo,
use o hexágono amarelo já usado no app (ver `src/shared/AGENTS.md`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Next dev com `.env.dev` |
| `npm run prod` | Next dev com `.env.prod`. **Dados reais, Stripe LIVE.** Só para reproduzir bug de produção |
| `npm run typecheck` | `tsc --noEmit`. Rode antes de commitar |
| `npm run check` | Biome check + write (imports, format, lint) |
| `npm run lint` / `format` | subcomandos do Biome |
| `npm run db:push` | migrações no Supabase de **dev** |
| `npm run db:push:prod -- --yes` | o mesmo em **produção** |
| `npm run stripe:doctor` | diagnóstico da configuração do Stripe |
| `npm run stripe:listen` | `stripe listen` no ambiente certo |

**Permissão permanente concedida pelo usuário:** depois de criar um arquivo em
`supabase/migrations/`, rode `npm run db:push` sem pedir confirmação. O
`db:push:prod` é a única exceção — sempre confirme antes.

Commits seguem Conventional Commits (`commitlint` no husky).

## Ambientes

Dois conjuntos independentes de Supabase, Stripe e URL, escolhidos por
`.env.dev` e `.env.prod`. **Nenhum dos dois é lido pelo Next sozinho** —
`scripts/with-env.mjs` injeta o certo e só então sobe o comando. Ele ABORTA se
achar qualquer arquivo que o Next carregaria por conta própria (`.env`,
`.env.local`, `.env.development[.local]`, `.env.production[.local]`), se achar
`sk_live_` no `.env.dev`, ou se os dois arquivos apontarem para o mesmo
Supabase. **Não crie `.env.local`** — o modelo é `.env.example`, o único da
família no git.

Na Vercel é um projeto só: `master` → `scriba.cc` (Production), `develop` →
`dev.scriba.cc` (Preview, env vars fixadas no branch). Cron da Vercel só roda
em produção, então `/api/billing/sweep` não existe em dev.

Variável nova: schema Zod em `lib/env/{server,client}.ts` **e** a linha no
`.env.example`, nos dois arquivos locais e no painel da Vercel (escopos
Production **e** Preview). Guia completo em `docs/ambientes.md`.

## O que deliberadamente NÃO existe ainda

Não adicione sem pedido — o usuário sabe e adiou:

- Respostas em streaming (SSE).
- Test runner ou testes.
- Framework de i18n. As strings pt-BR ficam inline por enquanto.

## Como estes documentos funcionam

O `AGENTS.md` de cada pasta descreve **por que** as coisas são como são, não o
que elas fazem — isso já está no cabeçalho de cada arquivo, e os cabeçalhos
deste repositório são bons. Ao mexer em algo, leia o cabeçalho do arquivo
antes de assumir que entendeu a intenção.

Quando você mudar um comportamento que um destes documentos descreve, atualize
o documento no MESMO commit. Um doc errado é pior que doc nenhum: ele é lido
com confiança.
