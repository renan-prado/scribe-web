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

**Dois temas, e os dois valem em TODA rota.** O produto nasce grafite, da
landing ao painel do admin, e vira claro inteiro quando a pessoa escolhe. A
paleta escura mora no `:root` do `globals.css`; a clara, no bloco `.light` logo
abaixo dele.

Isto já foi errado uma vez, e o jeito como estava errado é a regra de hoje. O
produto teve dois temas enquanto a moldura da área logada declarava `dark` no
próprio nó: o claro só sobrevivia na landing, no `/admin` e na área do
parceiro, ou seja, o switch mudava metade do produto e nunca a tela em que a
pessoa estava. Por isso o tema saiu inteiro, e por isso ele voltou com **duas
garantias, que valem juntas ou não valem**:

1. **Nenhuma moldura declara tema.** `(app)/layout.tsx` não escreve mais
   `dark`, e nenhum outro layout deve escrever. Quem decide é o `<html>`.
2. **Todo token de cor do `:root` tem uma linha no `.light`.** O cabeçalho
   daquele bloco lista os poucos que não têm, um a um, com o motivo. Token de
   cor novo entra nos DOIS.

O `<html>` nasce com `class="dark"` porque o escuro é o PADRÃO servido; quem
escolheu claro tem a classe trocada por `light` pelo `ThemeScript`, antes do
primeiro paint. A inversão é deliberada: servindo o padrão, só a minoria paga
o ajuste — ao contrário, toda visita começaria branca e piscaria para o escuro.
A classe `dark` faz duas coisas, e as duas importam: ativa o
`@custom-variant dark` (e com ele as duas dúzias de `dark:` que as primitivas
do shadcn já trazem) e deixa o `:root` valer.

**O switch mora em DOIS lugares, e é de propósito:** a seção "Preferências" do
`/profile`, que é onde se PROCURA uma preferência, e o rodapé do estado vazio
da Biblioteca (`SessionsEmptyState`), que é a primeira tela de quem entra e a
única com espaço sobrando — é onde se DESCOBRE que a preferência existe. Os
dois ficam em sincronia pelo evento que o `useTheme` dispara a cada troca.

**Nunca escreva uma cor literal num `className`.** Nada de `bg-white`,
`bg-[#EAF2FA]`, `fill="#F8C64B"`. Toda cor vem de um token `--v2-*` /
`--scriba-*` / `--session-*` / shadcn declarado em `src/app/globals.css`. Token
novo de cor entra em TRÊS lugares: `:root`, o bloco `.light` e o mapa
`@theme inline` que o expõe como utilitário.

**Um valor declarado em `@theme` (sem `inline`) NÃO é redefinível por tema.**
O Tailwind o inlineia dentro da utilitária que o consome, então uma linha para
ele no `.light` é código morto que falha em silêncio. Foi o caso do
`--shadow-dialog`: a saída é declarar a PARTE que muda como custom property
comum no `:root`/`.light` e referenciá-la por `var()` lá dentro
(`--dialog-shadow-color`). Ver o comentário dos dois no `globals.css`.

### Três superfícies, e é tudo

| Token | Escuro | Claro | Papel |
|---|---|---|---|
| `bg-background` / `bg-v2-bg` | `#212121` | `#FFFFFF` | o chão, em toda rota |
| `bg-scriba-paper` / `bg-v2-card` / `bg-card` | `#2F3035` | `#F5F5F5` | tudo que é cartão |
| `bg-secondary` / `bg-v2-card-hover` | `#3A3B41` | `#EBEBEB` | o realce: hover, aba ativa |

**No claro o CHÃO é o branco puro e o componente é que é cinza** — não o
contrário. O que separa um cartão da página não é ele "ser papel", é ele ser a
única coisa cinza numa página que não é.

Foi o contrário por uma versão, na primeira passada do tema claro: chão cinza,
cartão branco, que é a inversão literal do escuro e o que a maioria dos apps
faz. A página ficava fechada. Um chão cinza TEM uma cor, e o cartão branco em
cima dele lê como papel recortado e colado; o que este produto quer é o
oposto, uma folha em branco em que os componentes pousam.

É a gramática do Notion, e ela não é gosto: num produto que é texto de ponta a
ponta, o branco tem de pertencer ao TEXTO. O cinza então passa a marcar o que é
chrome — cartão, chip, barra, menu — e a leitura fica sendo a única coisa da
tela sem moldura.

**O chão do ESCURO não mudou, e não deve mudar por causa disto.** Ele é o
grafite `#212121` de sempre; o preto do tema claro é o da TINTA e dos botões,
não um chão novo do outro lado.

Consequência para quem for desenhar uma tela: **no claro, empilhar cartão sobre
cartão desce a escala** (branco → cinza → cinza mais fundo), enquanto no escuro
ela sobe. O menu e o diálogo são a exceção nos dois: eles são `--popover`, que
no claro volta ao BRANCO, porque quem os separa é a sombra e o fio, não a cor —
um menu cinza pousado num cartão cinza é a mesma superfície duas vezes.

`--scriba-surface`, que era a faixa REBAIXADA entre o chão e o papel, virou o
próprio chão — ele e `--background` valem o mesmo nos dois temas. Ele continua
útil dentro de um cartão, onde o chão vira um encaixe (a trilha de uma barra de
progresso, a trilha do `ThemeToggle`, uma pastilha dentro do papel); o que ele
não faz mais é pintar seção. Ele é lido também como TINTA
(`text-scriba-surface` sobre `bg-scriba-ink-strong`), e nessa posição os dois
valores continuam certos.

