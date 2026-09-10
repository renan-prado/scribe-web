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
  e os cards de acompanhamento — releia / lembra / frase marcante — que
  alimentam o `/feed`.

Três modos de captura (`lib/domain/session.ts`), cada um com sua página e seu
preço por minuto iniciado (`lib/coins/pricing.ts`):

| Modo | Página | O que roda | Moedas/min |
|---|---|---|---|
| `live` | `/recording/:id/live` | tudo acima | 7 |
| `audio_only` | `/recording/:id/audio` | transcribe + resumo final | 5 |
| `transcript_only` | `/recording/:id/transcribe` | só transcribe, sem LLM nem resumo | 3 |

Cada página redireciona um modo que não é o dela. Sessão salva abre em
`/recording/:id/summary`, ou `/transcript` no modo transcrição
(`savedRouteFor`).

**E um quarto modo que NÃO captura nada: `youtube`.** A pessoa cola o link em
`/importar`, `/recording/:id/youtube` chama `/api/youtube/import`, e a legenda
que o YouTube já tem vira a transcrição — sobre a qual roda o MESMO pipeline de
`from-transcript` (resumo, releia, lembra, frases). Sem áudio, sem chunks, sem
STT. Sessão importada abre em `/summary` como qualquer outra.

O preço dele é o único que não é por minuto: **30 moedas por vídeo**, cobradas
uma vez, com teto de 2 horas de duração. Cobrar por minuto seria cobrar por um
STT que não acontece — a legenda custa ~R$ 0,03 de provedor, e o que sobra é
exatamente a chamada de `summaryFromTranscript`. O teto existe porque o custo
do resumo cresce com a transcrição na entrada e a receita não; `COIN_COSTS.youtubeImport`
e `YOUTUBE_MAX_DURATION_MS` andam sempre juntos.

**A legenda vem de um PROVEDOR PAGO, e isso não é preguiça.** Extrair legenda
do YouTube a partir de um servidor deixou de funcionar: o `timedtext` pune
reputação de IP de datacenter desde o fim de 2024, então o mesmo código roda na
máquina de quem escreveu e devolve bot-check na Vercel. `SUPADATA_API_KEY` é
opcional — sem ela só `/api/youtube/import` responde 503. Ver
`lib/youtube/supadata.ts`.

**Ele NÃO está no diálogo "Gravar".** Aquele diálogo oferece `CAPTURE_MODES` —
os três que ligam o microfone e cobram por minuto. O YouTube entra pela
Biblioteca (`/recordings` → "Importar" → `/importar`), e a separação é o que
permite ao botão "Gravar" continuar dizendo só o que faz e ao preço não precisar
de duas unidades no mesmo rodapé.

**O título do vídeo passa por um `mini` antes de virar título da sessão.** Um
título de canal de igreja traz pregador, tema, data e hora colados por um
separador que pode ser a LETRA `I` — e `author_name` do oEmbed é a IGREJA, não
o autor. `lib/youtube/metadata.ts` separa os três; falha dele devolve o título
cru, e em nenhum caminho o canal vira `speaker_name`. Ver `docs/youtube.md` §3.

**O modo transcrição não gera resumo, mas isso deixou de ser definitivo.** A
página salva oferece "Gerar resumo" (`/api/final-summary/from-transcript`, 15
moedas, uma vez), que roda o mesmo pipeline do `final-summary` sobre o texto já
salvo. A sessão passa então a ter as duas páginas — `/transcript` continua
sendo a leitura, `/summary` ganha resumo, estudo e cards — e o `/recordings`
aponta para a segunda. A escolha do modo é feita ANTES da pregação; o preço por
minuto é a promessa, não uma porta trancada.

**Stack:** Next.js 16 (App Router) · React 19 · Supabase SSR · Tailwind v4 +
shadcn sobre base-ui · Zod · Zustand · TanStack Query · Biome · Stripe.

## Mapa do repositório

