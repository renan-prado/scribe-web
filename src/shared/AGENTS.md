# src/shared: tema, marca, UI base e acessibilidade

O que é comum às features. Se algo aqui muda, muda em todas as telas, leia
antes de editar.

```
brand/       a pena e o logotipo. UM arquivo tem o <path>
ui/          primitivas shadcn sobre base-ui
components/  chrome do app: header, nav, providers, tema, analytics, LP mocks
hooks/       use-mobile, use-standalone, use-install-prompt
icons/       glifos próprios
assets/      avatares WebP da landing
content/     copy estruturada (FAQ da landing)
```

## Tema

**Um tema só, e ele é o do app.** O produto é grafite, da landing ao painel do
admin, e não existe mais bloco `.dark` no `globals.css` nem switch em lugar
nenhum. Havia dois temas enquanto a área logada já forçava o escuro no nó raiz:
o claro só sobrevivia na landing, no `/admin` e na área do parceiro, ou seja,
metade do produto tinha uma paleta que a outra metade ignorava, e as duas
precisavam ser calibradas e medidas.

O `<html>` continua nascendo com `class="dark"`, e ela NÃO pinta mais nada: as
primitivas do shadcn trazem duas dúzias de `dark:` escritos para o escuro, e o
`@custom-variant dark` resolve por ela.

**Nunca escreva uma cor literal num `className`.** Nada de `bg-white`,
`bg-[#EAF2FA]`, `fill="#F8C64B"`. Toda cor vem de um token `--v2-*` /
`--scriba-*` / `--session-*` / shadcn declarado em `src/app/globals.css`. Token
novo entra em DOIS lugares: `:root` e o mapa `@theme inline` que o expõe como
utilitário. (Eram três enquanto havia `.dark`.)

### Três superfícies, e é tudo

| Token | Valor | Papel |
|---|---|---|
| `bg-background` / `bg-v2-bg` | `#212121` | o chão, em toda rota |
| `bg-scriba-paper` / `bg-v2-card` / `bg-card` | `#2F3035` | tudo que é cartão |
| `bg-secondary` / `bg-v2-card-hover` | `#3A3B41` | o realce: hover, aba ativa |

`--scriba-surface`, que era a faixa REBAIXADA entre o chão e o papel, virou o
próprio chão — os dois nomes valem `#212121`. Ele continua útil dentro de um
cartão, onde o chão vira um encaixe (a trilha de uma barra de progresso, uma
pastilha dentro do papel); o que ele não faz mais é pintar seção.

**Seção não se separa por faixa, se separa por FIO.** Uma banda mais escura
embaixo de um chão que já é escuro lê como mancha. O fio é
`border-scriba-hairline` (branco a 10%), o mesmo que a Biblioteca usa entre os
meses. A exceção é a faixa full-bleed da landing (`--lp-band`), que é a
superfície ELEVADA em tamanho de seção: ela é um cartão gigante, e é isso que
ela faz na página.

**Sombra não separa mais nada.** `--scriba-shadow-soft` é `transparent` de
propósito: zerar o token apagou as ~20 sombras decorativas sem tocar num
`className`. O degrau denso (`--scriba-shadow`) ficou, e é só para o que de
fato flutua — diálogo, popover, sheet. O hover de cartão da landing
(`.lp-lift` / `.lp-tile`) deixou de ser sombra crescendo e virou o que o app
faz: a superfície sobe um degrau.

### Três cores, todas semânticas

| Família | Para quê |
|---|---|
| `--scriba-yellow*` / `--scriba-gold-*` | a MOEDA: saldo, preço, marca-texto |
| `--scriba-rec*` / `--scriba-rose*` / `destructive` | gravando, apagar, erro, valor negativo |
| `--scriba-ok-*` | o lado bom de um estado BINÁRIO de sistema, e nada mais |

As quatro famílias de tile (`mint`/`rose`/`cream`/`lilac`) tiveram valores
IDÊNTICOS por uma temporada, e o preço era o tipo de card só se distinguir pelo
rótulo. Hoje cada uma está amarrada a uma dessas três: mint é o lado bom, rose é
o lado ruim, cream é a moeda, lilac é o neutro. **Elas são lavados ESCUROS** —
a tinta dentro delas é clara, como em todo o resto do produto.

### Os post-its são a outra metade do sistema de cor