**O tema claro é NEUTRO de ponta a ponta: R=G=B em todo cinza dele.** Ele teve
uma casta quente por uma versão (tinta `#37352F`, superfícies puxadas para o
bege), e a casta é visível — de perto o app inteiro lia levemente sépia. Hoje a
tinta é preta (`#000000`) e desce por cinzas puros (`#1A1A1A`, `#454545`,
`#6B6B6B`), os fios e as sombras são `rgba(0, 0, 0, …)`, e o botão primário e o
disco do dock são preto chapado — é o preto que faz o contraste num tema em que
todo o resto é branco e cinza.

**Seção não se separa por faixa, se separa por FIO.** Uma banda mais escura
embaixo de um chão que já é escuro lê como mancha. O fio é
`border-scriba-hairline` (a tinta a 10%), o mesmo que a Biblioteca usa entre os
meses. A exceção é a faixa full-bleed da landing (`--lp-band`), que é a
superfície ELEVADA em tamanho de seção: ela é um cartão gigante, e é isso que
ela faz na página.

**Sombra separa no CLARO, e não no escuro.** `--scriba-shadow-soft` é
`transparent` no escuro de propósito: lá um cartão se separa do chão por SER
outra superfície (`#2F3035` sobre `#212121`), e zerar o token apagou as ~20
sombras decorativas sem tocar num `className`. No claro o cinza do cartão está
a 3% do branco da página, o degrau mal existe, e o mesmo token devolve as mesmas
~20 sombras pelo mesmo caminho. É o exemplo de um token fazer trabalho de
arquitetura: a decisão "aqui a sombra separa" é uma linha, não vinte.

O degrau denso (`--scriba-shadow`) vale nos dois, e é só para o que de fato
flutua — diálogo, popover, sheet. O hover de cartão da landing (`.lp-lift` /
`.lp-tile`) não é sombra em nenhum dos dois: é a superfície subindo um degrau,
o que o app faz.

### Três cores, todas semânticas

| Família | Para quê |
|---|---|
| `--scriba-yellow*` / `--scriba-gold-*` | a MOEDA: saldo, preço, marca-texto |
| `--scriba-rec*` / `--scriba-rose*` / `destructive` | gravando, apagar, erro, valor negativo |
| `--scriba-ok-*` | o lado bom de um estado BINÁRIO de sistema, e nada mais |

As quatro famílias de tile (`mint`/`rose`/`cream`/`lilac`) tiveram valores
IDÊNTICOS por uma temporada, e o preço era o tipo de card só se distinguir pelo
rótulo. Hoje cada uma está amarrada a uma dessas três: mint é o lado bom, rose é
o lado ruim, cream é a moeda, lilac é o neutro. **Elas são lavados, e o lavado
acompanha o tema** — escuros com tinta clara no escuro, claros com tinta escura
no claro. O que não muda é o PAPEL de cada uma.

### Os post-its são a outra metade do sistema de cor

`--v2-note-{mist,sage,slate,lemon}`, cada um com o próprio par de tinta
(`-ink` e `-mute`). São a marca do acervo (ver `PostItNote`), e **a landing os
usa pelo mesmo motivo que o app**: os marcadores da seção "O problema", os chips
dos blocos do resumo, o rótulo da faixa da Biblioteca e o mural dentro do
mockup de celular.

**São quatro CINZAS, nos dois temas, e já foram quatro pastéis.** Eram três
lavados claros e saturados (azul, verde, limão) mais um escuro, e o argumento
era bom: num chão escuro a saturação some, e a cor é o que dá vida a um mural
que de resto seria cinza sobre cinza.

O que o argumento não pesa é o que a cor faz COM O TEXTO. O mural é a primeira
tela do app, cada cartão tem um título dentro, e quatro lavados saturados numa
grade de seis puxam o olho para a grade em vez de para o que está escrito nela.
Um acervo não é uma paleta. No claro isso ficava pior ainda — sobre branco os
mesmos pastéis viram adesivo de papelaria.

Hoje são quatro cinzas com um FIO de matiz: frio, verde, quente, e um neutro
que destoa por lightness (o mais claro dos quatro no escuro, o mais fundo no
claro). Eles continuam fazendo o que sempre fizeram, dar ao acervo uma memória
visual — "aquele é o cinza azulado" —, sem disputar com o título. **A hierarquia
dentro do cartão continua sendo de TINTA, não de fundo**, e é por isso que a
troca não custou legibilidade: cada face traz o próprio par (`-ink` e `-mute`),
e os dois foram recalculados junto, ~10-11:1 e ~5:1 sobre o próprio cartão.

**O matiz é um FIO mesmo, e tem um teto.** Uma primeira calibragem usava ~11 de
distância entre canais e o mural lia verde e bege, não cinza. Em ~5-8 ele lê
como temperatura, que é o que se quer: distinguível de relance, invisível
quando se está lendo.

**O fio da borda passou a valer para os QUATRO** (`NOTE_RING`, em
`PostItNote`). Era exceção do cartão escuro, o único que precisava de borda
porque dava 1,25:1 contra a página; com os quatro na mesma família não existe
mais o cartão destoante, e a exceção virou a regra. Ele é
`ring-scriba-hairline`, não um branco literal — é o que o faz acompanhar o tema.

