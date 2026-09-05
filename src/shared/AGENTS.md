# src/shared — tema, marca, UI base e acessibilidade

O que é comum às features. Se algo aqui muda, muda em todas as telas — leia
antes de editar.

```
brand/       a pena e o logotipo. UM arquivo tem o <path>
ui/          primitivas shadcn sobre base-ui
components/  chrome do app: header, nav, providers, tema, analytics, LP mocks
hooks/       use-theme, use-mobile, use-read-flag
icons/       glifos próprios
assets/      avatares WebP da landing
content/     copy estruturada (FAQ da landing)
```

## Tema

Claro e escuro por uma única classe `.dark` no `<html>`. **Não existe ramo de
tema por componente.**

**Nunca escreva uma cor literal num `className`.** Nada de `bg-white`,
`bg-[#EAF2FA]`, `fill="#F8C64B"`. Toda cor vem de um token `--scriba-*` /
`--session-*` / shadcn declarado em **ambos** `:root` e `.dark` em
`app/globals.css`. Token novo entra em TRÊS lugares: `:root`, `.dark`, e o mapa
`@theme inline` que o expõe como utilitário.

Superfícies, do fundo para a frente:

| Token | Papel |
|---|---|
| `bg-background` | o chão da página |
| `bg-scriba-surface` | a faixa rebaixada entre o chão e o papel |
| `bg-scriba-paper` | a superfície elevada: cards, diálogos, sheets, popovers |

`text-white` / `bg-white` literais só são aceitáveis sobre uma superfície que
é a MESMA cor nos dois temas (`bg-scriba-blue`, `bg-scriba-rec`,
`bg-scriba-yellow`, os gradientes fixos da landing). Qualquer coisa sobre
`bg-scriba-ink-strong` usa `text-background`, porque esse token inverte.

Uma variante `dark:` é a ferramenta certa para o caso raro que não é paleta
(opacidade de scrim de modal). Se o valor é uma cor, prefira token.

**O padrão é o tema CLARO**, não o `prefers-color-scheme` do sistema. O escuro
é uma opção que o usuário liga; quem nunca escolheu vê a mesma interface da
landing page, onde a marca foi calibrada. A decisão mora no `ThemeScript`
(`app/layout.tsx`, roda antes do primeiro paint) — trocar o fallback ali muda
o primeiro paint de todo mundo. O estado persiste em `use-theme.ts`
(localStorage `scriba-theme`); mantenha a chave em sincronia entre os dois.

Portais fora da árvore de tokens (sonner) precisam do tema resolvido passado
explicitamente — ver `ThemedToaster`.

**Duas cores vivem FORA do `globals.css`, e as duas são obrigadas a isso.** A
barra de status do celular (`<meta name="theme-color">`, escrita pelo
`ThemeScript` e reescrita pelo `useTheme`) e o `theme_color` do manifest são
lidos pelo navegador antes de qualquer CSS — nenhum dos dois enxerga um `var()`.
Elas moram em `src/shared/theme-color.ts` e são o espelho de `--scriba-surface`
nos dois temas: **mudou o token, mude lá no mesmo commit.** A terceira exceção,
pelo mesmo motivo, é `public/offline.html` — sem rede não há folha de estilo
para carregar.

O switch (`ThemeToggle` / `ThemeToggleRow`) está exposto em sign-in, sign-up,
`/profile`, no header logado e no estado vazio do `/feed`. Não espalhe mais
sem pedido.

### O botão primário

**É `--scriba-cta` / `--scriba-cta-ink` / `--scriba-cta-shadow`, na landing E na
área logada.** Nunca pinte um botão com `bg-scriba-blue` + `text-white`:
`--scriba-blue` é azul de SUPERFÍCIE, e branco sobre ele dá 2,56:1 no claro e
2,33:1 no escuro. Era assim em 21 botões.

