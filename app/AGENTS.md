# app/ — rotas, API, proxy e SEO

Regras da camada de roteamento. Para a camada de servidor abaixo dela, ver
`lib/AGENTS.md`.

## Mapa de rotas

**Público** (o `proxy.ts` deixa passar sem sessão):

```
/                       landing. ESTÁTICA — ver a seção abaixo
/sign-in  /sign-up      entrada. /sign-up redireciona para /sign-in
/terms  /privacy        legais. Datadas; a data também está no sitemap
/auth/callback          troca o code do OAuth por sessão. Valida o ?next=
/auth/sign-out
/r/[slug]               link do parceiro: marca a visita e devolve 302
/api/stripe/webhook     ÚNICA porta de crédito. HMAC no lugar do cookie
/api/billing/sweep      cron diário da Vercel, guardado por CRON_SECRET
/robots.txt  /sitemap.xml  /manifest.webmanifest
```

**Autenticado** (`app/(app)/`, com header, nav e menu do avatar):

```
/feed                    cards de acompanhamento de TODAS as sessões
/list                    sessões salvas + faixa "Gravações em aberto"
/studies                 aprofundamentos gerados
/profile
/recording/[id]/live       gravação modo live
/recording/[id]/audio      gravação modo audio_only
/recording/[id]/transcribe gravação modo transcript_only
/recording/[id]/summary    sessão salva: resumo final
/recording/[id]/transcript sessão salva transcript_only: só a transcrição
/recording/[id]/deepening  o estudo da sessão (gerar exige plano Estudioso)
/billing/assinar           abre o Checkout (destino do CTA da landing)
/billing/retorno           volta do Checkout. DECORATIVA: não credita nada
```

`app/session/[id]` é rota LEGADA: um `permanentRedirect` para
`/recording/:id/summary`, preservado para que link antigo e bookmark não
quebrem. Não crie link novo apontando para ela.

**Restrito:** `/admin/*` (gate em `app/admin/layout.tsx`, responde `notFound()`
a quem não é admin) e `/partners` (gate em `lib/auth/require-partner.ts`).

**API:** `app/api/` — pipelines de LLM (`transcribe`, `bible`, `insights`,
`sermon-echo`, `final-summary[/reprocess]`, `deepening[/reprocess]`, `verse`,
`format-paragraphs`, `hallucination-report`), dados (`sessions`, `feed`,
`speakers`, `locations`, `coins`), cobrança (`billing/*`, `stripe/webhook`) e
admin (`admin/users`, `admin/partners`, `admin/features`, `admin/insights`).

## O proxy é o gate, não a página

`proxy.ts` (o antigo middleware) roda em todo request não-estático. Ele renova
o cookie do Supabase e decide o bucket da rota. **Não insira código entre
`createServerClient` e `supabase.auth.getUser()`** — reescrever cookie no meio
quebra o handshake de refresh do `@supabase/ssr`.

- Anônimo em rota protegida → `/sign-in?next=<path>`.
- Autenticado em `/sign-in`, `/sign-up` ou `/` → `/feed`.
- `?next=` passa por `safeNextPath`, e o `/auth/callback` faz a checagem
  equivalente: só caminho relativo, recusando `//host`, `/\host` e `/%2F…`.
  Um `next` frouxo no login é open redirect assinado pelo nosso domínio.
- O proxy sai CEDO, antes de instanciar o client do Supabase, quando o path é
  `/` e não há nenhum cookie `sb-*`: sem sessão não há o que renovar.

A allowlist `PUBLIC_PREFIXES` existe porque cada entrada dela chega sem cookie
por natureza (Stripe, cron da Vercel, visitante do link de parceiro). Cada uma
se defende sozinha dentro da própria rota. Remover `/api/stripe` quebra todo o
faturamento em silêncio.

A allowlist de ORIGEM do CORS é outra coisa e tem outra regra: o padrão de
preview precisa terminar em `-renanprados-projects.vercel.app`. `vercel.app` é
namespace público — um padrão que aceite `scribe-*.vercel.app` aceita um
domínio que qualquer pessoa registra, e o `Access-Control-Allow-Credentials:
true` está logo ali.

