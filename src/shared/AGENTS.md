# src/shared: tema, marca, UI base e acessibilidade

O que é comum às features. Se algo aqui muda, muda em todas as telas, leia
antes de editar.

```
brand/       a pena e o logotipo. UM arquivo tem o <path>
ui/          primitivas shadcn sobre base-ui
components/  chrome do app: header, nav, providers, tema, analytics, LP mocks
hooks/       use-theme, use-mobile
icons/       glifos próprios
assets/      avatares WebP da landing
content/     copy estruturada (FAQ da landing)
```

## Tema

> **BRANCH `test/tema-shadcn`: o produto está monocromático.** Os tokens
> `--scriba-*` e `--session-*` foram remapeados para a escala neutra do shadcn
> (`neutral` do Tailwind) em `:root` e `.dark`, e o tema escuro trocou o índigo
> pelos valores DEFAULT do template. Nenhum `.tsx` mudou: o remap inteiro cabe
> em `app/globals.css`, que é o que este documento sempre prometeu.
>
> O que o texto abaixo descreve continua sendo a ESTRUTURA correta (as três
> superfícies, a escala de tinta de quatro degraus, o par do CTA, a regra de
> nunca escrever cor literal). O que mudou foram os VALORES, e por isso os
> argumentos de calibragem que você vai ler adiante, "branco sobre `--scriba-blue`
> dá 2,56:1", "o piso da escala se mede pelo `--scriba-bubble`", seguem válidos
> como método mesmo com os números antigos: eles são a razão de cada token
> existir, e é deles que você precisa se o teste for revertido
> (`git checkout master -- app/globals.css`).
>
> **Duas cores sobreviveram, e as duas por serem SEMÂNTICAS:** o vermelho
> (`--scriba-rec*`, `destructive`) e o amarelo da MOEDA (`--scriba-yellow*` e
> `--scriba-gold-*`, mais `--session-highlight-yellow`, que `.tone-study`
> deixou de sobrescrever: o cinza que sobrara ali era resíduo da passagem
> monocromática, e um marcador cinza ao lado de um amarelo em outra tela lia
> como defeito).
>
> O marca-texto no ESCURO é um amarelo queimado, e o valor está preso pelo
> contraste, não pelo gosto: a faixa cobre só os 42% de baixo da linha, a
> tinta do parágrafo ali é quase branca, e branco só se sustenta sobre amarelo
> escuro. Composto sobre o cartão, o valor atual dá #836927, 5,0:1; o teto
> para manter AA é ~#8D7029, indistinguível a olho nu. Usar o creme do tema
> claro daria 1,2:1. **Clarear exige cobrir a linha inteira e inverter a tinta,
> o que é outro desenho, não outro valor** — foi testado e desfeito. O saldo, o preço por
> minuto e o marca-texto se identificam por essa cor em toda a interface; cinza
> ali não é simplificação, é informação a menos. `--scriba-flash-debit` voltou
> ao âmbar da mesma família e `--scriba-flash-credit` ficou neutro, o que
> devolve a distinção sem trazer um terceiro matiz.
>
> O que ainda custa informação, e está anotado no `globals.css`: as quatro
> famílias de tile (mint/rose/cream/lilac) têm valores IDÊNTICOS, então o tipo
> de card só se distingue pelo rótulo; e `.tone-study` virou meio degrau de
> luminância no lugar do verde contra azul. A landing (`--lp-hero`, `--lp-band`,
> `--lp-band-ink`, `--lp-phone-frame`) ficou FORA e mantém a marca.

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

**O `/feed` é a exceção, e tem token próprio: `--feed-card`.** Os cartões de
lá (reflexão, releia, lembra, frase marcante, instalar o app, indicar um amigo)
não usam `bg-scriba-paper`, e sim `bg-[image:var(--feed-card)]`, porque no tema
ESCURO todos precisam da mesma superfície da citação bíblica, o degradê de
`--session-surface-quote`, que é o que dá relevo ao cartão sobre um chão quase
preto. No CLARO ele é branco chapado: ali o relevo já vem do contraste com
`--scriba-surface`, e um degradê cinza sobre papel só sujaria a leitura.

É gradiente nos DOIS temas mesmo quando é branco (quatro paradas iguais), senão
o mesmo cartão precisaria de `bg-*` num tema e `bg-[image:*]` no outro. No
escuro o valor é `var(--session-surface-quote)` por referência, não por cópia:
a regra é "a mesma da citação bíblica", e precisa continuar valendo quando
aquela mudar.

