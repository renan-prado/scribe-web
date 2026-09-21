# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Scriba: guia do agente

Este arquivo é o índice. Ele carrega em toda sessão, então contém só o que
vale para o repositório inteiro. **As regras de cada área moram no `AGENTS.md`
da própria pasta**, abra o da área em que for mexer ANTES de escrever código.

## O que é o produto

**Grava → resumo.**

Um sermão ou aula bíblica é gravado pelo microfone em UM arquivo. No stop ele
sobe inteiro, é transcrito de uma vez e vira um resumo estruturado. A partir do
resumo, quem tem plano `Estudioso` pedia um estudo teológico, uma vez por sessão
— **o estudo está saindo do produto, e o acesso a ele já foi tirado da
interface**: as rotas, a API e as tabelas continuam de pé, sem nenhum botão que
chegue nelas. Ver `src/app/AGENTS.md`.

**Um modo de captura só, `audio`**, a 5 moedas por minuto iniciado
(`src/features/coins/pricing.ts`). Já foram três — `live` (com um feed de cartões
durante a pregação), `audio_only` e `transcript_only` (sem resumo) — e três eram
dois a mais.

**E um modo que NÃO captura nada: `youtube`.** A pessoa cola o link em
`/importar`, e a legenda que o YouTube já tem vira a transcrição, sobre a qual
roda o MESMO pipeline de resumo. Sem áudio, sem STT.

O preço dele é o único que não é por minuto: **30 moedas por vídeo**, cobradas
uma vez, com teto de 2 horas. Cobrar por minuto seria cobrar por um STT que não
acontece; a legenda custa ~R$ 0,03 de provedor, e o que sobra é a chamada de
resumo. O teto existe porque o custo do resumo cresce com a transcrição na
entrada e a receita não: `COIN_COSTS.youtubeImport` e `YOUTUBE_MAX_DURATION_MS`
andam sempre juntos.

**E dá para importar só um TRECHO** — "do minuto 12 ao 45" —, que é a resposta
para a transmissão de duas horas com trinta minutos de pregação no meio. Não
custa chamada a mais: a legenda já vem em segmentos com tempo, e o recorte é um
filtro sobre eles. O teto passa a medir o TRECHO, não a fita. O par mora na
linha da sessão (`source_start_ms`/`source_end_ms`), nunca só no cliente:
`/importar/:id` redispara a importação a cada reload. Ver `docs/youtube.md` §8.

**E o `/importar` aceita o vídeo pela URL** (`?url=`, `?v=`, `?text=`,
`?inicio=`/`?fim=`), preenchendo o formulário — o botão continua sendo a única
coisa que COBRA. É o que prepara o compartilhar-com-o-Scriba. Ver §9 do mesmo
documento.

**A legenda vem de um PROVEDOR PAGO, e isso não é preguiça.** Extrair legenda do
YouTube a partir de um servidor deixou de funcionar: o `timedtext` pune
reputação de IP de datacenter desde o fim de 2024, então o mesmo código roda na
máquina de quem escreveu e devolve bot-check na Vercel. `SUPADATA_API_KEY` é
opcional; sem ela `/api/youtube/import` responde 503. Ver
`src/features/session/server/youtube/supadata.ts`.

**O título do vídeo passa por um `mini` antes de virar título da sessão.** Um
título de canal de igreja traz pregador, tema, data e hora colados por um
separador que pode ser a LETRA `I`, e `author_name` do oEmbed é a IGREJA, não o
autor. `src/features/session/server/youtube/metadata.ts` separa os três; falha dele devolve o título
cru, e em nenhum caminho o canal vira `speaker_name`. Ver `docs/youtube.md` §3.

**E um terceiro modo, que não captura NEM gera: `manual`.** Em `/escrever` a
pessoa digita o resumo ela mesma, num editor de blocos com o mesmo vocabulário
do resumo gerado — título, subtítulo, parágrafo, passagem bíblica, frase de
destaque, citação e conclusão. É o único caminho do produto que **não custa
moeda**, porque não há STT nem chamada de modelo em lugar nenhum dele; o
trabalho foi todo de quem escreveu. Uma sessão assim não tem transcrição, e é
isso que tira dela o reprocessamento, o alerta de alucinação e, por ora, o
estudo. Ver `src/app/AGENTS.md`.

**Stack:** Next.js 16 (App Router) · React 19 · Supabase SSR · Tailwind v4 +
shadcn sobre base-ui · Zod · Zustand · TanStack Query · Biome · Stripe.

## Mapa do repositório

**Todo código do produto mora em `src/`.** Na raiz ficam só arquivos de
configuração, o `public/` (exigência do Next) e o `supabase/` (exigência do CLI
dele, que resolve `supabase/config.toml` a partir do diretório de trabalho).

