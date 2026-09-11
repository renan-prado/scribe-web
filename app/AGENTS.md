# app/: rotas, API, proxy e SEO

Regras da camada de roteamento. Para a camada de servidor abaixo dela, ver
`lib/AGENTS.md`.

## Mapa de rotas

**Público** (o `proxy.ts` deixa passar sem sessão):

```
/                       landing. ESTÁTICA, ver a seção abaixo
/sign-in  /sign-up      entrada. /sign-up redireciona para /sign-in
/terms  /privacy        legais. Datadas; a data também está no sitemap
/about  /contact        páginas de confiança. Estáticas, chrome da landing
/parceiros              convite do programa de parceiros. Estática, pública.
                        NÃO confundir com /partners (o painel, atrás do login)
/parceiros/regulamento  as regras que obrigam. Datada, como /terms
/parceiros/entrar       marca o cookie de pré-parceiro e vai para /sign-in.
                        Não é página, irmã de /r/<slug>, e pelo mesmo motivo
/auth/callback          troca o code do OAuth por sessão. Valida o ?next=
/auth/sign-out
/r/[slug]               link do parceiro: marca a visita e devolve 302
/i/[code]               link de indicação de um usuário comum. 302 para a LP
/c/[code]               link de um CUPOM de convite: grava o cookie e manda
                        para /sign-in, onde a tela diz quanto ele vale
/api/stripe/webhook     ÚNICA porta de crédito. HMAC no lugar do cookie
/api/billing/sweep      cron diário da Vercel, guardado por CRON_SECRET
/robots.txt  /sitemap.xml  /manifest.webmanifest
/llms.txt  /index.md     resumo do produto para agentes. Fonte única em
                         src/shared/content/llms.ts; route handlers, não
                         arquivo estático
```

`GET /` com `Accept: text/markdown` é reescrito pelo `proxy.ts` para
`/index.md`, negociação de conteúdo (acceptmarkdown.com). A resposta Markdown
leva `Vary: Accept`; a HTML não (o Next é dono desse header nas rotas do App
Router, ver o comentário no `proxy.ts`).

**Autenticado** (`app/(app)/`, com header, nav e menu do avatar):

```
/feed                    cards de acompanhamento de TODAS as sessões
/recordings              sessões salvas + faixa "Gravações em aberto"
/studies                 aprofundamentos gerados
/profile
/recording/[id]/live       gravação modo live
/recording/[id]/audio      gravação modo audio_only
/recording/[id]/transcribe gravação modo transcript_only
/importar                  cola o link do vídeo e cria a sessão modo youtube
/recording/[id]/youtube    importação modo youtube: espera a legenda + resumo
/recording/[id]/summary    sessão salva: resumo final
/recording/[id]/transcript sessão salva transcript_only: a transcrição, e o
                           botão que gera o resumo dela sob demanda
/recording/[id]/deepening  o estudo da sessão (gerar exige plano Estudioso)
/billing/assinar           abre o Checkout (destino do CTA da landing)
/billing/retorno           volta do Checkout. DECORATIVA: não credita nada
```

`app/session/[id]` é rota LEGADA: um `permanentRedirect` para
`/recording/:id/summary`, preservado para que link antigo e bookmark não
quebrem. Não crie link novo apontando para ela.

`app/list` é o mesmo caso, e pela mesma razão: `/list` virou `/recordings`, e um
308 mantém de pé o bookmark, o atalho do PWA já instalado e o link que alguém
mandou por mensagem. As duas moram FORA do grupo `(app)` de propósito,
redirect não precisa de header, de nav nem das duas consultas ao banco do
`app/(app)/layout.tsx`, que renderiza em paralelo com a página.

**Restrito:** `/admin/*` (gate em `app/admin/layout.tsx`, responde `notFound()`
a quem não é admin) e `/partners` (gate em `lib/auth/require-partner.ts`).