**Um cartão do feed NÃO usa o token, e é o de cima: a reflexão sobre a última
gravação** (`ReflectionCard`, em `app/(app)/feed/page.tsx`). Ele fica no
`bg-scriba-paper` de sempre, o que no claro dá o mesmo branco de todos e no
escuro o deixa um degrau ABAIXO do degradê dos outros. É esse degrau que o
separa da lista: ele é o resumo do que acabou de acontecer, não mais uma
entrada dela. Ele também é o único sem sombra nenhuma, o halo azul de
`shadow-[0_6px_22px_rgba(79,168,240,.13)]` saiu nos dois temas.

### A sombra das superfícies

**É `--scriba-shadow-soft` / `--scriba-shadow`, nunca um `rgba()` colorido.**
As sombras de card, de nav inferior, de caixa do admin e do cartão de login
eram todas o mesmo azul literal, `rgba(79, 168, 240, ...)`, sobra da paleta
antiga. No claro isso passava; no ESCURO não: azul claro difuso sobre um chão
quase preto não lê como sombra, lê como BRILHO em volta da caixa, e a nav
inferior ganhava uma linha acesa por cima em vez de descolar do conteúdo.

Os dois degraus existem porque as chamadas já usavam dois: `soft` para o que só
precisa descolar do fundo (cards do feed, campos, pastilhas), o outro para o que
precisa flutuar (a nav, o cartão do login, o modo selecionado do diálogo de
gravar). E os valores INVERTEM de intensidade com o tema: 0.06 / 0.12 no claro,
0.35 / 0.5 no escuro, porque o mesmo preto fraco que assenta uma caixa branca
simplesmente some sobre `#0A0A0A`.

O par continua separado de `--scriba-cta-shadow`, que é a sombra do BOTÃO e
acompanha o gradiente dele.

`text-white` / `bg-white` literais só são aceitáveis sobre uma superfície que
é a MESMA cor nos dois temas (`bg-scriba-blue`, `bg-scriba-rec`,
`bg-scriba-yellow`, os gradientes fixos da landing). Qualquer coisa sobre
`bg-scriba-ink-strong` usa `text-background`, porque esse token inverte.

Uma variante `dark:` é a ferramenta certa para o caso raro que não é paleta
(opacidade de scrim de modal). Se o valor é uma cor, prefira token.

**O padrão é o tema ESCURO**, e continua NÃO sendo o `prefers-color-scheme` do
sistema: o tema é decisão de produto, não retrato do SO. Quem nunca escolheu vê
escuro, na landing e na área logada.

A decisão mora em DOIS lugares que precisam concordar, e a ordem entre eles é o
desenho: **o `<html>` do root layout nasce com `class="dark"`**, e o
`ThemeScript` (no `<head>`, antes do primeiro paint) REMOVE a classe de quem
escolheu claro. A inversão é o que mantém a piscada fora da maioria das
visitas: enquanto o padrão era claro, o HTML servido já era o padrão; com o
padrão escuro e o HTML nascendo claro, TODA visita começaria branca e
escureceria. De quebra, quem está sem JS agora recebe escuro em vez de claro.

Quatro arquivos carregam esse padrão e mudam JUNTOS: `app/layout.tsx` (a
classe), `ThemeScript` (o fallback e a `<meta name="theme-color">`),
`use-theme.ts` (o estado inicial e a chave `scriba-theme` do localStorage) e
`app/manifest.ts` (`theme_color`, que é o que o navegador usa sem JS).
`public/offline.html` tem o quinto, o seu próprio bootstrap inline.

Portais fora da árvore de tokens (sonner) precisam do tema resolvido passado
explicitamente, ver `ThemedToaster`.

**Duas cores vivem FORA do `globals.css`, e as duas são obrigadas a isso.** A
barra de status do celular (`<meta name="theme-color">`, escrita pelo
`ThemeScript` e reescrita pelo `useTheme`) e o `theme_color` do manifest são
lidos pelo navegador antes de qualquer CSS, nenhum dos dois enxerga um `var()`.
Elas moram em `src/shared/theme-color.ts` e são o espelho de `--scriba-surface`
nos dois temas: **mudou o token, mude lá no mesmo commit.** A terceira exceção,
pelo mesmo motivo, é `public/offline.html`, sem rede não há folha de estilo
para carregar.