`--v2-note-{mist,sage,slate,lemon}`, cada um com o próprio par de tinta
(`-ink` e `-mute`). São a ÚNICA cor clara sobre escuro do produto, são a marca
do acervo (ver `PostItNote`), e **a landing os usa pelo mesmo motivo que o
app**: os marcadores da seção "O problema", os chips dos blocos do resumo, o
rótulo da faixa da Biblioteca e o mural dentro do mockup de celular.

**Post-it é ACENTO, nunca fundo de cartão grande.** Um cartão de post-it
obrigaria a inverter a tinta de tudo que estivesse dentro dele, e a página
passaria a ter dois modelos de tinta. Onde a cor precisa cobrir área, a
resposta é a superfície elevada.

### A escala de tinta

Quatro degraus, o piso medido pelo PAPEL (`#2F3035`), que é o fundo de menor
contraste em que texto pousa:

```
              chão(#212121) / papel(#2F3035)
ink-strong      14,8 / 12,1
ink             10,9 /  8,9
ink-soft         7,8 /  6,4
ink-mute         5,8 /  4,8   <- o piso, AA para texto pequeno
```

Mexeu num, recalcule os quatro. E **não ponha `ink-mute` sobre `--secondary`**
(`#3A3B41`): ali ele dá 4,0:1. Quem pousa naquela superfície é o
`--muted-foreground` do shadcn, um degrau mais claro de propósito.

`text-white` literal não é aceitável em lugar nenhum: ele é meio degrau acima
do `--scriba-ink-strong` que o resto da página usa, e a diferença aparece
exatamente onde ele costumava estar, nos blocos que fecham a leitura.

### A cor das barras do sistema

A barra de status do celular (`<meta name="theme-color">`), o `theme_color` e o
`background_color` do manifest e a tela de abertura são todos `#212121`, e o
valor mora em `src/shared/theme-color.ts` porque o navegador lê a meta antes de
qualquer CSS e o manifest é JSON: nenhum dos dois enxerga um `var()`. **Mudou
`--v2-bg`? Mude lá no mesmo commit.** `public/offline.html` é a terceira cópia,
pelo mesmo motivo: sem rede não há folha de estilo para carregar.

Com valor constante, a meta é uma tag ESTÁTICA no `viewport` do root layout.
Três mecanismos deixaram de existir quando o segundo tema saiu: o script inline
no `<head>` que lia o localStorage antes do primeiro paint (`ThemeScript`), o
efeito que refazia a conta dentro da área logada (`AppThemeColor`) e o
`useTheme`, que reescrevia a meta a cada troca. A barra de navegação do Android,
que o Chrome tira do fundo do DOCUMENTO e que nenhuma meta alcança, acerta
sozinha agora que `--background` é o grafite em toda rota.

**Não devolva um switch de tema sem devolver a paleta junto.** O que existia
(`ThemeToggleRow`, no `/profile`) governava menos do que parecia: a moldura do
app declara `dark` no nó raiz, então virar para claro não mudava nenhuma tela
logada, só a landing e o painel. Um controle que muda o que a pessoa não está
olhando é pior que controle nenhum.

### O botão primário

**É `--scriba-cta` / `--scriba-cta-ink`, na landing E na área logada.** Uma
pastilha clara com tinta grafite, CHAPADA e em raio total (`rounded-full`), que
é o desenho de botão do app.

Ele continua declarado como gradiente de duas paradas iguais e consumido por
`bg-[image:var(--scriba-cta)]`: são doze lugares, e trocar o utilitário em
todos para ganhar um `background-color` no lugar de um `background-image` seria
mexer em doze arquivos por nada. O hover é um `filter` na classe `.scriba-cta`,
nunca uma cor de fundo — um `hover:bg-*` chapa o gradiente.
`--scriba-cta-shadow` é `transparent`: a pastilha não flutua.

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
`src/app/globals.css`: um véu da própria tinta sobre a superfície de baixo
(`--veil-bg`, degradê de cima para baixo) com um anel de 1px (`--veil-ring`) e
tinta `--scriba-ink`, um degrau abaixo do topo.