```
app/          rotas, API, proxy, SEO, landing         → app/AGENTS.md
lib/          servidor: LLM, DB, env, log, auth        → lib/AGENTS.md
  billing/    Stripe, moedas e crédito                 → lib/billing/AGENTS.md
  entitlements/ o que cada plano libera                → lib/AGENTS.md
  referrals/  cookies e números da indicação           → src/features/referrals/AGENTS.md
  finance/    a conta do painel financeiro (pura)      → docs/financeiro.md
src/features/
  session/    gravação, pipelines ao vivo, feed        → src/features/session/AGENTS.md
  partners/   programa de divulgadores                 → src/features/partners/AGENTS.md
  referrals/  indique a um amigo                       → src/features/referrals/AGENTS.md
  admin/      painel interno, métricas, parceiros      → src/features/admin/AGENTS.md
  feedback/   a pesquisa de satisfação e a nota          → src/features/feedback/AGENTS.md
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

**Nada de `plan === "estudioso"`.** Quem decide se uma funcionalidade está
disponível é `lib/entitlements/` — `canCurrentUserUse(feature)` em server
component, `requireFeature(feature)` em rota. Uma comparação de plano solta no
meio do código é a regra duplicada em mais um lugar, e um dia os dois lugares
discordam. E **esconder o botão nunca é a proteção**: a rota reconfere, sempre,
antes de cobrar.

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
| `npm test` | `node --test` sobre `lib/**/*.test.ts` — só a camada financeira |
| `npm run check` | Biome check + write (imports, format, lint) |
| `npm run release` | Sobe a versão, escreve o `CHANGELOG.md` e cria a tag. **Antes de todo push** |
| `npm run lint` / `format` | subcomandos do Biome |
| `npm run db:push` | migrações no Supabase de **dev** |
| `npm run db:push:prod -- --yes` | o mesmo em **produção** |
| `npm run stripe:doctor` | diagnóstico da configuração do Stripe |
| `npm run stripe:listen` | `stripe listen` no ambiente certo |

**Permissão permanente concedida pelo usuário:** depois de criar um arquivo em
`supabase/migrations/`, rode `npm run db:push` sem pedir confirmação. O
`db:push:prod` é a única exceção — sempre confirme antes.

Commits seguem Conventional Commits (`commitlint` no husky).

## Versão e release — antes de todo push

> **Toda vez que for empurrar trabalho, rode `npm run release` antes do push.**

Não é burocracia: a versão do `package.json` é carimbada em cada chamada de
LLM (`llm_usage_events.app_version`) e é o eixo da tabela **"Por versão"** do
`/admin/usage`, que compara custo por chamada e latência de um deploy para o
outro. **Sem o bump, todo evento de todo deploy nasce com o mesmo rótulo**, as
linhas se fundem numa só, e a pergunta "depois daquela mudança ficou pior?"
deixa de ter onde ser respondida — sem erro nenhum na tela, que é o pior jeito
de uma medição falhar.

A ordem é sempre esta, e o `release` RECUSA uma árvore suja para garanti-la:

```bash
git commit -m "feat(escopo): ..."        # 1. o trabalho, primeiro
npm run release                          # 2. versão + CHANGELOG + tag anotada
git push --follow-tags origin develop    # 3. a tag vai junto
```

O degrau sai dos próprios commits: algum `feat` sobe o **minor**, o resto sobe
o **patch**. `feat!`/`BREAKING CHANGE` sobe o minor enquanto o major for 0 e
avisa — ir para `1.0.0` é decisão de produto (`npm run release major`). Para
ver sem escrever: `npm run release -- --dry-run`.

**Um release por entrega, na `develop`.** O `master` recebe a mesma versão pelo
`merge --ff-only` de sempre; dois releases criariam duas versões dividindo o
mesmo tráfego, e o painel mostraria duas linhas onde houve um deploy só.

`CHANGELOG.md` é GERADO — não edite à mão. Ele existe porque `0.6.0` sozinho
não é resposta: quando o painel disser que uma versão encareceu uma rota, é o
CHANGELOG que diz o que mudou e a tag que abre o código exato
(`git diff v0.5.0 v0.6.0 -- lib/prompts/`). Guia completo em
[`docs/versionamento.md`](docs/versionamento.md).

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
- Framework de i18n. As strings pt-BR ficam inline por enquanto.

**Testes existem em UM lugar só, e continuam não sendo o padrão do
repositório.** `npm test` roda `node --test` sobre `lib/**/*.test.ts`, e hoje
isso é `lib/finance/*` — aritmética de dinheiro, pura e sem banco, onde um erro
de arredondamento vira decisão de negócio errada. Não acrescente teste em outra
camada sem pedido; a ausência deles no resto é escolha, não dívida.

## Como estes documentos funcionam

O `AGENTS.md` de cada pasta descreve **por que** as coisas são como são, não o
que elas fazem — isso já está no cabeçalho de cada arquivo, e os cabeçalhos
deste repositório são bons. Ao mexer em algo, leia o cabeçalho do arquivo
antes de assumir que entendeu a intenção.

Quando você mudar um comportamento que um destes documentos descreve, atualize
o documento no MESMO commit. Um doc errado é pior que doc nenhum: ele é lido
com confiança.