O switch existe em DOIS lugares, e só: **`/profile`** (`ThemeToggleRow`) e o
**estado vazio do `/feed`** (`SessionsEmptyState showThemeToggle`). Saiu do
header logado, do header de parceiros, do `AuthShell` (sign-in e sign-up) e do
header da landing.

A consequência precisa estar à vista de quem for mexer: **fora da área logada
não há mais como trocar de tema.** Visitante da landing, quem está no sign-in e
quem está no sign-up veem escuro e pronto; o caminho para o claro é entrar e ir
ao perfil. Foi uma decisão explícita, não um esquecimento. Não espalhe mais sem
pedido, e não devolva um deles sem lembrar que o padrão hoje é escuro.

### O botão primário

**É `--scriba-cta` / `--scriba-cta-ink` / `--scriba-cta-shadow`, na landing E na
área logada.** Nunca pinte um botão com `bg-scriba-blue` + `text-white`:
`--scriba-blue` é azul de SUPERFÍCIE, e branco sobre ele dá 2,56:1 no claro e
2,33:1 no escuro. Era assim em 21 botões.

O CTA é gradiente (`bg-[image:var(--scriba-cta)]`) e INVERTE: azul-escuro com
tinta branca no claro, pastilha clara com tinta navy no escuro. O hover é um
`filter` na classe `.scriba-cta`, não uma cor de fundo, um `hover:bg-*` chapa
o gradiente. A sombra também é token, porque um halo azul sob pastilha branca
em página escura suja a borda em vez de assentar o botão.

**A variante `default` do `ui/button.tsx` JÁ É esse par**, e a família inteira
(`outline`, `secondary`, `ghost`, `link`) foi repontada para os tokens
`--scriba-*`. Elas vinham do shadcn apontando para `--primary` / `--muted` /
`--border`, que é a escala neutra preto-e-cinza do template: como `default` é a
variante PADRÃO, todo `<Button>` sem `variant`, o admin inteiro, o /404,
desenhava um botão preto que não pertence à paleta. O `ui/badge.tsx` levou o
mesmo tratamento, com a diferença de que a pastilha escura ali é intencional e
usa `bg-scriba-ink-strong` + `text-background`.

**A referência bíblica ("Jonas 1:7-10") NÃO é mais essa pastilha.** Ela usava
o mesmo par, e chapada na tinta mais forte da escala pesava mais que o
versículo que anunciava, no escuro sobretudo, onde um retângulo branco sólido
vira o objeto mais luminoso do cartão. Virou `.veil-chip`, em
`app/globals.css`: um véu da própria tinta sobre a superfície de baixo
(`--veil-bg`, degradê de cima para baixo) com um anel de 1px (`--veil-ring`) e
tinta `--scriba-ink`, um degrau abaixo do topo.

**O véu virou TRATAMENTO, não componente**, e é por isso que o nome descreve o
efeito: ele veste também os ícones de tipo (YouTube, transcrição, gravação,
estudo) dos cartões de `/recordings` e `/studies`. Lá eles eram
`bg-[image:var(--scriba-cta)]`, o gradiente do BOTÃO primário, um bloco com o
peso de uma ação para marcar o TIPO da sessão, que é informação passiva.

Como é OPACIDADE e não cor, ela funciona sobre qualquer fundo em que apareça
(o degradê da citação, o papel, o `--feed-card`) sem um valor por superfície.
O anel é `box-shadow: inset` e não `border`, senão 1px mudaria a altura da
pastilha e a linha de base do `<figcaption>` junto. Os quatro lugares que a
desenham (`BlockRenderer`, `ChapterMention`, `FeedEntryCards`, `FeedItemCard`)
usam a classe; forma e interação seguem em utilitário no ponto de uso.

Os tokens `--primary*` continuam declarados em `globals.css` porque o shadcn os
pressupõe. Fora do admin ninguém os pinta; **dentro dele, o gradiente dos
cartões de KPI é `from-primary/5`**, de propósito, porque é assim que o bloco
`dashboard-01` desenha e é o `--primary` que faz o degradê acompanhar o tema.
Ver `src/features/admin/AGENTS.md`.

### Pressionado: o hover que não existe no celular

Num aparelho de toque não há estado intermediário, o dedo encosta e a ação
acontece, então **todo `hover:` deste repositório é código morto no celular**.
O que sobrava era uma tela em que tocar não produzia reação nenhuma até a
próxima página chegar, e a resposta natural de quem usa é tocar de novo: é
assim que um clique vira três.