O par `-mute` de cada face tem um segundo consumidor, e isso amarra as duas
pontas: `FOLDER_ICON_INK` tinge com ele o ícone de pasta, que pousa no cartão do
APP e não no post-it. Ele apontava para a SUPERFÍCIE de cada face, o que
funcionava enquanto elas eram pastéis claros e quebrou nos dois temas assim que
viraram cinza — ver o cabeçalho em `src/lib/domain/folder.ts`.

**Post-it é ACENTO, nunca fundo de cartão grande.** Um cartão de post-it
obrigaria a inverter a tinta de tudo que estivesse dentro dele, e a página
passaria a ter dois modelos de tinta. Onde a cor precisa cobrir área, a
resposta é a superfície elevada.

### A escala de tinta

Quatro degraus por tema, e **o pior fundo não é o mesmo nos dois**. No escuro o
piso se mede pelo PAPEL (`#2F3035`), porque o chão é mais escuro e portanto mais
fácil; no claro é o contrário, o chão é o branco e quem aperta é o REALCE
(`#EFEFED`). Por isso cada tabela mede os dois extremos do próprio tema:

```
ESCURO        chão(#212121) / papel(#2F3035)      CLARO     chão(#FFFFFF) / realce(#EBEBEB)
ink-strong      14,8 / 12,1                                   21,0 / 17,6
ink             10,9 /  8,9                                   17,4 / 14,6
ink-soft         7,8 /  6,4                                    9,6 /  8,0
ink-mute         5,8 /  4,8   <- o piso, AA para texto pequeno  5,3 /  4,5
```

A escala do claro é mais CURTA, e é de propósito: o topo dela é `#37352F`, a
tinta quente, e não um preto. 12,3:1 está muito acima de AAA (7:1), e o que se
ganha subindo para 17:1 é o zumbido de preto puro sobre branco.

**No claro os dois degraus de cima quase se tocam (21,0 e 17,4), e é de
propósito.** A prosa do resumo é `--scriba-ink`, e ela precisa ler como PRETO;
uma escala "bem distribuída" a partir do preto põe o corpo do texto num
cinza escuro, que foi exatamente o defeito relatado. Quem separa título de
corpo naquela tela é peso e tamanho, não tinta.

Mexeu num, recalcule os quatro — do tema em que mexeu. E **não ponha `ink-mute`
sobre `--secondary`**: no escuro (`#3A3B41`) ele dá 4,0:1. Quem pousa naquela
superfície é o `--muted-foreground` do shadcn, um degrau mais forte de
propósito nos dois temas (mais claro no escuro, mais escuro no claro).

`text-white` literal não é aceitável em lugar nenhum: ele é meio degrau acima
do `--scriba-ink-strong` que o resto da página usa, e a diferença aparece
exatamente onde ele costumava estar, nos blocos que fecham a leitura.

### A cor das barras do sistema

A barra de status do celular (`<meta name="theme-color">`) tem DUAS cores, uma
por tema, e elas moram em `THEME_COLOR_BY_THEME`, em `src/shared/theme-color.ts`
— o navegador lê a meta antes de qualquer CSS, então ela não enxerga um
`var()`. **Mudou `--v2-bg` de um dos temas? Mude lá no mesmo commit.**

Um `media="(prefers-color-scheme: …)"` não resolveria: o tema do Scriba é uma
ESCOLHA guardada no localStorage, não o retrato do sistema operacional. Então a
meta é servida no valor escuro (uma tag estática no `viewport` do root layout,
que é o padrão e o que quem está sem JS recebe) e tem o `content` reescrito por
dois mecanismos: o `ThemeScript`, antes do primeiro paint, e o `useTheme`, a
cada troca.

`THEME_COLOR` sozinho continua sendo o escuro e continua constante, porque os
dois lugares que o consomem desenham o instante ANTERIOR ao primeiro paint, sem
documento para consultar: o `manifest.ts` (JSON) e as telas de abertura (PNGs
gerados em build). `public/offline.html` é a terceira cópia, pelo mesmo motivo:
sem rede não há folha de estilo para carregar.

A barra de navegação do Android, que o Chrome tira do fundo do DOCUMENTO e que
nenhuma meta alcança, acerta sozinha porque `--background` é o chão do tema
vigente em toda rota — um mecanismo a menos que na primeira vez que houve dois
temas, quando a área logada tinha paleta própria e exigia um `AppThemeColor`.

**Não devolva um switch de tema sem devolver a paleta junto.** A regra continua
valendo, e é a cicatriz da primeira tentativa: o `ThemeToggleRow` do `/profile`
governava menos do que parecia, porque a moldura do app declarava `dark` no
próprio nó — virar para claro não mudava nenhuma tela logada, só a landing e o
painel. Um controle que muda o que a pessoa não está olhando é pior que controle
nenhum. Ele voltou junto com a paleta inteira e com a moldura despida do `dark`;
as duas garantias estão no topo desta seção.

### O botão primário

**É `--scriba-cta` / `--scriba-cta-ink`, na landing E na área logada.** Uma
pastilha CHAPADA em raio total (`rounded-full`) que é o desenho de botão do
app, e o par INVERTE com o tema: clara com tinta grafite no escuro, grafite com
tinta clara no claro. É o objeto de maior contraste da tela nos dois casos.