**O véu virou TRATAMENTO, não componente**, e é por isso que o nome descreve o
efeito: ele veste também os ícones de tipo (YouTube, gravação, estudo) dos cartões da
Biblioteca e dos Estudos. Lá eles eram
`bg-[image:var(--scriba-cta)]`, o gradiente do BOTÃO primário, um bloco com o
peso de uma ação para marcar o TIPO da sessão, que é informação passiva.

Como é OPACIDADE e não cor, ela funciona sobre qualquer fundo em que apareça
(o degradê da citação, o papel, o `--feed-card`) sem um valor por superfície.
O anel é `box-shadow: inset` e não `border`, senão 1px mudaria a altura da
pastilha e a linha de base do `<figcaption>` junto. Os quatro lugares que a
desenham (`BlockRenderer`, `ChapterMention`, `SessionCard`) usam a classe;
forma e interação seguem em utilitário no ponto de uso.

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
(declaradas em `src/app/globals.css`, ao lado da `dark`). Use-as onde a pergunta é
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
`--scriba-*-accent`, `-body` e `-ink` aparecem sobre `--scriba-cream`,
`--scriba-mint` etc., que são lavados mais claros que o chão; medir no papel dá
falso OK nos dois sentidos. O mesmo vale, com mais força, para os post-its: ali
a superfície é CLARA e a tinta é escura, e é a única parte do produto em que
isso acontece.

### A landing tem tokens próprios

As faixas full-bleed usam `--lp-hero`, `--lp-band` / `--lp-band-ink` /
`--lp-band-cta` e `--lp-phone-frame` em vez de reaproveitar cor de componente.
**Não pinte uma seção da LP com `bg-scriba-blue`** (que, aliás, não é mais
azul: é a própria tinta forte).

**O hero tem DEGRADÊ, e é o único do produto.** `--lp-hero` abre em `#2B2C31`,
o meio do caminho entre o chão e a superfície elevada, e desce até `#212121`.
Ele já foi chapado por uma versão e a primeira dobra perdeu o eixo: é o degradê
que empurra o olho do título para o aparelho no fim da seção. A parada FINAL
precisa ser igual a `--lp-hero-fade`, que é contra o que o recorte do telefone
esfuma; um tom fora do lugar desenha uma faixa visível exatamente onde a ideia
era não haver borda nenhuma. As duas landings (`/` e `/parceiros`) leem o mesmo
token.

**Os dois halos radiais do hero ficam**, um azul e um dourado, invertidos de
posição entre a `/` e a `/parceiros`. São a última cor de marca do produto e o
que impede a primeira dobra de ser um retângulo cinza com texto no meio; saíram
por uma versão, junto com a pele antiga, e a página perdeu com isso o que a
fazia parecer viva.

Eles eram a única exceção à regra "nada de cor literal em `className`" — dois
`rgba()` escritos na classe. **Hoje são token** (`--lp-halo-blue` /
`--lp-halo-gold`), consumidos por `bg-[image:var(--…)]`: a exceção
acabou e a calibragem ficou num lugar só. Sobre o grafite, 16% de opacidade é
o teto antes de o halo deixar de ser luz e virar mancha de cor; no chão quase
preto de antes dava para ir mais alto.

Na `/parceiros` o dourado divide matiz com o AMARELO DA MOEDA, que ali é
informação. Passa porque é luz difusa atrás do texto, não pastilha nem número.
Se um valor em amarelo cair em cima dele, quem sai é o halo.

**A faixa (`--lp-band`) é a superfície elevada em tamanho de seção**, e o par
de botão dela (`--lp-band-cta` / `--lp-band-cta-ink`) é fixo porque ela é uma
cor só. Tinta sobre ela: 8,9:1.

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

Os MESTRES são **dois**: `public/brand/scriba.png` (a arte quadrada, opaca) e
`public/brand/banner-preview.png` (1200×630). Todo o resto de raster é derivado
deles, **não desenhe um tamanho à mão** — foi assim que seis arquivos ficaram
índigo meses depois de o app virar grafite, cada um esperando alguém lembrar
dele. Quando a marca mudar, troque os mestres e regenere, nesta ordem:

1. `src/shared/brand/ScribaMark.tsx`: a aplicação inteira (o `<path>`).
2. `public/brand/pena.svg`: a mesma pena para consumo externo e para a
   máscara do logotipo em gradiente.