## CSP: por que ela não tem nonce

O proxy emite `Content-Security-Policy` em toda resposta. Ela existe porque o
cookie de sessão do `@supabase/ssr` é `httpOnly: false` por desenho — o client
do navegador lê o token com `document.cookie` — então aqui um XSS não vaza
dados, vaza a sessão, com um refresh token de 400 dias junto.

**Ela não usa nonce, e isso é escolha, não esquecimento.** Nonce muda a cada
requisição, logo a página que o embute no HTML não pode ser cacheada: usar
nonce OBRIGA renderização dinâmica, e a LP ser estática é invariante declarada
na seção abaixo. A troca — proteção contra script inline injetado em troca do
HTML da landing remontado na origem a cada visita — é decisão de produto, e
está em aberto de propósito.

Sem nonce, `script-src` precisa de `'unsafe-inline'` e a política compra menos:
ela bloqueia `<script src>` para host de fora, mas não inline injetado. Quem
faz o trabalho pesado é o `connect-src` restrito — cookie roubado só vale se
der para mandá-lo a algum lugar, e daqui só saem requisições para nós, para o
Supabase e para o GA. Origem nova no cliente (um provedor de analytics, um CDN
de imagem que responda a `fetch`) entra ali, ou falha em silêncio no navegador
de quem usa.

## Receita de uma rota de API nova

Toda rota que chama a OpenAI segue esta ordem, sem exceção:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const log = createLogger("foo");