Ele continua declarado como gradiente de duas paradas iguais e consumido por
`bg-[image:var(--scriba-cta)]`: são doze lugares, e trocar o utilitário em
todos para ganhar um `background-color` no lugar de um `background-image` seria
mexer em doze arquivos por nada. O hover é um `filter` na classe `.scriba-cta`,
nunca uma cor de fundo — um `hover:bg-*` chapa o gradiente, e o `filter` serve
aos dois temas sem um segundo par de tokens, que é a razão de ele ter nascido
assim. `--scriba-cta-shadow` é `transparent`: a pastilha não flutua.

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

### O dock: onde o vidro deixa de ser vidro

As peças flutuantes do app — o disco do Biblo, a barra do celular, o painel do
`+`, a barra de busca, os chips do teclado — são "vidro": `--v2-glass-panel` /
`-button` (a superfície translúcida), `--v2-glass-sheen` (o brilho que dá
curvatura) e `--v2-glass-edge` (o fio que diz onde a peça termina), com
`backdrop-blur` por classe.

**Isso funciona sobre um chão escuro e não funciona sobre papel.** No escuro a
peça é mais clara que o fundo, o desfoque escurece o que passa atrás e o fio de
luz a recorta. Sobre uma página branca, um branco translúcido é branco: o que
sobrava era o fio a 10% da tinta, e um contorno não parece apertável. Foi o
defeito que a primeira passada do tema claro deixou.

No claro a resposta é a de qualquer chrome sobre papel: **superfície CHAPADA,
fio mais firme (13%) e SOMBRA de verdade** — `--v2-glass-shadow`, um token que
é `transparent` no escuro e uma sombra real aqui, consumido por
`shadow-[…var(--v2-glass-shadow)]` nos componentes de dock. O `backdrop-blur`
das classes fica e deixa de ter o que fazer, o que não custa nada.

**E o DISCO flutuante é a exceção dentro da exceção.** `--v2-dock-disc` /
`-ink` existe porque mesmo chapado e com sombra, um disco cinza-claro de 56px
pousado sobre uma página branca continua lendo como enfeite: ele é uma AÇÃO, a
única flutuando ali, e ação neste tema é escura, a mesma decisão do
`--scriba-cta`. No escuro o token vale exatamente o que `--v2-glass-button`
valia, então lá nada mudou — ele nasceu para dar ao claro uma resposta que o
outro tema já tinha de graça, sem arrastar junto a barra de busca e os chips,
que dividiam aquele token e precisam continuar claros (é dentro deles que se lê
e se digita).

Pela mesma razão o "Nova pasta" deixou de ser um contorno tracejado: tracejado
é o desenho de "vazio a preencher" e só se lê assim com contraste de sobra.
Hoje ele é um tile cheio, na superfície dos próprios cartões de pasta, com o
ícone num disco da tinta forte — o par do botão primário, no tamanho de um
glifo, que inverte com o tema de graça.

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
`--scriba-mint` etc., que são lavados fora da escala de superfícies; medir no
papel dá falso OK nos dois sentidos. O mesmo vale, com mais força, para os
post-its, que são os únicos quatro objetos do produto cuja cor NÃO acompanha o
tema: no escuro eles são a única superfície clara com tinta escura, e é
justamente por isso que medi-los contra o fundo da página não diz nada.

**E calibre no tema em que mexeu, não nos dois de uma vez.** Os dois blocos de
paleta são independentes: um número certo num não diz nada sobre o outro, e a
tabela da escala de tinta traz as duas colunas por esse motivo.

### A landing tem tokens próprios

As faixas full-bleed usam `--lp-hero`, `--lp-band` / `--lp-band-ink` /
`--lp-band-cta` e `--lp-phone-frame` em vez de reaproveitar cor de componente.
**Não pinte uma seção da LP com `bg-scriba-blue`** (que, aliás, não é mais
azul: é a própria tinta forte).

**O hero tem DEGRADÊ, e é o único do produto.** `--lp-hero` abre um degrau
ACIMA do chão (no escuro, `#2B2C31`, o meio do caminho até a superfície
elevada; no claro, o próprio branco do papel) e desce até o chão. Ele já foi
chapado por uma versão e a primeira dobra perdeu o eixo.

**A última parada dele é 72%, e não 100%.** Com ela no fim, a seção alcançava a
cor do fundo exatamente na borda de baixo, e toda a diferença de tom entre o
hero e a seção seguinte se concentrava nos últimos pixels — uma emenda fina,
visível por ser fina. Antes de 72% os ~28% de baixo já são o chão chapado, e
a seção seguinte começa na tinta em que a anterior terminou. A parada do meio
(38%) existe pela outra ponta: sem ela o degradê escurece rápido demais no
primeiro terço e o halo azul ganha uma borda de contraste em volta.

`--lp-hero-fade` precisa ser igual a essa última parada; um tom fora do lugar
desenha uma faixa visível exatamente onde a ideia era não haver borda nenhuma.
Quem ainda o consome é a `/partners`, que esfuma a prévia do painel contra
ele. As duas landings leem o mesmo `--lp-hero`.

**Os halos radiais do hero ficam**, e hoje são UM por landing: a `/` tem só o
azul, a `/partners` tem o dourado. São a última cor de marca do produto e o
que impede a primeira dobra de ser um retângulo cinza com texto no meio; saíram
por uma versão, junto com a pele antiga, e a página perdeu com isso o que a
fazia parecer viva.