As três rotas de link de entrada (`/r`, `/i`, `/c`) são irmãs e seguem as
mesmas decisões: são ROTAS e não páginas (para nenhuma delas custar a
estaticidade da LP), respondem 302 e não 308, e redirecionam também quando o
identificador é impossível. A única que difere no destino é `/c`, que vai para
`/sign-in` em vez da landing: um cupom é convite nominal, quem o abriu já disse
sim, e pôr a página de vendas no caminho é pôr um argumento diante de quem já
foi convencido. Nenhuma das três entra no `sitemap.ts` nem no `/llms.txt`, elas
não são conteúdo, são efeito colateral com redirect.

**API:** `app/api/`, pipelines de LLM (`transcribe`, `bible`, `insights`,
`sermon-echo`, `final-summary[/reprocess|/from-transcript]`,
`deepening[/reprocess]`, `verse`, `format-paragraphs`,
`hallucination-report`), dados (`sessions[/search]`, `feed`, `speakers`,
`locations`, `coins`, `feedback[/prompt]`, `tour/{start,finish,reset}`), cobrança (`billing/*`,
`stripe/webhook`) e admin (`admin/users`, `admin/partners`, `admin/features`,
`admin/coupons`, `admin/insights`).

`feedback/prompt` é **POST e não GET porque ESCREVE**: quando a resposta é
"sim, pergunte", a pergunta já nasce registrada em `feedback_prompts`, é o
que impede a janela de voltar quando a pessoa reabre a mesma página, e um GET
que grava seria disparado por qualquer prefetch do router. Nenhuma das duas
rotas cobra moedas, pela mesma razão de `hallucination-report`: quem está nos
ajudando a melhorar o produto não paga por isso. Ver
`src/features/feedback/AGENTS.md`.

`tour/start` é POST pela MESMA razão que `feedback/prompt`: quando a resposta é
"pode mostrar", o tour já nasce registrado em `user_tours`, e é isso que impede
a apresentação de voltar toda vez que a pessoa reabre a tela. As três rotas de
tour não cobram moedas e não chamam modelo nenhum. Ver
`src/features/tour/AGENTS.md`.

`youtube/import` é a QUARTA porta do mesmo pipeline de resumo, e a única cuja
transcrição não veio de um microfone: ela busca a legenda do vídeo em
`sessions.source_url`, grava como transcrição e roda resumo + releia/lembra/
frases por cima. A ordem dentro dela é `dono → já importada? → legenda →
duração → COBRA → resumo`, e a legenda vir ANTES da cobrança é uma inversão
deliberada em relação a `/reprocess` e `/api/deepening`, ela é a chamada
barata (~R$ 0,03) e é ela que diz se o vídeo é importável, então cobrar antes
obrigaria a estornar três recusas rotineiras. A regra que aquelas rotas
protegem continua valendo: a chamada CARA (o resumo) só roda depois do débito.
Ver o cabeçalho da rota.

`final-summary/from-transcript` é a terceira porta do MESMO pipeline de resumo:
ela gera o primeiro resumo de uma sessão gravada no modo transcrição, que sai
da gravação sem `final_summary`. Cobra `summary_from_transcript` (15, o mesmo
do reprocessamento, é o mesmo trabalho) e recusa com 409 uma sessão que já
tem resumo; refazer um resumo existente continua sendo `/reprocess`. Ver
`src/features/session/AGENTS.md`.

`sessions/search` é a metade SERVIDOR da busca das listas, e responde a DUAS
perguntas sobre a mesma sessão: o que foi DITO (`ilike` na transcrição) e o que
foi CITADO (os versículos). A segunda não é busca de texto, "Jonas 1" precisa
achar o card que diz "Jonas 1:1-17", e o pregador falou "no primeiro capítulo de
Jonas", que não contém nenhuma das duas strings. Quem compara referência com
referência é `lib/domain/reference-query.ts`; a peneira por livro é a RPC
`session_verse_references` (migrações 0041/0042). A resposta separa as duas
vias porque o cartão mostra POR QUE está ali, "trecho na transcrição" ou a
referência que casou. Não chama modelo, então não passa por `requireBalance`,
mesma razão de `/api/verse`.