export async function POST(request: Request) {
  const auth = await requireAuth();              // 1. sessão
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.foo, auth.user.id);
  if (limited) return limited;                   // 2. cadência

  const broke = requireBalance(auth.user);       // 3. crédito
  if (broke) return broke;

  const parsed = await parseJsonBody(request, FooBodySchema);
  if (!parsed.ok) return parsed.response;        // 4. Zod, nunca cast

  const result = await callChat({                // 5. sempre via lib/llm
    model: serverEnv.OPENAI_FOO_MODEL,
    messages: [{ role: "system", content: FOO_SYSTEM_PROMPT }, ...],
    store: true,
    metadata: buildLlmMetadata({ route: "foo", userId: auth.user.id, sessionId }),
  });
  // 6. parseFooFromLLM() do lib/domain, nunca JSON.parse à mão
  // 7. recordChatUsage() para o custo aparecer em /admin/usage
  // 8. log.debug("ok", { latencyMs, finishReason, promptTokens, completionTokens })
}
```

Os cinco primeiros passos são obrigatórios e nessa ordem. O bucket em
`RATE_LIMITS` (`lib/rate-limit.ts`) é dimensionado pela cadência real do
cliente, com limite por usuário E por IP — os comentários de cada bucket
explicam o número escolhido; escreva o seu também.

O passo 3 existe porque **a medição de consumo é feita pelo cliente**: quem
cobra o minuto de gravação é o navegador, chamando `/api/coins/charge`. Sem o
piso, um cliente que simplesmente não chamasse aquela rota transcrevia de graça
com saldo zero. `requireBalance` lê o saldo que `requireAuth` já trouxe, então
não custa consulta nenhuma. Rota que **não** chama modelo (`/api/verse`, que lê
a NVI do disco) não precisa dele; `/api/hallucination-report` é a exceção
deliberada — o usuário está reportando um defeito NOSSO, e cortá-lo no saldo
zero silenciaria justamente o aviso que queremos.

**Rota que recebe `sessionId` confere o dono ANTES do trabalho caro**, com um
`getSession`/`getSessionMeta` (que passam pela RLS e devolvem `null` para
sessão alheia). Confiar só na RLS do UPDATE lá no fim significa pagar a chamada
à OpenAI e descobrir depois — foi o que `/api/final-summary` fazia.

Débito de moedas passa por `chargeCoins` (`lib/db/coins.ts`), que hoje fala com
a RPC pelo **service-role**: `charge_coins` teve o EXECUTE revogado de
`authenticated` na migração 0037 porque, com ele, dava para chamar a função
direto do navegador e escolher o próprio preço. **Crédito não tem rota** — ver
`lib/billing/AGENTS.md`.

## `/api/verse` responde em LOTE

A rota devolve `{ passages: [...] }`, com todos os versículos de cada faixa, e
aceita `reference` (uma) ou `references` (até 24) — o formato de resposta é o
mesmo nos dois casos, para o cliente não ter dois caminhos de parse.

Ela já foi uma referência por chamada, devolvendo texto corrido, e a UI pedia
VERSÍCULO A VERSÍCULO: sete requisições para "Isaías 1:11-17". Um estudo com
dezessete passagens passava das 60/min do `RATE_LIMITS.verse` em segundos, e os
versículos recusados voltavam vazios — a tela mostrava número sem texto, sem
nenhum erro visível. O lote é a correção da causa; o limite continua onde
estava e agora sobra.

Duas invariantes ao mexer aqui:

- **A resposta é uma LISTA de versículos, nunca texto concatenado.** A UI
  numera cada linha, e juntar no servidor obrigaria o cliente a resegmentar —
  impossível de fazer certo, porque o ponto final não delimita versículo. Quem
  precisa de texto corrido usa `joinVerses` (`lib/domain/verse.ts`).
- **Só voltam os versículos que EXISTEM.** Uma faixa que passa do fim do
  capítulo devolve menos linhas, não linhas vazias.

## Server Action é endpoint, não pedaço de página

Uma Server Action é um POST próprio, com id que é hash estável embutido no
bundle. O gate de um layout decide o que RENDERIZA, não o que executa: quem
souber o id invoca a action sem nunca ter passado pelo layout. **Toda action
privilegiada reconfere a autorização dentro de si** — `assertAdmin()` nas
actions de admin (ver `lib/auth/require-admin.ts`).

Quando a proteção real for a RLS e não a página, escreva isso no código: o
`deleteSessionAction` do `/list` está protegido pela policy, e trocar o client
do usuário pelo service-role ali o transformaria num IDOR sem sinal nenhum no
diff.

## Landing page — o que não pode voltar

A LP é a única página que um visitante anônimo carrega. Duas regras a
protegem, e as duas são fáceis de desfazer sem perceber.

**`app/page.tsx` é ESTÁTICA. Nada nela lê cookie, sessão ou header.** Uma
única chamada a `supabase.auth.getUser()` ali dentro marca a rota como
dinâmica, e o efeito é desproporcional: a resposta passa a sair com
`Cache-Control: private, no-store` e `X-Vercel-Cache: MISS` — HTML remontado
na origem a cada visita, com DUAS idas ao Supabase antes do primeiro byte,
numa página cujo conteúdo é idêntico para todo anônimo. O `no-store` ainda
derrubava o bfcache, então voltar para a LP recarregava tudo. O redirect de
quem já está logado mora no `proxy.ts`, que já tem o usuário resolvido.

**A LP não importa componente `"use client"` de `src/features/`.** As telas
dentro dos mockups de celular são markup estático em
`src/shared/components/LandingMocks.tsx`. Antes elas montavam o `<Feed>` e o
`<SummaryView>` reais, o que arrastava `FeedItemCard`, `VerseDialog` (com o
Dialog do base-ui), `useVerseFetch`, `PassageVerses`, `ScribaComment` e os
skeletons para o bundle da landing — o app de gravação inteiro baixado para
exibir cinco cards que nunca mudam e nunca respondem a clique. Reusar um
server component (o `BlockRenderer`, por exemplo) continua liberado: ele não
custa bundle. O preço — mexer no `FeedItemCard` não atualiza mais a LP — é
aceito de propósito: as duas telas mudam por razões diferentes.

**Imagens:** nada de `<img>` para host externo. Sete avatares de
`mockmind-api.uifaces.co` (1024×1024 para desenhar círculos de 34px) custavam
724 KB, e o React 19 ainda os promovia a `<link rel="preload" as="image">`,
disputando a banda inicial com o CSS. Hoje são sete WebP de 136px em
`src/shared/assets/avatars/` (20 KB no total) servidos por `next/image` com
import estático — que também traz `width`/`height` de graça, sem CLS.

**A LP não tem números próprios.** Nome, preço e créditos dos cards de
`/#planos` saem de `lib/billing/plans.ts`, o mesmo catálogo do diálogo de
compra e do `/profile`. Só a lista de recursos (`PLAN_FEATURES` em
`app/page.tsx`) é copy local, porque descreve capacidades, não valores. Antes
disso a LP anunciava 2.000/5.000/100 créditos contra os 1.000/2.500/50 reais:
preço de tela errado é promessa quebrada no checkout.