Duas camadas cobrem isso, e a ordem entre elas é o desenho:

1. **O piso, genérico**, em `@layer base` do `globals.css`: dentro de
   `@media (hover: none)`, todo `a`, `button`, `summary` e `[role]` de menu/aba
   cai para `opacity: .62` enquanto `:active`. Opacidade porque é a única
   propriedade que funciona sobre qualquer superfície do produto, gradiente,
   papel, vidro esfumaçado, sem saber a cor de baixo. Sem transição: retorno
   de toque atrasado é pior que retorno nenhum.
2. **O pressionado próprio de cada componente**, em utilitário ou na classe
   (`.scriba-cta` escurece e ACHATA a sombra; `Button` tem
   `active:translate-y-px`; `SidebarMenuButton` tem `active:bg-sidebar-accent`).
   Utilitário e `@layer components` vencem `@layer base` por ordem de camada,
   então escrever um `active:` específico simplesmente tira o piso do caminho,
   é para isso que ele mora na camada mais fraca.

`hover: none` e não `pointer: coarse`: o que decide é a ausência de HOVER, não
a grossura do ponteiro, um notebook com tela sensível continua tendo mouse.

**O mesmo critério está exposto como variante: `touch:` e `no-touch:`**
(declaradas em `app/globals.css`, ao lado da `dark`). Use-as onde a pergunta é
"isto é um celular ou tablet?", que NÃO é a mesma pergunta que "a viewport é
pequena?". Quem confundiu as duas foi o convite de instalar o PWA: ele cortava
em `lg` (1024px) para pegar o iPad em retrato, e o mesmo iPad deitado mede
1024px, entrava no bucket "desktop" e perdia a única porta de instalação que
tem. Não há breakpoint que separe um tablet deitado de um notebook. Para
largura de viewport, que é sobre o LAYOUT caber, os breakpoints continuam
sendo a ferramenta certa.

**O piso só alcança elemento SEMÂNTICO.** Um `<div onClick>` não ganha retorno
nenhum, e isso é bom: é mais um motivo para ele não existir.

### Calibrar tinta