## O proxy é o gate, não a página

`proxy.ts` (o antigo middleware) roda em todo request não-estático. Ele renova
o cookie do Supabase e decide o bucket da rota. **Não insira código entre
`createServerClient` e `supabase.auth.getUser()`**, reescrever cookie no meio
quebra o handshake de refresh do `@supabase/ssr`.

- Anônimo em rota protegida → `/sign-in?next=<path>`.
- Anônimo (ou logado) num caminho que **não é** público nem bate com
  `KNOWN_APP_PREFIXES` → passa direto, e o Next responde `404`
  (`app/not-found.tsx`). Sem isso o proxy mandava todo caminho inexistente para
  `/sign-in` e a Vercel devolvia `200` com a casca do app, um soft-404 que faz
  agente e rastreador concluírem que qualquer URL existe. **Rota nova numa área
  nova entra em `KNOWN_APP_PREFIXES` no mesmo commit.**
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
namespace público, um padrão que aceite `scribe-*.vercel.app` aceita um
domínio que qualquer pessoa registra, e o `Access-Control-Allow-Credentials:
true` está logo ali.

## CSP: por que ela não tem nonce

O proxy emite `Content-Security-Policy` em toda resposta. Ela existe porque o
cookie de sessão do `@supabase/ssr` é `httpOnly: false` por desenho, o client
do navegador lê o token com `document.cookie`, então aqui um XSS não vaza
dados, vaza a sessão, com um refresh token de 400 dias junto.

**Ela não usa nonce, e isso é escolha, não esquecimento.** Nonce muda a cada
requisição, logo a página que o embute no HTML não pode ser cacheada: usar
nonce OBRIGA renderização dinâmica, e a LP ser estática é invariante declarada
na seção abaixo. A troca, proteção contra script inline injetado em troca do
HTML da landing remontado na origem a cada visita, é decisão de produto, e
está em aberto de propósito.

Sem nonce, `script-src` precisa de `'unsafe-inline'` e a política compra menos:
ela bloqueia `<script src>` para host de fora, mas não inline injetado. Quem
faz o trabalho pesado é o `connect-src` restrito, cookie roubado só vale se
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
cliente, com limite por usuário E por IP, os comentários de cada bucket
explicam o número escolhido; escreva o seu também.

O passo 3 existe porque **a medição de consumo é feita pelo cliente**: quem
cobra o minuto de gravação é o navegador, chamando `/api/coins/charge`. Sem o
piso, um cliente que simplesmente não chamasse aquela rota transcrevia de graça
com saldo zero. `requireBalance` lê o saldo que `requireAuth` já trouxe, então
não custa consulta nenhuma. Rota que **não** chama modelo (`/api/verse`, que lê
a NVI do disco) não precisa dele; `/api/hallucination-report` é a exceção
deliberada, o usuário está reportando um defeito NOSSO, e cortá-lo no saldo
zero silenciaria justamente o aviso que queremos.

**Rota que recebe `sessionId` confere o dono ANTES do trabalho caro**, com um
`getSession`/`getSessionMeta` (que passam pela RLS e devolvem `null` para
sessão alheia). Confiar só na RLS do UPDATE lá no fim significa pagar a chamada
à OpenAI e descobrir depois, foi o que `/api/final-summary` fazia.

Débito de moedas passa por `chargeCoins` (`lib/db/coins.ts`), que hoje fala com
a RPC pelo **service-role**: `charge_coins` teve o EXECUTE revogado de
`authenticated` na migração 0037 porque, com ele, dava para chamar a função
direto do navegador e escolher o próprio preço. **Crédito não tem rota**, ver
`lib/billing/AGENTS.md`.

## `/api/verse` responde em LOTE

A rota devolve `{ passages: [...] }`, com todos os versículos de cada faixa, e
aceita `reference` (uma) ou `references` (até 24), o formato de resposta é o
mesmo nos dois casos, para o cliente não ter dois caminhos de parse.