O dourado saiu da `/` junto com o mockup de celular do hero dela: ele ficava
ATRÁS do aparelho, e sem nada por cima um degradê âmbar de 16% lê como mancha
em vez de luz. Espalhá-lo só fez a mancha maior. Na `/partners` ele continua,
com um objeto na frente.

**E a `/` ganhou PARTÍCULAS**, pontinhos que sobem devagar atrás do texto do
hero, em CSS e sem JavaScript (`LandingParticles`). Elas vivem nos lados vazios
da dobra no desktop — a coluna de texto tem 780px, e o vão que sobra é onde um
efeito de fundo não disputa com o que está escrito. Ver o cabeçalho do
componente para por que as posições são uma lista e não um sorteio.

Eles eram a única exceção à regra "nada de cor literal em `className`" — dois
`rgba()` escritos na classe. **Hoje são token** (`--lp-halo-blue` /
`--lp-halo-gold`), consumidos por `bg-[image:var(--…)]`: a exceção
acabou e a calibragem ficou num lugar só. Sobre o grafite, 16% de opacidade é
o teto antes de o halo deixar de ser luz e virar mancha de cor; no chão quase
preto de antes dava para ir mais alto. **No tema claro eles SOBEM** (22% e
30%): sobre um chão quase branco o problema se inverte, a luz some antes de
chegar perto de virar mancha.

Na `/partners` o dourado divide matiz com o AMARELO DA MOEDA, que ali é
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

### O rosto do Biblo existe em TRÊS arquivos, e nenhum é cópia do outro

A identidade — semente e as duas coordenadas de cor — mora em
`biblo-seed.ts`, e os três a leem. Ela foi extraída porque `BibloAvatar` é
`"use client"`, e uma constante importada de um módulo cliente por um server
component chega como referência de cliente, não como valor.

| arquivo | onde | por quê |
|---|---|---|
| `BibloAvatar` | o app | anima as três expressões (`idle`/`thinking`/`happy`) |
| `BibloFace` | a landing, parado | `blobatar()` no SERVIDOR: zero JS |
| `BibloHeroFace` | a landing, vivo | olhos seguindo o ponteiro (`useGaze`) |

**Um valor divergente entre eles é outra pessoa atendendo**, uma no app e outra
na página que vende o app. Ao mexer na cara, mexa na semente.

O `BibloHeroFace` carrega `blobatar/motion.css` **e** `blobatar/gaze.css`: sem
o segundo, `--mo-track-travel` fica no inicial (`0px`) e o rosto renderiza
perfeito e nunca se move — o mesmo sintoma de não haver gaze nenhum, e sem erro
em lugar nenhum. E `travel` vem pelo HOOK, nunca por CSS: a biblioteca aceita
os dois e o CSS vence o hook silenciosamente.

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

**Escrever e editar têm glifo PRÓPRIO, e são dois.** `WriteGlyph`
(`public/icons/write.svg`) é a caneta sozinha e quer dizer CRIAR um texto: o
chip "Escrever resumo" da `TopBar` e o painel de criação do celular, a saída
grátis do paywall de IA, o glifo de modo dos cartões da Biblioteca.
`EditGlyph` (`public/icons/edit.svg`) é a caneta sobre a folha e quer dizer
mexer no que já existe: a barra de baixo da leitura no celular, o botão
"Editar" do cabeçalho, o item do menu de três pontinhos, o lápis do hover no
título. **O `PenLine`/`Pencil` do lucide não serve nenhum dos dois** — os dois
traçados lado a lado não tinham parentesco, e a caneta outline do lucide ficou
meses ao lado dos glifos cheios sem ninguém notar. Os dois são `fill` e herdam
`currentColor`, então `strokeWidth` ali não faz nada. A exceção é o `/admin`,
onde `Pencil` é a ação de uma linha de tabela e não este assunto.

**O `Sparkles` do lucide-react é PROIBIDO COMO ACENTO DECORATIVO.** Não o
pendure num canto para "dar um brilho". Para isso existe o hexágono amarelo já
usado no `/admin`:
`clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)` sobre um
bloco `bg-scriba-yellow`.

A regra nasceu de um teste: ele foi pendurado no canto do quadrado destacado do
`CreateDock` (e antes dele um hexágono), e as duas vezes saiu — sobre um
quadrado de 48px que já é o único colorido da fileira, o brilhinho não somava
destaque, dividia o olhar entre duas coisas pequenas.

**A exceção é o selo "IA"**, no mesmo canto daquele quadrado, e a diferença
é o que separa as duas: ali o glifo acompanha uma PALAVRA. Enfeite compete com
a cor pelo mesmo trabalho (dizer "olhe aqui"), que a cor já faz sozinha; o selo
faz outro (dizer o que sai dali), que cor nenhuma faz. **Sparkles sem texto ao
lado continua proibido**, e um segundo selo no app não é uma exceção nova, é a
regra virando o contrário dela.

## O cache do TanStack Query SOBREVIVE ao fechamento do app