```
src/
  app/          rotas, API, SEO, landing              → src/app/AGENTS.md
    (site)/     público: landing, legais, parceiros
    (entrar)/   login, OAuth e os links de entrada
    (app)/      O APP, atrás do login (o gravador e o /escrever moram aqui)
    (painel)/   /admin e /partners
    api/
  proxy.ts      o gate de rota (o "middleware" do Next 16)
  instrumentation.ts

  features/     UM ASSUNTO POR PASTA, da tela ao banco
    session/    gravação, resumo, estudo, YouTube, busca → session/AGENTS.md
    billing/    Stripe, planos e crédito                 → billing/AGENTS.md
    coins/      preço em moedas e a conta de margem
    admin/      painel interno, métricas, finanças       → admin/AGENTS.md
    partners/   programa de divulgadores                 → partners/AGENTS.md
    referrals/  indique a um amigo                       → referrals/AGENTS.md
    coupons/    o selo do cupom de convite               → coupons/AGENTS.md
    feedback/   a pesquisa de satisfação e a nota        → feedback/AGENTS.md
    tour/       as apresentações das telas logadas       → tour/AGENTS.md
    auth/       entrar, sair e apagar a conta

  lib/          o ENCANAMENTO, e mais nada               → src/lib/AGENTS.md
    db/ domain/ supabase/ env/ log/ http/ llm/ fx/ auth/
    bibles/ entitlements/ + 5 arquivos soltos
  shared/       tema, tokens, marca, a11y, UI base       → src/shared/AGENTS.md
  scripts/      release, db:push, with-env, doctor
supabase/       migrações, RLS, GRANT, RPC               → supabase/AGENTS.md
docs/           guias longos + a auditoria de segurança  → docs/README.md
```

**Uma feature mora INTEIRA na pasta dela**, da tela ao acesso ao banco. Dentro,
`server/` guarda o que leva `import "server-only"` e a raiz guarda o que é
client-safe — a divisão é essa, não é por gosto. `lib/` ficou com o que não sabe
o que é um sermão.

A exceção é `lib/db/`, que não foi recortado por feature: `db/sessions.ts` é
lido pela sessão, pelo painel e por meia dúzia de rotas, e dividi-lo trocaria
uma camada coesa por três donos discutindo. Só `db/admin/*` foi junto, porque
só o painel o lia.

**O gravador mora em `src/app/(app)/recording/`, e é a exceção à regra acima.**
São cinco arquivos (`AudioStudio.tsx`, `useAudioCapture.ts`,
`useRecordingPresence.ts`, `RecordingWorkbench.tsx` e `recording-notes.ts`);
a pasta `session` é
tudo o que vem DEPOIS de a sessão existir.

## Regras que valem em todo lugar

**Imports.** `@/*` resolve para `./src/*`, e só (ver `tsconfig.json`). Já
resolveu para DOIS lugares (`./*` e `./src/*`), porque metade do código estava na
raiz; com tudo sob `src/` o alias voltou a ter uma resposta só. Há atalhos para
`@/components/ui/*` (→ `src/shared/ui`), `@/components/*` (→
`src/shared/components`), `@/hooks/*` e `@/components/icons/*`. Prefira sempre o
caminho mais específico.

**Fronteira servidor/cliente.** Todo módulo que carrega segredo, service-role
ou `serverEnv` começa com `import "server-only"`. Sem isso um import distraído
a partir de um `"use client"` compila e só quebra em runtime, no navegador do
usuário. Se um número precisa aparecer na TELA, ele mora num módulo
client-safe; nunca importe uma constante de um módulo `server-only` para um
componente cliente.

**Cliente não importa de `src/app/api/*/route.ts`.** Todo tipo compartilhado vive
em `src/lib/domain/`.

**Nada de `plan === "estudioso"`.** Quem decide se uma funcionalidade está
disponível é `src/lib/entitlements/`: `canCurrentUserUse(feature)` em server
component, `requireFeature(feature)` em rota. Uma comparação de plano solta no
meio do código é a regra duplicada em mais um lugar, e um dia os dois lugares
discordam. E **esconder o botão nunca é a proteção**: a rota reconfere, sempre,
antes de cobrar.

**Nada de `console.*`** em `src/`. O logger é `createLogger(escopo)` de
`@/lib/log`, ver `src/lib/AGENTS.md`.

**Nada de cor literal em `className`.** Toda cor vem de token declarado em
`src/app/globals.css`, ver `src/shared/AGENTS.md`.

**O ícone `Sparkles` do lucide-react é PROIBIDO como acento decorativo.** Para
isso, use o hexágono amarelo já usado no app. Há UMA exceção viva, o selo "com
IA" do `CreateDock`, onde ele acompanha um texto em vez de ser o enfeite; ver
`src/shared/AGENTS.md` antes de abrir a segunda.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Next dev com `.env.dev` |
| `npm run prod` | Next dev com `.env.prod`. **Dados reais, Stripe LIVE.** Só para reproduzir bug de produção |
| `npm run typecheck` | `tsc --noEmit`. Rode antes de commitar |
| `npm test` | `node --test` sobre `src/lib/**/*.test.ts`, só a camada financeira |
| `npm run check` | Biome check + write (imports, format, lint) |
| `npm run build:dev` | `next build` com `.env.dev`. `npm run build` sozinho não enxerga env e falha |
| `npm run release` | Sobe a versão, escreve o `CHANGELOG.md` e cria a tag. **Antes de todo push** |
| `npm run db:push` | migrações no Supabase de **dev** |
| `npm run db:push:prod -- --yes` | o mesmo em **produção** |
| `npm run stripe:doctor` | diagnóstico da configuração do Stripe |
| `npm run stripe:listen` | `stripe listen` no ambiente certo |