3. `public/brand/favicon-{light,dark}-theme.svg`: a aba, por tema. São
   TRANSPARENTES, não carregam fundo, e por isso atravessaram a troca de pele
   sem precisar de conserto.
4. `node src/scripts/generate-brand.mjs`: lê `scriba.png` e escreve os cinco
   derivados quadrados — `logo.png` (o arquivo servido ao `LandingJsonLd`),
   `icon-{192,512}.png`, `apple-icon.png` (achatado, o iOS não compõe alpha) e
   `favicon.ico` (16/32/48/64/128/256, montado byte a byte porque o `sharp` não
   escreve ICO).
5. `node src/scripts/generate-splash.mjs`: as telas de abertura do iOS. Ele LÊ
   o `pena.svg` do passo 2, então rodá-lo antes dele redesenha a marca velha.
6. `src/app/opengraph-image.png`: cópia de `banner-preview.png` (com o
   `.alt.txt` ao lado). **O banner é mestre por si, e não sai de script**: ele
   carrega a palavra "scriba" em Poppins, e desenhar texto exigiria a fonte
   instalada na máquina de quem roda. O fundo dele foi trocado uma vez sem
   redesenhar a palavra, separando tinta de fundo pelo canal azul (a tinta é
   neutra, o fundo era índigo); se precisar de novo, a conta está no commit.
7. `src/app/manifest.ts`, `src/app/layout.tsx` e `LandingJsonLd.tsx`, só apontam, mas
   confira se o arquivo apontado ainda existe.

Sobre formatos e precedência de `<link>`, ver `src/app/AGENTS.md`.

## Ícones

**O `Sparkles` do lucide-react é PROIBIDO.** Não importe, não renderize. Para
um acento decorativo, use o hexágono amarelo já usado no app:
`clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)` sobre um
bloco `bg-scriba-yellow`.

## A navegação do app não mora aqui

**Não há barra de navegação em `src/shared/`.** Havia `AppNav` (desktop),
`MobileBottomNav` (celular), `nav.ts` (qual item acende) e `NavGlyphs.tsx` (os
cinco ícones) — as quatro saíram junto com a moldura antiga. Quem navega hoje
tem o logotipo da `TopBar` (que leva à Biblioteca) e o menu da conta no avatar;
quem CRIA — gravar, escrever, importar — usa o `+` do `CreateDock`, que mora na
página da Biblioteca. A gaveta do hambúrguer que ficava entre os dois durou uma
versão: ela existia para quatro destinos, e sobrou com um.

A esfumaçada que ficava acima da barra (`--scriba-nav-fade`) e a do rodapé do
app (`--v2-dock-fade`) continuam em `src/app/globals.css`.

## A transição de página envolve o conteúdo, nunca a moldura

`PageTransition` remonta os filhos por `key={pathname}` para reexibir o
`animate-content-fade`. Ela morava no **root layout**, e por isso derrubava e
remontava tudo abaixo dela a cada navegação: header, barra inferior e página.
No desktop lia como um piscar; no celular, e principalmente no PWA, que não
tem moldura do navegador para ancorar o olho, a barra inferior sumia e voltava
a cada toque.

Agora **cada moldura instala a sua**, em volta dos próprios `children`:
`src/app/admin/layout.tsx` e `src/app/partners/layout.tsx`. O root layout ficou com a
classe sem `key` — o fade toca uma vez no carregamento completo, para toda rota,
e não volta a tocar em navegação de cliente.

**O app (`src/app/layout.tsx`) NÃO tem `PageTransition`**, e não é esquecimento:
ele não tem chrome fixo para piscar (cada tela desenha a própria `TopBar`), e um
fade por rota ali só atrasaria a leitura.

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
  vê os cartões da Biblioteca nem o `SummaryView`: três famílias de token
  passaram meses reprovando sem aparecer. Semeie sessão antes de auditar.

Estado da última auditoria (axe-core 4.10, claro e escuro):

```
/{home,studies,profile,recording}        0 violações (eram 32)
/{summary,studies}/{id}                  0 violações
/  /sign-in  /terms  /privacy               0 violações
```

**Essa auditoria é anterior à moldura escura do app.** As telas logadas hoje
desenham sempre no tema escuro, então a metade "clara" do resultado acima vale
para o que está fora da moldura. Refaça antes de confiar nela.

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
mais a landing. O porquê está em `src/app/AGENTS.md`.