`components/Providers.tsx` usa `PersistQueryClientProvider`, não o
`QueryClientProvider` cru: o cache é gravado no IndexedDB (ver
`lib/idb-storage.ts`) e restaurado ANTES de as queries rodarem. É o que faz a
Biblioteca desenhar do disco no primeiro quadro em vez de esperar o servidor —
num WebView, que o sistema mata a cada troca de app, "abrir o app" acontece o
dia inteiro.

Três números, e os três têm motivo:

- **`gcTime` de uma semana**, contra os 5 minutos do padrão. Em cache de
  memória o padrão é bom, porque o que o coletor recolhe a página seguinte
  busca de novo; aqui o que ele recolhe é o que DEIXA DE SER GRAVADO no disco,
  e a Biblioteca voltaria a abrir vazia depois de cinco minutos fora do app.
- **`buster` é a versão do app.** O que está no disco foi serializado pelo
  código de ontem, e uma mudança de formato apareceria como cartão sem título,
  não como erro. Todo release descarta o que o anterior gravou.
- **`throttleTime` de 1s**, para juntar as rajadas de uma revalidação.

**Este arquivo não sabe quem está logado, e não deve saber:** ele envolve a
landing page também. Quem escopa o cache por CONTA é a chave de cada query, e
quem apaga o do dono anterior é o `CacheOwner` (ver
`src/features/session/AGENTS.md`).

O service worker cacheia outra coisa, e são coisas diferentes: ele guarda a
CASCA (os arquivos de `/_next/static/`, a marca e a moldura das duas telas que a
tela offline oferece como atalho), sem saber o que envelheceu; este guarda
ESTADO que a aplicação sabe revalidar. Conteúdo continua fora dos dois lados
dele. Ver `src/app/AGENTS.md`.

**E ele RESPONDE sem rede: `networkMode: "offlineFirst"`, nas queries e nas
mutações.** O padrão do v5 é `"online"`, ou seja, sem conexão toda query entra
em `paused` e nunca roda. Isso é o certo para um app que só existe ligado, e o
errado aqui: a Biblioteca, a conversa do Biblo e o texto bíblico moram no disco
justamente para a tela nascer pronta antes de qualquer rede, e em `paused` o
dado do disco continua sendo entregue mas a query fica marcada como uma espera
que não vai terminar — quem lê `isPending` para desenhar esqueleto desenha um
esqueleto eterno. Com `offlineFirst` ela tenta uma vez, falha rápido, e o que
fica na tela é o que veio do disco.

Nas MUTAÇÕES o padrão daria uma fila de escrita de graça (pausa offline,
reenvia ao reconectar), e mesmo assim a escolha é a mesma: este produto não
escreve por `useMutation`. O editor tem o próprio salvamento local-first
(`useWrittenDraft`) e a gravação tem a própria fila
(`features/session/capture-queue.ts`), as duas guardando no IndexedDB antes de
tentar a rede. Duas filas com regras diferentes sobre o mesmo trabalho é uma
delas estar errada.

## Offline: uma pergunta, um lugar

`hooks/use-network-status.ts` é o ÚNICO lugar do produto que responde "há rede
agora?". Antes a resposta estava espalhada: `navigator.onLine` solto em quatro
arquivos, cada um com a sua guarda de `typeof navigator`, e nenhum deles
repintando a tela quando a resposta mudava — eram leituras pontuais, no instante
de uma falha. Uma tela que precise DIZER "você está sem internet" não pode ser
servida por isso.

Ele exporta os dois caminhos de propósito: `useNetworkStatus()` para componentes
(`useSyncExternalStore`, porque o dado é externo ao React e é lido em mais de um
lugar ao mesmo tempo) e `isOnline()` para quem pergunta dentro de um `catch` ou
de uma função assíncrona, onde não há hook que valha. Os dois no mesmo arquivo é
o que impede a guarda de ser reescrita diferente em cada chamador.

**`navigator.onLine` é uma DICA, nunca a decisão.** Ele diz `true` num wi-fi de
hotel que não deixa passar um pacote e pode dizer `false` numa VPN que funciona.
Use-o para escolher a FRASE ("sem internet" contra "erro ao salvar"), para
adiantar um trabalho que certamente falharia, e para saber a hora de tentar de
novo. Quem decide se valeu é a resposta do servidor.

O snapshot do servidor é `true`, sempre: o HTML é montado sem saber nada do
aparelho, e se ele nascesse "offline" toda página apareceria com o aviso por um
quadro antes de se corrigir.

`components/OfflineBadge.tsx` é a pastilha, montada uma vez no layout de
`(shell)`. Ela é pequena e fica embaixo porque não é um erro, é um MODO: uma
faixa vermelha no topo trataria a falta de rede como um acidente a resolver
agora, e aqui ela não impede nada do que a pessoa veio fazer. O que ela conserta
é o silêncio — o Scriba passou a funcionar sem rede e não contava isso, e um app
que continua aceitando texto sem dizer que está offline é indistinguível de um
que está prestes a perder tudo.

`components/ReconnectWatcher.tsx` é a outra metade, no mesmo layout: o toast
"Conexão restabelecida" e a REIDRATAÇÃO que ele anuncia
(`invalidateQueries` + `resumePausedMutations` + `router.refresh()`, que é a
única das três que alcança os server components da moldura). Ele dispara na
TRANSIÇÃO, guardada num `ref`, e não no booleano: o hook nasce `true` no
servidor e no primeiro quadro, então reagir ao valor daria um "conexão
restabelecida" a cada abertura do app.