O CTA é gradiente (`bg-[image:var(--scriba-cta)]`) e INVERTE: azul-escuro com
tinta branca no claro, pastilha clara com tinta navy no escuro. O hover é um
`filter` na classe `.scriba-cta`, não uma cor de fundo — um `hover:bg-*` chapa
o gradiente. A sombra também é token, porque um halo azul sob pastilha branca
em página escura suja a borda em vez de assentar o botão.

**A variante `default` do `ui/button.tsx` JÁ É esse par**, e a família inteira
(`outline`, `secondary`, `ghost`, `link`) foi repontada para os tokens
`--scriba-*`. Elas vinham do shadcn apontando para `--primary` / `--muted` /
`--border`, que é a escala neutra preto-e-cinza do template: como `default` é a
variante PADRÃO, todo `<Button>` sem `variant` — o admin inteiro, o /404 —
desenhava um botão preto que não pertence à paleta. O `ui/badge.tsx` levou o
mesmo tratamento, com a diferença de que a pastilha escura ali é intencional e
usa `bg-scriba-ink-strong` + `text-background`, a mesma das referências
bíblicas.

Os tokens `--primary*` continuam declarados em `globals.css` porque o shadcn os
pressupõe; simplesmente ninguém mais os pinta.

### Calibrar tinta