**Permissão permanente concedida pelo usuário:** depois de criar um arquivo em
`supabase/migrations/`, rode `npm run db:push` sem pedir confirmação. O
`db:push:prod` é a única exceção, sempre confirme antes.

Commits seguem Conventional Commits (`commitlint` no husky).

## Versão e release: antes de todo push

> **Toda vez que for empurrar trabalho, rode `npm run release` antes do push.**

Não é burocracia: a versão do `package.json` é carimbada em cada chamada de
LLM (`llm_usage_events.app_version`) e é o eixo da tabela **"Por versão"** do
`/admin/usage`, que compara custo por chamada e latência de um deploy para o
outro. **Sem o bump, todo evento de todo deploy nasce com o mesmo rótulo**, as
linhas se fundem numa só, e a pergunta "depois daquela mudança ficou pior?"
deixa de ter onde ser respondida, sem erro nenhum na tela, que é o pior jeito
de uma medição falhar.

A ordem é sempre esta, e o `release` RECUSA uma árvore suja para garanti-la:

```bash
git commit -m "feat(escopo): ..."        # 1. o trabalho, primeiro
npm run release                          # 2. versão + CHANGELOG + tag anotada
git push --follow-tags origin develop    # 3. a tag vai junto
```

O degrau sai dos próprios commits: algum `feat` sobe o **minor**, o resto sobe
o **patch**. `feat!`/`BREAKING CHANGE` sobe o minor enquanto o major for 0 e
avisa; ir para `1.0.0` é decisão de produto (`npm run release major`). Para ver
sem escrever: `npm run release -- --dry-run`.

**Um release por entrega, na `develop`.** O `master` recebe a mesma versão pelo
`merge --ff-only` de sempre; dois releases criariam duas versões dividindo o
mesmo tráfego, e o painel mostraria duas linhas onde houve um deploy só.

`CHANGELOG.md` é GERADO, não edite à mão. Ele existe porque `0.6.0` sozinho não
é resposta: quando o painel disser que uma versão encareceu uma rota, é o
CHANGELOG que diz o que mudou e a tag que abre o código exato
(`git diff v0.5.0 v0.6.0 -- src/features/session/server/prompts/`). Guia completo em
[`docs/versionamento.md`](docs/versionamento.md).

## Ambientes

Dois conjuntos independentes de Supabase, Stripe e URL, escolhidos por
`.env.dev` e `.env.prod`. **Nenhum dos dois é lido pelo Next sozinho**:
`src/scripts/with-env.mjs` injeta o certo e só então sobe o comando. Ele ABORTA se
achar qualquer arquivo que o Next carregaria por conta própria (`.env`,
`.env.local`, `.env.development[.local]`, `.env.production[.local]`), se achar
`sk_live_` no `.env.dev`, ou se os dois arquivos apontarem para o mesmo
Supabase. **Não crie `.env.local`**, o modelo é `.env.example`, o único da
família no git.

Na Vercel é um projeto só: `master` → `scriba.cc` (Production), `develop` →
`dev.scriba.cc` (Preview, env vars fixadas no branch). Cron da Vercel só roda
em produção, então `/api/billing/sweep` não existe em dev.

Variável nova: schema Zod em `src/lib/env/{server,client}.ts` **e** a linha no
`.env.example`, nos dois arquivos locais e no painel da Vercel (escopos
Production **e** Preview). Guia completo em `docs/ambientes.md`.

## O que deliberadamente NÃO existe

Não adicione sem pedido, o usuário sabe e adiou:

- Respostas em streaming (SSE).
- Framework de i18n. As strings pt-BR ficam inline por enquanto.
- Gravar sem internet. Gravar não depende de rede, mas a sessão nasce de um
  `POST` no stop; sem ele o áudio fica guardado no IndexedDB esperando — com
  cartão na Biblioteca, motivo escrito e retentativa automática, mas esperando
  (ver `src/features/session/AGENTS.md`).

**Testes existem em UM lugar só, e continuam não sendo o padrão do
repositório.** `npm test` roda `node --test` sobre `src/lib/**/*.test.ts`, e hoje
isso é `src/features/admin/finance/*`: aritmética de dinheiro, pura e sem banco, onde um erro
de arredondamento vira decisão de negócio errada. Não acrescente teste em outra
camada sem pedido; a ausência deles no resto é escolha, não dívida.

## Como estes documentos funcionam

O `AGENTS.md` de cada pasta descreve **por que** as coisas são como são, não o
que elas fazem — isso já está no cabeçalho de cada arquivo, e os cabeçalhos
deste repositório são bons. Ao mexer em algo, leia o cabeçalho do arquivo antes
de assumir que entendeu a intenção.

Quando você mudar um comportamento que um destes documentos descreve, atualize
o documento no MESMO commit. Um doc errado é pior que doc nenhum: ele é lido
com confiança.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