**A terceira tela do assunto é `public/offline.html`**, servida pelo service
worker quando uma navegação falha sem rede. Ela deixou de ser um aviso com um
botão de recarregar: hoje oferece também "acessar notas e gravações locais" e
"nova gravação offline", e cada um só aparece se o SW tiver a moldura daquela
tela guardada. O porquê dos três baldes de cache está em `src/app/AGENTS.md`.

## Puxar para baixo e atualizar

`components/PullToRefresh.tsx`, no mesmo layout de `(shell)` dos dois acima, e
pelo mesmo motivo: o gesto é do APARELHO, não da página.

**Ele existe porque metade dos aparelhos não tem o gesto.** O Chrome do Android
tem o nativo; o Safari do iPhone não tem nenhum quando o app está instalado na
tela inicial, que é como o Scriba é usado, e ali também não há barra de endereço
com botão de recarregar. Quem estava no iPhone não tinha caminho nenhum para
pedir dados novos.

**Atualizar aqui é a mesma reidratação do `ReconnectWatcher`**
(`invalidateQueries` + `resumePausedMutations` + `router.refresh()`), e não o
recarregamento do navegador, que remonta o app inteiro. O `router.refresh()` vai
dentro de um `startTransition` porque é do `isPending` dele que o indicador sabe
quando o servidor terminou.

**O `<html>` ganha `overscroll-behavior-y: contain` enquanto o app está
montado**, por JS e não por CSS global, pela razão do `ZoomLock`: a trava é do
app e o CSS pegaria a landing junto. Ela vale inclusive nas telas em que o nosso
gesto está desligado — é justamente na gravação que um recarregar do navegador
seria destrutivo.

O gesto morre antes de mexer em nada se houver diálogo aberto, se o dedo estiver
dentro de uma caixa com rolagem própria, se o movimento for mais horizontal que
vertical (o `SummaryDeck`) ou se a rota for a gravação. Mexeu nessa lista? O
cabeçalho do componente é onde ela se explica.

## A navegação do app não mora aqui

**Não há barra de navegação em `src/shared/`.** Havia `AppNav` (desktop),
`MobileBottomNav` (celular), `nav.ts` (qual item acende) e `NavGlyphs.tsx` (os
cinco ícones) — as quatro saíram junto com a moldura antiga. Quem navega hoje
tem o menu da conta no avatar e o voltar da `TopBar` (a pena ao lado dele é
marcação, não leva a lugar nenhum);
quem CRIA — gravar, escrever, importar — usa o `+` da `MobileActionBar` no
celular (`(app)/(shell)/components/MobileActionBar.tsx`, a barra de baixo
comum a `/home`, `/summary` e `/summary/new`, ver `src/app/AGENTS.md`) ou os chips
do `CreateActions` na `TopBar` no desktop (`ImportAction`, `RecordAction` e
`WriteAction`, com a lupa entre o segundo e o terceiro), todos montados pela
própria página. A gaveta do hambúrguer que ficava entre os dois durou uma
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
"Área do parceiro", "/admin" e "/partners/dashboard" viajam no JavaScript de todo usuário
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
- **E uma terceira, no navegador: o aceite de cookies.** O gtag só carrega
  depois dele (`AnalyticsAfterConsent`); ver "Cookies: aceitar ou não usar",
  abaixo.
- Ler `process.env` não torna rota dinâmica: a LP continua `○ Static` com o
  `<Analytics />` no root layout, conferido no output do build.
- **Não escrevemos pageview.** As navegações do App Router viram `page_view`
  pela medição aprimorada do GA4 (eventos de histórico), ligada na
  propriedade. Evento personalizado usa `sendGAEvent`, nunca `window.gtag`.

## Cookies: aceitar ou não usar

`components/CookieConsent.tsx`, montado no root layout, com nome, versão e
leitura em `consent.ts` (client-safe). **É uma barra discreta no rodapé, não
um diálogo com véu.** Já foi um diálogo central bloqueando a tela inteira, e a
sensação de abrir o site e topar de cara com isso era ruim demais para o
primeiro instante de visita — voltou a ser o formato comum, uma faixa fina no
canto de baixo.

**O impedimento de uso continua existindo, só que sem parecer um bloqueio.**
Fora das páginas legais, enquanto não há aceite, o resto da página vira
`inert` (sem clique, sem Tab, sem leitor de tela) e a rolagem trava — só que
nada escurece nem borra, e a única coisa visível diferente é a barra. Recusar
não abre uma segunda tela: o texto da própria barra muda para explicar por que
o site não funciona sem cookies, com o botão de aceitar ao lado. A razão de
não haver "recusar e seguir" de verdade: a sessão de login é um cookie, e sem
ela não existe produto.

Quatro coisas que não podem ser desfeitas:

- **As páginas legais não bloqueiam** (`CONSENT_EXEMPT_PATHS`: `/privacy`,
  `/terms`, `/partners/terms`). Lá a mesma barra aparece sem aplicar `inert`:
  ninguém pode ser obrigado a aceitar uma política que não conseguiu ler.
- **O componente é o ÚLTIMO filho do `<body>`, fora do `Providers`.** O
  `inert` é aplicado aos IRMÃOS dele; dentro de uma árvore, ele travaria a si
  mesmo junto.