Ela já foi uma referência por chamada, devolvendo texto corrido, e a UI pedia
VERSÍCULO A VERSÍCULO: sete requisições para "Isaías 1:11-17". Um estudo com
dezessete passagens passava das 60/min do `RATE_LIMITS.verse` em segundos, e os
versículos recusados voltavam vazios, a tela mostrava número sem texto, sem
nenhum erro visível. O lote é a correção da causa; o limite continua onde
estava e agora sobra.

Duas invariantes ao mexer aqui:

- **A resposta é uma LISTA de versículos, nunca texto concatenado.** A UI
  numera cada linha, e juntar no servidor obrigaria o cliente a resegmentar,
  impossível de fazer certo, porque o ponto final não delimita versículo. Quem
  precisa de texto corrido usa `joinVerses` (`lib/domain/verse.ts`).
- **Só voltam os versículos que EXISTEM.** Uma faixa que passa do fim do
  capítulo devolve menos linhas, não linhas vazias.

## Server Action é endpoint, não pedaço de página

Uma Server Action é um POST próprio, com id que é hash estável embutido no
bundle. O gate de um layout decide o que RENDERIZA, não o que executa: quem
souber o id invoca a action sem nunca ter passado pelo layout. **Toda action
privilegiada reconfere a autorização dentro de si**, `assertAdmin()` nas
actions de admin (ver `lib/auth/require-admin.ts`).

Quando a proteção real for a RLS e não a página, escreva isso no código: o
`deleteSessionAction` do `/recordings` está protegido pela policy, e trocar o
client do usuário pelo service-role ali o transformaria num IDOR sem sinal
nenhum no diff.

## Landing page: o que não pode voltar

A LP é a única página que um visitante anônimo carrega. Duas regras a
protegem, e as duas são fáceis de desfazer sem perceber.

**`app/page.tsx` é ESTÁTICA. Nada nela lê cookie, sessão ou header.** Uma
única chamada a `supabase.auth.getUser()` ali dentro marca a rota como
dinâmica, e o efeito é desproporcional: a resposta passa a sair com
`Cache-Control: private, no-store` e `X-Vercel-Cache: MISS`, HTML remontado
na origem a cada visita, com DUAS idas ao Supabase antes do primeiro byte,
numa página cujo conteúdo é idêntico para todo anônimo. O `no-store` ainda
derrubava o bfcache, então voltar para a LP recarregava tudo. O redirect de
quem já está logado mora no `proxy.ts`, que já tem o usuário resolvido.

**Quando a LP precisar mesmo se personalizar, o caminho é o do `HeroEyebrow`.**
O selo "indicado por Fulano" que aparece acima do título do hero depende de
um cookie, e resolvê-lo no servidor custaria tudo que o parágrafo acima
descreve. O desenho: as rotas de link gravam um cookie-PISTA legível por JS
(`scriba_ref_hint=1`, sem nome nem código dentro), um componente cliente só
consulta `/api/referral/active` SE a pista existir, e a resposta é `no-store`.
Assim os 99% que não vieram de link nenhum não pagam requisição alguma, e o
HTML continua saindo da CDN. A pílula nasce ESCONDIDA e só existe quando há
indicação a anunciar: um script antes do primeiro paint (irmão do
`ThemeScript`) marca o `<html>`, e o CSS mostra um esqueleto de altura fixa
até a resposta chegar, então nem quem veio indicado vê o título saltar.

Quem garante que a pista existe é o `healReferralHint` do `proxy.ts`: um cookie
novo não retroage aos 30 dias de atribuições que já estavam em circulação, e
sem essa cura o selo não aparecia para exatamente quem já tinha clicado num
link. Detalhes em `src/features/referrals/AGENTS.md`.