**Tinta de família se calibra pela superfície da família, não pelo papel.**
`--scriba-*-accent`, `-body` e `-dark` aparecem sobre `--scriba-cream`,
`--scriba-mint` etc., que são mais escuros que o branco — medir no papel dá
falso OK. E o piso da escala neutra é `--session-example-bg` (#EEF3FB), a
superfície mais escura do tema claro, não o `--scriba-bubble`.

### A landing tem tokens próprios

As faixas full-bleed usam `--lp-hero`, `--lp-band` / `--lp-band-ink` e
`--lp-phone-frame` em vez de reaproveitar `--scriba-blue`. O azul primário
funciona como laje de página inteira só no claro; no escuro ele lê como um
painel iluminado jogado numa página escura, então a faixa vira um azul
profundo levantado só um pouco acima do chão, e o mockup de celular ganha uma
moldura quase preta para manter a borda. **Não pinte uma seção da LP com
`bg-scriba-blue`.**

## Marca — a pena mora em um lugar só

A pena e o logotipo saem de `brand/`, e o `<path>` do desenho existe em **um**
arquivo: `ScribaMark.tsx`. Não cole o path em outro lugar, nem crie um SVG
inline "só desta vez".

- `ScribaMark` — a pena sozinha, pintando com `currentColor`.
- `ScribaLogo` — pena + a palavra "scriba" em Poppins (`--font-poppins`), com
  `subtitle` opcional (hoje só o "Admin" da sidebar).
- `ScribaAvatar` — a pena branca no disco com gradiente, usada quando o Scriba
  fala como autor (cards de IA no feed e nos blocos de estudo).

**A cor do logotipo vem do CONTAINER, nunca de uma classe própria em cada
metade.** Pena e palavra são uma marca só: o `<path>` usa `currentColor` e o
texto herda o `color`. Pintar um dos dois separadamente é exatamente o que os
desencontra — já aconteceu, e o conserto virou commit.

**Os consumos de fora do React vivem em `public/brand/`** — `pena.svg` e os
dois favicons — porque favicon, manifest e dados estruturados não passam por
componente. Eles NÃO se atualizam sozinhos quando `ScribaMark` muda.

Os MESTRES são `public/brand/logo.png` (quadrado, opaco) e
`public/brand/banner-preview.png` (1200×630). Todo o resto de raster é
derivado deles por `sharp` — não desenhe um tamanho à mão. Quando a marca
mudar, troque os mestres e regenere, nesta ordem:

1. `src/shared/brand/ScribaMark.tsx` — a aplicação inteira (o `<path>`).
2. `public/brand/pena.svg` — a mesma pena para consumo externo e para a
   máscara do logotipo em gradiente.
3. `public/brand/favicon-{light,dark}-theme.svg` — a aba, por tema.
4. `app/favicon.ico` — 16/32/48/64/128/256 no mesmo arquivo.
5. `app/apple-icon.png` (180, opaco) e `public/brand/icon-{192,512}.png`.
6. `app/opengraph-image.png` — cópia do banner (com o `.alt.txt` ao lado).
7. `public/brand/splash/` — `node scripts/generate-splash.mjs`. As telas de
   abertura do PWA no iOS; o script LÊ o `pena.svg` do passo 2, então rodá-lo
   antes dele redesenha a marca velha.
8. `app/manifest.ts`, `app/layout.tsx` e `LandingJsonLd.tsx` — só apontam, mas
   confira se o arquivo apontado ainda existe.

Sobre formatos e precedência de `<link>`, ver `app/AGENTS.md`.

## Ícones

**O `Sparkles` do lucide-react é PROIBIDO.** Não importe, não renderize. Para
um acento decorativo, use o hexágono amarelo já usado no app:
`clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)` sobre um
bloco `bg-scriba-yellow`.

## A barra inferior do celular

`MobileBottomNav` é o chrome do app no telefone, e três decisões dela mordem
quem for mexer:

- **Ela SOME nas três telas de captura** (`/recording/:id/{live,audio,transcribe}`),
  não só no `live`. No modo transcrição o botão de parar é `fixed` a 24px do
  rodapé — exatamente onde a barra fica —, e ela cobria o botão: a gravação não
  tinha como ser pausada nem encerrada pelo celular. Some com ela também evita
  o toque acidental que navega para fora e mata o MediaRecorder no meio de um
  sermão.
- **Todo ícone mora numa calha de altura fixa.** Cada glifo tem a sua altura
  natural, e como a barra centra item a item, alturas diferentes colocavam cada
  rótulo numa linha. O item "Perfil" é um glifo de usuário, não a foto: o
  avatar era o único elemento que mudava de tamanho, de forma e de cor sozinho,
  e a barra é navegação, não identidade.
- **O `padding-bottom` é SÓ o `env(safe-area-inset-bottom)`**, sem folga fixa
  somada. Um piso de 8px ali empurra a fileira inteira para cima do centro —
  como a altura é `min-h` e a caixa é border-box, o inset cresce a barra em vez
  de espremer o conteúdo.

Nada dentro dela pode usar cor literal: a esfumaçada acima da barra é
`--scriba-nav-fade`, e o ícone do botão "Gravar" herda `--scriba-cta-ink`
(pintá-lo de branco o faz sumir no tema escuro, onde o CTA inverte).

## A transição de página envolve o conteúdo, nunca a moldura

`PageTransition` remonta os filhos por `key={pathname}` para reexibir o
`animate-content-fade`. Ela morava no **root layout**, e por isso derrubava e
remontava tudo abaixo dela a cada navegação: header, barra inferior e página.
No desktop lia como um piscar; no celular — e principalmente no PWA, que não
tem moldura do navegador para ancorar o olho — a barra inferior sumia e voltava
a cada toque.

Agora **cada moldura instala a sua**, em volta dos próprios `children`:
`app/(app)/layout.tsx`, `app/admin/layout.tsx` e `app/partners/layout.tsx`. O
root layout ficou com a classe sem `key` — o fade toca uma vez no carregamento
completo, para toda rota, e não volta a tocar em navegação de cliente.

**Não devolva a `PageTransition` para o root layout**, e ao criar uma moldura
nova coloque a dela por dentro. O preço aceito: entre páginas públicas sem
moldura (landing, termos, privacidade) a navegação de cliente não refaz mais o
fade — não há nada fixo na tela delas para piscar.

## Atalhos de papel: dois lugares, um motivo

Admin e parceiro chegam às suas áreas pelo menu do avatar (`PrivilegedMenuItems`)
no desktop e pelo `/profile` (`PrivilegedProfileLinks`, `sm:hidden`) no celular,
porque o header mobile não tem avatar — sem a segunda porta, quem tem o papel só
chegava lá digitando a URL.

**Os dois são SERVER components, e é isso que justifica existirem separados.**
Atrás de um `isAdmin &&` dentro de um componente cliente, as strings "Admin",
"Área do parceiro", "/admin" e "/partners" viajam no JavaScript de todo usuário
logado: o booleano esconde o item na tela, não o código que o desenha. Nenhum
dos dois é controle de acesso — os gates das rotas respondem 404 a quem digitar
a URL.

## Select — o rótulo não vem de graça

`<SelectValue />` do base-ui renderiza o **valor cru**, não o rótulo do item.
Um select de situação mostra "active" no gatilho e "Ativo" na lista aberta, e
o bug reaparece em cada `Select` novo porque a composição parece completa.

Não tem conserto dentro do nosso wrapper: os `<SelectItem>` moram no Portal e
só montam quando a lista abre, então o gatilho não conhece o rótulo antes do
primeiro clique. As duas saídas — e todo `Select` do app usa uma delas:

1. `items={OPTIONS}` no Root, com a MESMA lista alimentando o map dos itens.
2. `<SelectValue>{(v) => LABELS[v]}</SelectValue>`, quando o rótulo do gatilho
   difere do da lista.

`<SelectValue />` pelado só está certo quando o valor JÁ É o texto da tela.
Detalhes no cabeçalho de `src/shared/ui/select.tsx`.

## Acessibilidade

Meta: **zero violações WCAG 2.0/2.1 A+AA**, medidas com **axe-core rodando no
navegador** — não pelo Lighthouse, cujo relatório mostra uma amostra.

- **Cada tema é medido com a página CARREGADA nele.** Alternar `.dark` via JS
  e medir em seguida lê valores antes do recálculo e reporta as cores do tema
  anterior.
- **A área logada precisa de sessão E de dados.** Com a conta vazia o axe não
  vê a faixa creme do `/list`, nem o `SummaryView`, nem o seletor do `/feed` —
  três famílias de token passaram meses reprovando sem aparecer. Semeie sessão
  antes de auditar.

Estado da última auditoria (axe-core 4.10, claro e escuro):

```
/feed  /list  /studies  /profile
/recording/{id}/{summary,deepening,live}    0 violações (eram 32)
/  /sign-in  /terms  /privacy               0 violações
```

Na prática, ao escrever componente novo: `focus-visible:ring-2` em tudo que
recebe foco (não `outline-none` sozinho), `aria-label` em botão que só tem
ícone, `role="switch"` + `aria-checked` em toggle, um `<main>` por página, e
respeite `prefers-reduced-motion` (o bloco já existe no `globals.css`).

## Analytics (GA4)

- **O gtag NÃO entra no `<head>` na mão.** `components/Analytics.tsx` usa o
  `GoogleAnalytics` de `@next/third-parties/google`, que emite os mesmos dois
  scripts por `next/script` com `afterInteractive` — depois da hidratação, sem
  disputar o primeiro paint com o CSS e o JS da landing, e sem duplicar a tag
  quando o layout re-renderiza entre navegações.
- **Duas condições para medir:** `IS_PRODUCTION_DEPLOY` e `NEXT_PUBLIC_GA_ID`.
  Faltando qualquer uma, o componente devolve `null`. Localhost, `npm run prod`
  e `dev.scriba.cc` portanto não medem — nem que a variável vaze para o escopo
  errado do painel da Vercel. Para validar uma tag: DebugView do GA4 contra
  `scriba.cc`.
- Ler `process.env` não torna rota dinâmica: a LP continua `○ Static` com o
  `<Analytics />` no root layout — conferido no output do build.
- **Não escrevemos pageview.** As navegações do App Router viram `page_view`
  pela medição aprimorada do GA4 (eventos de histórico), ligada na
  propriedade. Evento personalizado usa `sendGAEvent`, nunca `window.gtag`.

## LandingMocks

`components/LandingMocks.tsx` é markup estático PRÓPRIO — não os componentes
do app. Isso é deliberado e tem preço: mexer no `FeedItemCard` não atualiza
mais a landing. O porquê está em `app/AGENTS.md`.