- **A decisão é do navegador, nunca do servidor.** Ler o cookie no root layout
  tornaria dinâmica toda página estática do site, a landing inclusive, para
  desenhar um aviso que a maioria já aceitou. O preço é o aviso aparecer um
  instante depois do primeiro paint, uma vez.
- **O valor do cookie é uma VERSÃO** (`CONSENT_VERSION`). Mudou o que se pede
  para aceitar? Suba a versão e todo mundo vê o aviso de novo. A Política de
  Privacidade (§10) descreve o mesmo, e as duas mudam juntas.

## LandingMocks

`components/LandingMocks.tsx` é markup estático PRÓPRIO, não os componentes
do app. Isso é deliberado e tem preço: mexer no `FeedItemCard` não atualiza
mais a landing. O porquê está em `src/app/AGENTS.md`.

**As telas TROCAM sozinhas, e o palco é o `MockSwap`.** Ele empilha dois ou
três estados da mesma tela e os alterna em CSS (`--animate-lp-slide-*`), sem uma
linha de JavaScript: as fatias se cruzam por opacidade, com atrasos diferentes
sobre a mesma duração. Três coisas dele não são livres:

- **A altura sai de um FANTASMA**, uma cópia do primeiro estado no fluxo e
  invisível: os estados de verdade são absolutos, e uma caixa só de filhos
  absolutos mede zero. Por isso o primeiro estado tem de ser o MAIS ALTO dos
  irmãos, ou o que sobra dos outros é cortado — foi o que obrigou o resumo da
  seção de gravar a começar pela ideia central, e não a caber inteiro.
- **As fatias compartilham as coordenadas.** O que faz a troca parecer uma ação
  em vez de um corte é o conteúdo comum não sair do lugar: no editor, o
  parágrafo de cima é o mesmo pixel nos três estados. Um bloco a mais em um só
  deles transforma a dissolvência num pulo.
- **`prefers-reduced-motion` mostra o fantasma e esconde as fatias**, então a
  seção fica no primeiro estado, PARADA. Quem pede menos movimento não pede uma
  caixa vazia.

São QUATRO telas, uma por capacidade da LP, e cada uma tem uma amarra:

- `LandingRecordingMock` (gravar) — a onda, o relógio e os três botões. É a
  única que precisa da ALTURA do aparelho escrita à mão
  (`h-[calc(680px-108px)]`): o `PhoneFrame` põe os filhos num invólucro sem
  altura própria, então um `h-full` resolve para `auto` e os botões sobem e
  colam na onda. Mexeu na altura da tela ou no vão do cabeçalho do
  `PhoneFrame`? Mexa aqui também.

  **A onda MEXE e o relógio CONTA, e os dois são CSS.** As barras têm três
  durações longas com atrasos negativos diferentes (`--animate-lp-wave-*`), e
  o relógio são três fitas de dígito rolando com `steps()`
  (`--animate-lp-digit-*`, e o `MockClock` aqui). Um mockup parado embaixo de
  "grave a pregação" é a única coisa na tela que desmente a frase ao lado. Nas
  fitas, o `count` do `DigitReel` e o `steps()` da animação são o mesmo número
  — a keyframe percorre a fita INTEIRA (`-100%` dela), então é o número de
  passos que define quanto vale um dígito.
- `LandingYoutubeMock` (importar) — o link colado e o botão, e mais duas fatias:
  a espera (`LandingYoutubeImportingMock`, que é `/import/[id]` com as etapas
  do `STEPS` do `YoutubeImport`) e o resumo. A do meio é a que responde "e depois
  que eu colo o link?" — sem ela a seção mostra um formulário e um resultado, e o
  trabalho, que é a parte que o Scriba faz no lugar da pessoa, acontece fora da
  tela. **O RECORTE ("do minuto 12 ao 45") já esteve nesta tela e saiu**: ele
  responde uma pergunta que ninguém fez ainda na LP, e o que a seção precisa
  provar é que um link vira resumo. Não o traga de volta sem pedido. O preço
  também não está no botão: nenhuma das quatro seções fala em moedas hoje.
- `LandingEditorMock` (escrever) — o `/summary/new` em três estados (`state`): o
  texto como estava, o menu do `+` ABERTO e o bloco novo sendo digitado, com o
  cursor piscando (`--animate-lp-caret`). A pastilha "Parágrafo" aparece escolhida
  no menu porque o bloco que nasce na fatia seguinte é um parágrafo: trocou um,
  troque o outro. Ali
  estava a tela de LEITURA (`LandingSummaryMock`, que saiu por ter ficado sem
  consumidor), e ela mostrava o resultado pronto embaixo de um texto que promete
  um editor. Os blocos escritos são o `BlockRenderer` de verdade, como no
  editor; o que é reproduzido à mão são os controles, e as medidas saem do
  `BLOCK_SURFACE` do `Composer`. A fileira de pastilhas é `BLOCK_OPTIONS` mais
  a ideia central: opção nova lá, pastilha nova aqui.
- `LandingBibloMock` (conversar) — a gaveta aberta SOBRE o resumo, com o texto
  visível atrás, porque é isso que a feature é. A conversa é ancorada embaixo
  (`justify-end`) e cortada no topo, e o trecho sugerido tem de continuar
  visível: é a única parte que prova "a resposta entra no texto".

As três falam do MESMO sermão (João 4), e a do Biblo conversa sobre o que a do
resumo mostra. Trocar o sermão de uma é trocar das três.