**A LP não importa componente `"use client"` de `src/features/`.** As telas
dentro dos mockups de celular são markup estático em
`src/shared/components/LandingMocks.tsx`. Antes elas montavam o `<Feed>` e o
`<SummaryView>` reais, o que arrastava `FeedItemCard`, `VerseDialog` (com o
Dialog do base-ui), `useVerseFetch`, `PassageVerses` e os
skeletons para o bundle da landing, o app de gravação inteiro baixado para
exibir cinco cards que nunca mudam e nunca respondem a clique. Reusar um
server component (o `BlockRenderer`, por exemplo) continua liberado: ele não
custa bundle. O preço, mexer no `FeedItemCard` não atualiza mais a LP, é
aceito de propósito: as duas telas mudam por razões diferentes.

**Imagens:** nada de `<img>` para host externo, e a exceção aparente confirma
a regra: a foto de quem indicou (`lh3.googleusercontent.com`) entra por
`next/image` com `remotePatterns` no `next.config.ts`, ou seja, servida
otimizada e redimensionada A PARTIR DO NOSSO domínio, com width/height. Um host
só, e fechado: `remotePatterns` frouxo transforma `/_next/image` em proxy de
imagem aberto para qualquer um lavar tráfego pela nossa conta.

A LP já teve sete avatares de `mockmind-api.uifaces.co`, 1024×1024 para
desenhar círculos de 34px, 724 KB que o React 19 ainda promovia a
`<link rel="preload" as="image">`, disputando a banda inicial com o CSS.
Viraram sete WebP de 136px no nosso bundle, e depois sumiram junto com os
depoimentos e a linha de prova social; os arquivos foram apagados no mesmo
commit, porque asset sem consumidor volta a ser usado por engano. **A regra que
eles deixaram continua valendo: imagem decorativa nova entra por import
estático, em WebP, no tamanho de tela vezes quatro** — o import dá
`width`/`height` de graça, e é isso que evita CLS.

**As duas regras acima valem para `/parceiros` também.** Ela é a segunda página
que um anônimo carrega, é estática pelas mesmas razões, e sua prévia do painel
do parceiro é markup próprio justamente para não arrastar `PartnerTabs`,
`EarningsByPlan` e o `RefreshPanelButton`, todos `"use client"`, para o bundle
de uma página que ninguém clica. Ver `docs/parceiros.md` § As páginas públicas
do programa.

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
  indexável, `/sign-up` é redirect e `/sign-in` é tela de login com `?next=`
  multiplicando variantes; ambas ficam fora, e o resto do app está atrás do
  proxy (para o rastreador, `307 → /sign-in`).
- Título ≤ ~60 caracteres, descrição ≤ ~155, escritos com o vocabulário de
  quem PROCURA. "Transcrever sermão" e "estudo bíblico" são os termos reais.
- `robots.ts`, `sitemap.ts` e `manifest.ts` NÃO podem ficar atrás do muro de
  autenticação, já ficaram.
- **Página pública nova entra em TRÊS listas no mesmo commit**: `PUBLIC_PREFIXES`
  do `proxy.ts` (sem isso ela responde `307 → /sign-in` para quem não tem
  conta, que é exatamente o público dela), `app/sitemap.ts` e os `Links` do
  `/llms.txt`. Foi o caminho de `/parceiros`.
- **Conteúdo para agentes** (`/llms.txt`, `/index.md`) sai de
  `src/shared/content/llms.ts`, um lugar só, mesma regra de `lib/seo.ts`. A
  seção "Quando usar o Scriba" existe porque o produto não tem API pública: a
  orientação certa para um agente é mandar a pessoa criar conta. Página nova de
  confiança (`/about`, `/contact`) entra na lista de `Links` de lá.
- **Caminho inexistente responde `404` de verdade**, não `307 → /sign-in`. A
  lógica está no `proxy.ts` (`KNOWN_APP_PREFIXES`); o `app/not-found.tsx`
  aponta para o sitemap e o `/llms.txt`.

## Ícones e metadata

`metadata.icons` no `app/layout.tsx` SUPRIME as convenções `app/icon.*` e
`app/apple-icon.*`, mas NÃO suprime `app/favicon.ico`, esse é emitido junto.
Por isso o `apple-touch-icon` está declarado à mão: o arquivo era servido, mas
nenhum `<link>` apontava para ele. O bloco existe porque só ele expressa
`prefers-color-scheme`; a convenção de arquivo emite `<link>` sem `media`.