## SEO

`lib/seo.ts` é a fonte única de domínio, nome, título e descrição. Um
`metadataBase` divergindo do `Sitemap:` do robots é o tipo de erro que só
aparece semanas depois, num relatório do Search Console.

- **Só produção é indexável.** `IS_INDEXABLE` deriva de `IS_PRODUCTION_DEPLOY`.
  `dev.scriba.cc` é um Preview com domínio fixo: HTML público servido de
  domínio próprio, e a Vercel NÃO manda `X-Robots-Tag: noindex` nesse caso.
  Sem a checagem, o ambiente de dev entra no índice competindo com `scriba.cc`
  por conteúdo idêntico.
- `app/robots.ts` e `app/sitemap.ts` são código, não arquivo estático, porque
  o ambiente precisa decidir. Só entra no sitemap URL que responde 200 e é
  indexável — `/sign-up` é redirect e `/sign-in` é tela de login com `?next=`
  multiplicando variantes; ambas ficam fora, e o resto do app está atrás do
  proxy (para o rastreador, `307 → /sign-in`).
- Título ≤ ~60 caracteres, descrição ≤ ~155, escritos com o vocabulário de
  quem PROCURA. "Transcrever sermão" e "estudo bíblico" são os termos reais.
- `robots.ts`, `sitemap.ts` e `manifest.ts` NÃO podem ficar atrás do muro de
  autenticação — já ficaram.

## Ícones e metadata

`metadata.icons` no `app/layout.tsx` SUPRIME as convenções `app/icon.*` e
`app/apple-icon.*`, mas NÃO suprime `app/favicon.ico` — esse é emitido junto.
Por isso o `apple-touch-icon` está declarado à mão: o arquivo era servido, mas
nenhum `<link>` apontava para ele. O bloco existe porque só ele expressa
`prefers-color-scheme`; a convenção de arquivo emite `<link>` sem `media`.

**O Google não aceita SVG como favicon** (a lista dele é BMP, GIF, ICO, PNG,
JPEG, PPM, TIFF). Enquanto o site declarou só os dois SVGs — e ainda atrás de
`media`, que rastreador não avalia — a busca mostrava o ícone antigo e
`/favicon.ico` dava 404. Por isso `app/favicon.ico` existe e não pode sumir de
novo, e por isso o logo do JSON-LD e os ícones do manifest são PNG: o Chrome
não instala PWA com ícone SVG. O inventário completo dos arquivos de marca e a
ordem de regeneração estão em `src/shared/AGENTS.md`.

## Headers e PWA

`next.config.ts` aplica em `/(.*)`: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` e um `Permissions-Policy` que libera
`microphone=(self)` e `autoplay=(self)` (o keepalive de áudio silencioso
precisa) e bloqueia câmera e geolocalização.

`instrumentation.ts` aquece a NVI no boot do runtime Node para que a primeira
chamada a `/api/verse` não pague o parse de 4 MB de JSON. É a ÚNICA tradução
que o código lê — ver `lib/bibles/loader.ts` antes de adicionar outra.

`public/sw.js` existe essencialmente para o navegador nos tratar como PWA
instalável. Ele nunca é registrado em dev (`PwaBootstrap`): service worker +
HMR gera loop de código velho difícil de depurar.