**Tinta de família se calibra pela superfície da família, não pelo papel.**
`--scriba-*-accent`, `-body` e `-dark` aparecem sobre `--scriba-cream`,
`--scriba-mint` etc., que são mais escuros que o branco, medir no papel dá
falso OK. E o piso da escala neutra é `--session-example-bg` (#EEF3FB), a
superfície mais escura do tema claro, não o `--scriba-bubble`.

### A landing tem tokens próprios

As faixas full-bleed usam `--lp-hero`, `--lp-band` / `--lp-band-ink` /
`--lp-band-cta` e `--lp-phone-frame` em vez de reaproveitar cor de componente.
**Não pinte uma seção da LP com `bg-scriba-blue`.**

**A faixa é ESCURA nos dois temas, e é isso que obriga o par de botão dela a
ser fixo.** `--scriba-cta` inverte por tema; usado ali, o tema claro poria um
botão quase preto sobre uma laje quase preta. Por isso `--lp-band-cta` /
`--lp-band-cta-ink` valem o mesmo no claro e no escuro. Contraste da tinta no
ponto mais claro da faixa: 9,2:1 no claro, 8,4:1 no escuro.

**Os dois halos radiais do hero (o azul e o dourado) ficaram FORA da paleta
neutra, de propósito.** São o único acento cromático que restou nas duas
landings, e é deles que vem a sensação de que a marca continua ali; o que
mudou embaixo deles foi o chão, que deixou de ser azul. São os únicos `rgba()`
de marca que sobrevivem num `className` deste repositório, e não são
precedente: apagá-los apaga a cor da página inteira.

## Marca: a pena mora em um lugar só

A pena e o logotipo saem de `brand/`, e o `<path>` do desenho existe em **um**
arquivo: `ScribaMark.tsx`. Não cole o path em outro lugar, nem crie um SVG
inline "só desta vez".

- `ScribaMark`: a pena sozinha, pintando com `currentColor`.
- `ScribaLogo`: pena + a palavra "scriba" em Poppins (`--font-poppins`), com
  `subtitle` opcional (hoje só o "Admin" da sidebar).
- `ScribaAvatar`: a pena branca no disco com gradiente, usada quando o Scriba
  fala como autor (cards de IA no feed e nos blocos de estudo).

**A cor do logotipo vem do CONTAINER, nunca de uma classe própria em cada
metade.** Pena e palavra são uma marca só: o `<path>` usa `currentColor` e o
texto herda o `color`. Pintar um dos dois separadamente é exatamente o que os
desencontra, já aconteceu, e o conserto virou commit.

**Os consumos de fora do React vivem em `public/brand/`**, `pena.svg` e os
dois favicons, porque favicon, manifest e dados estruturados não passam por
componente. Eles NÃO se atualizam sozinhos quando `ScribaMark` muda.

Os MESTRES são `public/brand/logo.png` (quadrado, opaco) e
`public/brand/banner-preview.png` (1200×630). Todo o resto de raster é
derivado deles por `sharp`, não desenhe um tamanho à mão. Quando a marca
mudar, troque os mestres e regenere, nesta ordem:

1. `src/shared/brand/ScribaMark.tsx`: a aplicação inteira (o `<path>`).
2. `public/brand/pena.svg`: a mesma pena para consumo externo e para a
   máscara do logotipo em gradiente.
3. `public/brand/favicon-{light,dark}-theme.svg`: a aba, por tema.
4. `app/favicon.ico`: 16/32/48/64/128/256 no mesmo arquivo.
5. `app/apple-icon.png` (180, opaco) e `public/brand/icon-{192,512}.png`.
6. `app/opengraph-image.png`: cópia do banner (com o `.alt.txt` ao lado).
7. `public/brand/splash/`: `node scripts/generate-splash.mjs`. As telas de
   abertura do PWA no iOS; o script LÊ o `pena.svg` do passo 2, então rodá-lo
   antes dele redesenha a marca velha.
8. `app/manifest.ts`, `app/layout.tsx` e `LandingJsonLd.tsx`, só apontam, mas
   confira se o arquivo apontado ainda existe.

Sobre formatos e precedência de `<link>`, ver `app/AGENTS.md`.

## Ícones

**O `Sparkles` do lucide-react é PROIBIDO.** Não importe, não renderize. Para
um acento decorativo, use o hexágono amarelo já usado no app:
`clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)` sobre um
bloco `bg-scriba-yellow`.

## Qual item da navegação acende: `nav.ts`

`activeNavKey(pathname)` é a fonte ÚNICA disso, e as duas barras a consultam,
`AppNav` no desktop e `MobileBottomNav` no celular. Antes cada uma tinha a sua
comparação e as duas erravam igual: acendiam só na correspondência exata do
href, então **toda página de detalhe apagava a barra inteira**.

A regra é "o item aceso é a LISTA de onde o conteúdo veio", não o prefixo da
URL. É o que faz `/recording/:id/deepening` acender **Estudos** e não
Gravações: a URL segue a sessão porque o estudo é dela, mas quem navega vê um
estudo e vai procurá-lo de volta em `/studies`. Rota de detalhe nova entra
nessa função, não num `startsWith` dentro de um componente.

## A barra inferior do celular

`MobileBottomNav` é o chrome do app no telefone, e três decisões dela mordem
quem for mexer:

- **Ela SOME nas três telas de captura** (`/recording/:id/{live,audio,transcribe}`),
  não só no `live`. No modo transcrição o botão de parar é `fixed` a 24px do
  rodapé, exatamente onde a barra fica, e ela cobria o botão: a gravação não
  tinha como ser pausada nem encerrada pelo celular. Some com ela também evita
  o toque acidental que navega para fora e mata o MediaRecorder no meio de um
  sermão.
- **Todo ícone mora numa calha de altura fixa.** Cada glifo tem a sua altura
  natural, e como a barra centra item a item, alturas diferentes colocavam cada
  rótulo numa linha. O item "Perfil" é um glifo de usuário, não a foto: o
  avatar era o único elemento que mudava de tamanho, de forma e de cor sozinho,
  e a barra é navegação, não identidade.
- **Os cinco ícones são um conjunto só, em `icons/NavGlyphs.tsx`, e três deles
  também desenham a barra do DESKTOP.** Feed, Biblioteca e Estudos usam os
  mesmos glifos no `AppNav`; antes eram lucide lá (`Rss` / `List` / `BookOpen`)
  e o mesmo destino tinha dois desenhos conforme o aparelho. O `profile` não
  vai junto: no desktop aquele lugar é o avatar do `UserMenu`.
  São preenchidos (não traçados, `strokeWidth` não faz nada neles) e ocupam
  quase todo o `viewBox` de 24, e é por isso que os quatro das abas usam um
  `size` ÚNICO **dentro desta barra** — entre as duas barras ele MUDA: 20px
  aqui, 12px no `AppNav`, que é o que iguala o peso do lucide de 14px que
  estava lá (o lucide reserva ~2px de margem de cada lado do `viewBox`, o
  glifo não). A barra já misturou formas feitas à mão com glifos do lucide, e aí
  cada ícone precisava de um `size` próprio: o lucide reserva margem dentro do
  `viewBox`, então em tamanho igual os dele liam como menores. Ícone novo que
  destoe se resolve em quanto ele desenha do `viewBox`, não no `size` da barra.
- **Os glifos pintam com `currentColor` e não levam classe de cor.** É o que
  justifica serem componente em vez de `<img src="/icons/…">`, `<img>` não
  herda cor, e o ícone precisa acompanhar o estado ativo do item. A cor desce
  do `text-*` do `TabLink`, num lugar só; quando cada chamada pintava o seu
  ícone, a cor do ativo divergiu da do rótulo (o ícone usava `--scriba-blue`,
  azul de SUPERFÍCIE, e o rótulo `--scriba-blue-ink`). Os SVGs originais ficam
  em `public/icons/*.svg`, um por componente, com o mesmo nome, desenho novo
  troca os dois no mesmo commit.
- **O `padding-bottom` é SÓ o `env(safe-area-inset-bottom)`**, sem folga fixa
  somada. Um piso de 8px ali empurra a fileira inteira para cima do centro,
  como a altura é `min-h` e a caixa é border-box, o inset cresce a barra em vez
  de espremer o conteúdo.

- **O item "Gravar" não tem rótulo: são dois círculos concêntricos.** Um disco
  de 44px na cor do botão primário (`bg-[image:var(--scriba-cta)]` +
  `text-scriba-cta-ink`, que inverte com o tema, nunca `text-white` ali),
  dentro de um anel de 60px em `bg-scriba-blue-soft` que faz as vezes de
  sombra. No escuro o disco leva `dark:opacity-90`, uma das variantes `dark:`
  legítimas, porque o valor é opacidade e não cor: a pastilha clara em que o
  CTA se inverte precisa assentar no fundo escuro. A opacidade vale para o
  grupo, então o microfone desce junto e o contraste do glifo se mantém.
  **O anel é um círculo de verdade, não `box-shadow`:** sombra pediria
  cor literal em `rgba()`, que a barra proíbe, e no escuro borraria em vez de
  anelar. Ele já foi um círculo de CTA DESLOCADO pra fora da barra e com
  rótulo, e era isso que incomodava, não a cor, que voltou de propósito para
  casar com os botões do resto do app. É o ÚNICO item sem calha e sem texto, e
  é a simetria do círculo que o alinha, a barra centra item a item, então o
  centro dele coincide com o centro do bloco ícone+rótulo dos outros quatro, e
  o microfone senta abaixo dos ícones vizinhos de propósito. Sem texto, o nome
  acessível vem do `aria-label` do `DialogTrigger`, não remova. O
  `DialogTrigger` recebe `trigger` e vira `display:contents` para o span ser o
  item flex.

Nada dentro dela pode usar cor literal: a esfumaçada acima da barra é
`--scriba-nav-fade`.

**A folga que reserva o espaço dela vai no FILHO, não no wrapper.** Em
`app/(app)/layout.tsx` é `[&>*]:pb-36 sm:[&>*]:pb-0`, e o seletor de filho é o
ponto: `/feed`, `/recordings` e `/studies` pintam `bg-scriba-surface` no
próprio elemento raiz, então uma folga no wrapper fica DEPOIS da tinta e a faixa
reservada aparece com o tom do `body`, não o do conteúdo. Por dentro, o chão da
página se estende por ela. Isso pressupõe um elemento raiz por página, se
criar uma que devolva irmãos no topo, a folga vai em cada um.

## A transição de página envolve o conteúdo, nunca a moldura

`PageTransition` remonta os filhos por `key={pathname}` para reexibir o
`animate-content-fade`. Ela morava no **root layout**, e por isso derrubava e
remontava tudo abaixo dela a cada navegação: header, barra inferior e página.
No desktop lia como um piscar; no celular, e principalmente no PWA, que não
tem moldura do navegador para ancorar o olho, a barra inferior sumia e voltava
a cada toque.

Agora **cada moldura instala a sua**, em volta dos próprios `children`:
`app/(app)/layout.tsx`, `app/admin/layout.tsx` e `app/partners/layout.tsx`. O
root layout ficou com a classe sem `key`, o fade toca uma vez no carregamento
completo, para toda rota, e não volta a tocar em navegação de cliente.

**Não devolva a `PageTransition` para o root layout**, e ao criar uma moldura
nova coloque a dela por dentro. O preço aceito: entre páginas públicas sem
moldura (landing, termos, privacidade) a navegação de cliente não refaz mais o
fade, não há nada fixo na tela delas para piscar.

## Atalhos de papel: dois lugares, um motivo

Admin e parceiro chegam às suas áreas pelo menu do avatar (`PrivilegedMenuItems`)
no desktop e pelo `/profile` (`PrivilegedProfileLinks`, `sm:hidden`) no celular,
porque o header mobile não tem avatar, sem a segunda porta, quem tem o papel só
chegava lá digitando a URL.

**Os dois são SERVER components, e é isso que justifica existirem separados.**
Atrás de um `isAdmin &&` dentro de um componente cliente, as strings "Admin",
"Área do parceiro", "/admin" e "/partners" viajam no JavaScript de todo usuário
logado: o booleano esconde o item na tela, não o código que o desenha. Nenhum
dos dois é controle de acesso, os gates das rotas respondem 404 a quem digitar
a URL.

## Select: o rótulo não vem de graça

`<SelectValue />` do base-ui renderiza o **valor cru**, não o rótulo do item.
Um select de situação mostra "active" no gatilho e "Ativo" na lista aberta, e
o bug reaparece em cada `Select` novo porque a composição parece completa.

Não tem conserto dentro do nosso wrapper: os `<SelectItem>` moram no Portal e
só montam quando a lista abre, então o gatilho não conhece o rótulo antes do
primeiro clique. As duas saídas, e todo `Select` do app usa uma delas:

1. `items={OPTIONS}` no Root, com a MESMA lista alimentando o map dos itens.
2. `<SelectValue>{(v) => LABELS[v]}</SelectValue>`, quando o rótulo do gatilho
   difere do da lista.

`<SelectValue />` pelado só está certo quando o valor JÁ É o texto da tela.
Detalhes no cabeçalho de `src/shared/ui/select.tsx`.

## Acessibilidade

Meta: **zero violações WCAG 2.0/2.1 A+AA**, medidas com **axe-core rodando no
navegador**, não pelo Lighthouse, cujo relatório mostra uma amostra.

- **Cada tema é medido com a página CARREGADA nele.** Alternar `.dark` via JS
  e medir em seguida lê valores antes do recálculo e reporta as cores do tema
  anterior.
- **A área logada precisa de sessão E de dados.** Com a conta vazia o axe não
  vê a faixa creme do `/recordings`, nem o `SummaryView`, nem o seletor do
  `/feed`, três famílias de token passaram meses reprovando sem aparecer.
  Semeie sessão antes de auditar.

Estado da última auditoria (axe-core 4.10, claro e escuro):

```
/feed  /recordings  /studies  /profile
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
  scripts por `next/script` com `afterInteractive`, depois da hidratação, sem
  disputar o primeiro paint com o CSS e o JS da landing, e sem duplicar a tag
  quando o layout re-renderiza entre navegações.
- **Duas condições para medir:** `IS_PRODUCTION_DEPLOY` e `NEXT_PUBLIC_GA_ID`.
  Faltando qualquer uma, o componente devolve `null`. Localhost, `npm run prod`
  e `dev.scriba.cc` portanto não medem, nem que a variável vaze para o escopo
  errado do painel da Vercel. Para validar uma tag: DebugView do GA4 contra
  `scriba.cc`.
- Ler `process.env` não torna rota dinâmica: a LP continua `○ Static` com o
  `<Analytics />` no root layout, conferido no output do build.
- **Não escrevemos pageview.** As navegações do App Router viram `page_view`
  pela medição aprimorada do GA4 (eventos de histórico), ligada na
  propriedade. Evento personalizado usa `sendGAEvent`, nunca `window.gtag`.

## LandingMocks

`components/LandingMocks.tsx` é markup estático PRÓPRIO, não os componentes
do app. Isso é deliberado e tem preço: mexer no `FeedItemCard` não atualiza
mais a landing. O porquê está em `app/AGENTS.md`.