**O Google não aceita SVG como favicon** (a lista dele é BMP, GIF, ICO, PNG,
JPEG, PPM, TIFF). Enquanto o site declarou só os dois SVGs, e ainda atrás de
`media`, que rastreador não avalia, a busca mostrava o ícone antigo e
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
que o código lê, ver `lib/bibles/loader.ts` antes de adicionar outra.

`public/sw.js` faz duas coisas: existir (é requisito para o navegador nos
tratar como PWA instalável) e servir `public/offline.html` quando uma
**navegação GET** falha por falta de rede. Ele nunca é registrado em dev
(`PwaBootstrap`): service worker + HMR gera loop de código velho difícil de
depurar.

**Ele não cacheia o app, e isso é decisão.** O conteúdo aqui muda a cada
segundo, transcrição, feed, saldo, e cache velho não apareceria como bug de
cache: apareceria como sessão que perdeu texto. O único cache é a casca da tela
offline (`offline.html` + `pena.svg`), que é estática. `offline.html` está na
exclusão do `matcher` do proxy porque quem a busca é o `install` do SW, e
`cache.addAll` REJEITA resposta redirecionada, atrás do proxy, um visitante
anônimo derrubaria a instalação inteira do service worker.

`offline.html` é o ÚNICO arquivo do projeto onde cor literal é aceitável: sem
rede, o CSS do Next não carrega. Os valores lá são cópia dos tokens e precisam
ser atualizados junto com eles.

### A barra de status segue o tema

A cor da barra do sistema no PWA sai de `<meta name="theme-color">`, escrita
pelo `ThemeScript` antes do primeiro paint e reescrita pelo `useTheme` a cada
troca de tema. Ela **não** pode ser declarada em `metadata`/`viewport` do Next:
o tema do Scriba vem do localStorage, não do `prefers-color-scheme`, que é a
única coisa que uma meta estática sabe expressar. O `theme_color` do manifest é
o fallback (valor claro). Os dois hexadecimais moram em
`src/shared/theme-color.ts`.

O `viewport` do root layout declara `viewport-fit=cover`, é o que faz
`env(safe-area-inset-*)` valer diferente de zero. Quem consome os insets é a
`MobileBottomNav` e os botões flutuantes de gravação; sem eles o iPhone desenha
a nav por baixo da barra do gesto do sistema. Zoom fica liberado
(`maximumScale: 5`): travar o pinch é violação de acessibilidade.

### Estar dentro do app é uma pergunta com resposta

`useIsStandalone` (`src/shared/hooks/use-standalone.ts`) é o único lugar que
responde "esta janela é o app instalado?". Ele une a media query
`display-mode` (Android, desktop) com o `navigator.standalone` da Apple, que
segue sendo a única forma de saber isso no iOS. **Não refaça essa checagem
solta em outro componente**, quem precisa dela importa o hook.

Ela vale a JANELA, não o aparelho: alguém pode ter o Scriba na tela inicial e
estar lendo numa aba comum. O `ready` do hook é falso no servidor e no primeiro
render; quem desenha coisas diferentes para os dois casos espera por ele, senão
o estado errado pisca.

Três consumidores hoje:

- `useInstallPrompt`: não oferece instalação a quem já está dentro do app. No
  Android é o `beforeinstallprompt`; no iOS não existe API e o botão só ENSINA
  o caminho do menu Compartilhar. Dois lugares o usam:
  - `InstallAppCard`, **no `/feed`** e só nele, a primeira tela de toda sessão
    de uso e a única em que a pessoa está olhando em volta em vez de terminando
    alguma coisa. `no-touch:hidden`. O X é dispensa LEVE: some nesta visita e volta na
    próxima vez que o `/feed` montar, no celular/tablet o convite nunca some de
    vez. O caminho que pode ser adiado de vez é o `/profile` (`InstallAppRow`).
  - `LandingCta`: o CTA da landing. **O rótulo é o MESMO no celular e no
    desktop** ("Começar grátis" na hero e no CTA final, "Começar" no header,
    o `cta` do catálogo no card do Gratuito). Em aparelho de toque o CTA não
    navega: abre o `InstallChoiceDialog`, com "Instalar o app" e "Usar no
    navegador" lado a lado. **Os dois botões são os mesmos nos dois sistemas.**
    O que muda é o que o primeiro FAZ: no Android ele dispara o
    `beforeinstallprompt`; no iPhone e no iPad, onde não existe API de
    instalação, ele troca o conteúdo do diálogo pelo passo a passo do menu
    Compartilhar. Mostrar os passos DE SAÍDA no aparelho da Apple, como já foi
    feito, trocava a pergunta por uma aula: a mesma decisão chegava com duas
    caras conforme o sistema. Quem não tem nada a escolher
    (`method === "none"`: app já instalado, ou navegador que não instala) vai
    direto para o `href`, sem diálogo. No desktop é o `<Link>` de sempre, com o
    mesmo texto e as mesmas classes, para o HTML estático não mudar. Cliente
    puro como o `StandaloneHomeGuard`; o diálogo entra por `dynamic` e só monta
    no primeiro toque, para o Dialog do base-ui não pesar no bundle da LP.

    A versão anterior trocava o texto por "Instalar app" no celular e mandava
    "Conhecer o Scriba" para a frente na coluna, para compensar. Era o primeiro
    toque da página pedindo espaço no telefone antes de o produto ter mostrado
    qualquer coisa. **Perguntar depois do toque mantém a instalação à mão sem
    transformá-la em pedágio**, e foi o que devolveu o CTA à primeira posição
    também no celular.

  **O corte é `touch`/`no-touch`, não um breakpoint.** A pergunta aqui é "isto
  é um celular ou tablet?", e nenhuma largura responde: o corte já foi `lg`
  (1024px), escolhido porque o iPad em RETRATO cai abaixo dele, e o mesmo iPad
  DEITADO mede 1024px. Ele caía no bucket "desktop" e perdia a única porta de
  instalação que tem, sem nada na tela dizendo por quê. Não existe largura que
  separe um tablet deitado de um notebook; o que separa é o HOVER, o mesmo
  critério do pressionado, e pela mesma razão (um notebook com tela sensível
  continua tendo mouse). As variantes moram em `app/globals.css`, ao lado da
  `dark`.

  Isso vale onde o alvo é o APARELHO. Para largura de viewport, que é sobre o
  LAYOUT caber, os breakpoints continuam sendo a ferramenta certa.
- `StandaloneHomeGuard`: ver abaixo.

### O app instalado nunca abre na landing

`start_url` é `/sign-in`, e não `/`. Quem tocou no ícone já foi convencido; a
LP é peça de venda. Com sessão, o proxy encaminha `/sign-in` para `/feed`
(`AUTH_ONLY_PREFIXES`); sem sessão, é exatamente a tela necessária. O `id: "/"`
do manifest é o que torna essa linha editável, sem ele a identidade do app
seria a própria `start_url`, e mudá-la faria o Chrome instalar um app novo.

A `start_url` sozinha não basta: o "Adicionar à Tela de Início" do iOS guarda a
URL da página ABERTA, que na hora de instalar é quase sempre a landing. Por
isso o `StandaloneHomeGuard` na LP troca `/` por `/sign-in` quando a janela é o
app. Ele é cliente puro justamente para não custar a estaticidade da página.

### Splash

Android monta a tela de abertura com o `background_color` do manifest
(`#1C2349`, o topo do gradiente da hero no tema escuro). **O iOS ignora isso**:
sem `apple-touch-startup-image` casando exatamente com o aparelho, ele abre o
app numa tela branca. As imagens saem de `scripts/generate-splash.mjs` e os
`<link>` de `src/shared/splash.ts`, as duas metades leem o MESMO
`src/shared/splash-screens.json`, e aparelho novo é uma linha lá mais uma
rodada do script.
