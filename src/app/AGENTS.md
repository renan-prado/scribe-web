# src/app/: rotas, API e SEO

Regras da camada de roteamento. Para a camada de servidor abaixo dela, ver
`src/lib/AGENTS.md`.

## Quatro grupos, e a raiz quase vazia

```
src/app/
  layout.tsx  globals.css  not-found.tsx
  robots.ts  sitemap.ts  manifest.ts  favicon.ico  apple-icon.png  opengraph-image.png
  (site)/     o que um visitante anônimo vê
  (entrar)/   login, OAuth e os links que criam sessão
  (app)/      tudo atrás do login
  (painel)/   /admin e /partners
  api/
```

Os parênteses são o [route group][rg] do Next: a pasta organiza e **não entra
na URL**. `(app)/home/page.tsx` continua sendo `/home`.

[rg]: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups

**O que ganhamos com eles, em ordem de importância:**

1. **A moldura fica com quem a usa.** `(app)/layout.tsx` é o chão preto e o
   `TourProvider`, e ele cobre exatamente as telas logadas. Antes isso morava
   num grupo `(app)` que envolvia metade das rotas e nada dizia sobre o resto.
2. **Onde o arquivo fica responde "isto é público?".** A pergunta que mais se
   erra ao criar rota nova (e que o `src/proxy.ts` precisa saber) passa a ter
   resposta na árvore de pastas.
3. **A raiz de `src/app/` tem 10 entradas, não 39.** Uma lista de quarenta
   pastas irmãs não se lê; ela se percorre.

**Três coisas NÃO entram em grupo, e não é esquecimento:**

- `robots.ts` e `manifest.ts` param de funcionar dentro de um grupo (medido: o
  build simplesmente não emite `/robots.txt` nem `/manifest.webmanifest`, sem
  erro nenhum). `sitemap.ts` sobrevive, e fica junto das irmãs mesmo assim, por
  consistência — são slots do framework, não rotas que a gente organiza.
- `layout.tsx`, `globals.css` e `not-found.tsx` são a raiz por definição.
- `api/` é um grupo por si: pôr `(api)` em volta seria um parêntese decorativo.

**Duas rotas de grupos DIFERENTES podem compartilhar prefixo de URL**, e o
produto depende disso: `/profile` mora em `(app)` e `/profile/delete` em
`(site)`, porque a segunda é PÚBLICA (é a URL da ficha da Play Store) e não pode
herdar a moldura do app nem a consulta ao banco que ela faz. O que o Next proíbe
é a mesma URL FINAL sair de dois grupos.

## Mapa de rotas

**Público** (o `src/proxy.ts` deixa passar sem sessão):

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
/profile/delete         a página que apaga a conta. Pública de propósito, é a
                        URL da ficha das lojas; o botão só aparece logado
/api/stripe/webhook     ÚNICA porta de crédito. HMAC no lugar do cookie
/api/billing/sweep      cron diário da Vercel, guardado por CRON_SECRET
/robots.txt  /sitemap.xml  /manifest.webmanifest
/llms.txt  /index.md     resumo do produto para agentes. Fonte única em
                         src/shared/content/llms.ts; route handlers, não
                         arquivo estático
```

`GET /` com `Accept: text/markdown` é reescrito pelo `src/proxy.ts` para
`/index.md`, negociação de conteúdo (acceptmarkdown.com). A resposta Markdown
leva `Vary: Accept`; a HTML não (o Next é dono desse header nas rotas do App
Router, ver o comentário no `src/proxy.ts`).

**O app, atrás do login** (`src/app/(app)/`, moldura própria):

```
/home             "Biblioteca": o acervo agrupado por mês e o botão de
                     criar. É onde cai quem loga
/recording        o gravador: onda, pausar, parar e apagar. Um modo só
/summary/[id]     o resumo da sessão. O destino de TUDO que o app faz
/studies          a lista de estudos gerados. SEM ACESSO pela interface
/studies/[id]     um estudo. SEM ACESSO pela interface
/escrever         a folha em branco: o editor de blocos, modo manual
/escrever/[id]    o mesmo editor, num texto que já existe
/importar         cola o link do vídeo e cria a sessão modo youtube
/importar/[id]    a importação rodando: legenda + resumo
/profile          a conta, o saldo e o plano
/indicar          indique a um amigo
/assinar          abre o Checkout (destino do CTA da landing)
/retorno          volta do Checkout. DECORATIVA: não credita nada
```

**O `/studies` continua de pé e ninguém mais chega nele.** O modo estudo vai
sair do produto, e o primeiro passo foi tirar o acesso: o item da gaveta (que
morreu junto com o hambúrguer), o botão "Gerar estudo" do `/summary`
(`DeepenButton`), o atalho do `manifest.ts` e o passo de tour que apontava para
o botão. As rotas, a API, as tabelas e os componentes continuam inteiros — isto
é esconder, não remover, e o dia de remover é outro commit. **Quem mexer aqui
não deve "consertar" o acesso**: ele foi tirado de propósito. Duas consultas
foram junto do botão (`hasDeepening` e a checagem de `study_generation` do
`/summary`), porque alimentavam só a ele.

A moldura é `src/app/(app)/layout.tsx`, e ela quase não desenha: não há header nem
barra de navegação, cada tela renderiza a sua própria `TopBar`. Ela garante o
chão grafite e monta o `TourProvider`.

**A `TopBar` é um SERVER component** (`src/app/(app)/components/`): ela lê perfil e
saldo com `getCurrentAccount`, então quem a renderiza é sempre a PÁGINA, nunca
um componente cliente. O canto direito tem duas coisas: o SLOT `trailing`, que
depende da tela (a Biblioteca passa o gatilho da busca, a gravação passa o
relógio), e, à direita dele, o AVATAR, que é da barra e aparece em toda tela que
a monte.

**O canto esquerdo é o LOGOTIPO, e ele leva para a Biblioteca.** Ali houve um
hambúrguer com uma gaveta de quatro destinos; Escrever e Importar passaram para
o `+` do rodapé (é lá que se cria), os Estudos saíram da interface, e a
Biblioteca sozinha não é uma gaveta — é a marca, que é onde todo mundo já toca
para voltar ao começo de um app. O logotipo não ganha o chip de `chip.ts`: a
marca não é um controle, e dentro de uma pastilha ela viraria mais um botão
numa fileira deles.

**Com `backHref` ela vira a barra do `/summary`**: o logotipo dá lugar a um
voltar e o título some — a página inteira é o título do sermão, repeti-lo na
barra seria dizê-lo duas vezes. O avatar não muda. Quem monta a barra lá é a
página, e ela entra no `SavedSessionView` por um slot `header`, porque aquela
view é `"use client"` e não teria como renderizar um server component.

**As telas de LEITURA não têm lupa** (o `/summary` e o estudo). Elas já tiveram,
levando para a busca do acervo, e a leitura era outra: sobre um texto longo,
uma lupa promete procurar DENTRO dele. Um botão que promete uma coisa e faz
outra é pior que o botão que falta. Quem continua com ela é o `/importar`, onde
não há conteúdo com que confundir: lá é a `LibrarySearchLink`, um LINK para
`/home?busca=1` — a busca é da Biblioteca, índice e filtros moram no
`LibraryBrowser`. O `?busca=1` é lido pela `/home` e vira o `defaultOpen` do
`SearchScope`, senão a lupa entregaria a Biblioteca com o campo fechado.

## `/escrever`: a terceira porta

O produto tem três maneiras de uma sessão nascer, e a terceira não captura
nada: o gravador abre o microfone, o `/importar` traz a legenda de um vídeo, e
o `/escrever` é a pessoa digitando o resumo à mão. As três desembocam no mesmo
lugar, um `SummaryPayload` numa linha de `sessions` — modo `manual`, ver
`lib/domain/session.ts`.

**É o único caminho que não custa moeda**, e não por generosidade: não há STT
nem chamada de modelo em lugar nenhum dele. Por isso `COIN_COSTS` não tem uma
linha para ele, e a ausência é a regra, não um esquecimento.

**O editor não usa biblioteca de rich text, e isso é uma decisão sobre o
DOMÍNIO.** Nenhum bloco do `SummaryBlockSchema` tem formatação inline: todos são
`{ type, text }`, string pura. Então cada bloco é uma `<textarea>` vestida com
as classes do `BlockRenderer` correspondente (`AutoTextarea`), e a edição
acontece no lugar da leitura, sem pré-visualização. Um Tiptap ou um Lexical
traria uma segunda representação do texto — um documento com nós e marcas —
para ser espremida de volta numa string na hora de salvar, e cobraria cem
quilobytes por recursos que não têm onde ser guardados.

A consequência é que as classes de cada bloco existem em DOIS lugares: no
`BlockRenderer` (leitura) e no `BlockBody` do `Composer` (edição). Mudou o
desenho de um bloco lá, ajuste aqui no mesmo commit — é o que sustenta a
promessa de que o que se escreve é o que se lê.

**A frase de destaque é a exceção, e por isso tem um espelho.** A marca amarela
é um gradiente atrás das PALAVRAS (`.highlight-phrase`, com
`box-decoration-break: clone` para recomeçar a cada quebra), e o fundo de uma
`textarea` é o retângulo da caixa. Então o amarelo é pintado por um `div` atrás
dela — o mesmo texto, mesma tipografia, mesma largura útil, em tinta
transparente. O `text-pretty` da leitura NÃO vai para os dois: ele mexe na
quebra e a `textarea` não o aplica, o que desalinharia a marca do texto.

**O bloco em foco pousa numa superfície** (`focus-within:bg-scriba-blue-soft/60`,
com recuo negativo para o texto não andar quando a cor acende). Ele existe pelo
celular, onde não há ponteiro e o teclado cobre metade da tela. Não é uma barra
na margem: barra na margem é o vocabulário de CITAÇÃO, é o que o bloco `quote`
desenha, e o mesmo traço para "isto é citação" e para "é aqui que você está"
faz um parágrafo comum parecer citado enquanto é escrito. É CSS, e não o estado
`active` do `Composer`, porque a superfície não tem nada a que sobreviver: ela é
o foco e mais nada.

**O `active` apaga quando o foco sai do bloco**, e o `onBlur` que o apaga confere
o `relatedTarget` antes: se o foco foi para um filho do próprio bloco (a
lixeira, o mover, a pastilha da passagem), o cursor não saiu dali. Sem esse
apagar, um `+` revelado por um clique ficava aceso pelo resto da sessão; sem a
conferência, tocar na lixeira apagaria o estado que mantém a lixeira na tela.

**Quem acende os `+` é o `Composer`, não um `group-hover`.** Cada vão pertence a
DOIS blocos, e o `+` entre eles aparece ao passar por qualquer um dos dois — um
`group-` só enxerga o ancestral em que foi declarado, e o vão mora dentro de um
só. Há também um `+` ACIMA do primeiro bloco: sem ele não havia como pôr nada
antes do começo do texto a não ser criando depois e subindo.

**Uma posição, UM dono.** `adderAt` é uma posição, não o endereço de um
componente, então dois `+` que respondam pelo mesmo número abrem os dois menus e
empilham duas fileiras idênticas na tela. Uma linha em branco é dona do vão logo
acima dela (o `+` dela insere ali), e por isso o vão acima de uma linha em branco
não desenha o seu próprio `+` — nem o do topo, quando o primeiro bloco já é uma
linha em branco — nem o de baixo, que não seria duplicata e sim ruído: um
segundo disco 28px abaixo do dela, dizendo a mesma coisa. Cada bloco responde
pelo vão ACIMA dele (é daí que sai o `+` antes do primeiro), e a linha do rodapé
responde pela posição depois do último, sumindo quando esse último já é uma
linha em branco.

**O `+` é OPCIONAL, e a linha do fim é uma linha em branco de verdade.** Depois
do último bloco há sempre uma `textarea` vazia com a roupa de parágrafo, e o `+`
fica ao lado dela: escrever ali cria o parágrafo com o que foi digitado e passa
o cursor para ele (`WritingLine`, no `Composer`). Escrever um texto é escrever
parágrafos — pedir que a pessoa escolha "Parágrafo" num menu antes de cada um
cobra um clique por aquilo que ela ia fazer de qualquer jeito. O menu continua
respondendo pelo resto: título, passagem, destaque, citação, conclusão.

**Todo parágrafo VAZIO é essa mesma linha**, com o mesmo `+` ao lado — inclusive
o que um Enter acabou de criar no meio do texto. Uma linha em branco é o momento
em que "na verdade eu queria um título aqui" ainda está em aberto, e a oferta
não pode aparecer ou sumir conforme a linha seja um bloco de verdade ou a do
rodapé. Pela mesma razão a linha do rodapé some quando o último bloco já é um
parágrafo vazio: as duas desenham a mesma coisa, e empilhadas seriam duas linhas
em branco onde a pessoa pediu uma.

**O `+` de inserir mora na PÍLULA do bloco** (`BlockControls`), junto de mover e
excluir, e insere ACIMA dele — é o que diz o rótulo. Ele já ficou no vão entre
dois blocos: eram dois discos por bloco, acendendo e apagando conforme o mouse
passava, e uma tela de texto com uma dúzia de botõezinhos piscando ao redor.
Numa barra que já existe e já aparece na hora certa, é um botão a mais.

Inserir só acima não deixa posição órfã porque a linha do fim está sempre lá: as
posições entre blocos saem da pílula do bloco de baixo, e o fim do texto é a
própria linha em branco do rodapé.

**O VÃO é do contêiner, e nada mais mora dentro dele.** Ele já foi de 56px para
abrigar aquele disco; hoje são 32px, contra os 28 da leitura.

**O menu de blocos FLUTUA sobre a linha, e não empurra nada.** Em fluxo, as sete
pastilhas quebravam em duas linhas e empurravam o documento inteiro para baixo —
o texto que a pessoa está olhando para decidir o que vem a seguir saltava no
instante do clique, e o que estava sob o mouse deixava de estar. Ele começa
exatamente onde a linha começa, e o `×` cai em cima do `+` que o abriu: mesmo
disco, mesmo lugar, só o glifo muda (`DiscButton`) — o que só fecha porque ele
não tem contorno: 1px de borda é 1px de LAYOUT, e tirava o `×` de cima do `+`.
Ele não tem fio em volta, nem sombra, nem cor própria — os três o transformavam
numa caixa pousada sobre o documento, e ele é a própria linha trocando de
conteúdo. O que o sustenta é ser OPACO e estar por cima: `z-30`, contra os
`z-10` da pílula de um bloco. Com duas fileiras de pastilhas ele cobre parte do
bloco de baixo, e o que está embaixo não pode aparecer no meio das opções nem
acender ao passar o mouse sobre elas. Enquanto ele está aberto NENHUMA pílula aparece, nem a de
outro bloco: com duas fileiras de pastilhas o menu cobre o começo do bloco de
baixo, e a pílula daquele bloco ficava metade escondida e metade para fora. Fecha com Esc, com
um clique fora (é o que o `data-block-menu` marca) ou voltando a escrever.

**NENHUM controle é mais alto que a linha de texto, e é essa regra que mantém o
editor com uma altura de linha só.** Toda caixa de bloco tem 42px (a linha de
26px mais 8px de cada lado), tenha dentro um parágrafo ou uma linha em branco
com o `+` ao lado. Quando esse `+` tinha 36px ele esticava a linha em branco
para 44 e ela ficava mais alta que o parágrafo vizinho — duas alturas de linha
no mesmo documento, que é o que dá a sensação de espaçamento desproporcional. A
pílula segue a mesma regra por outro caminho: 34px, menor que a caixa, pousada
na borda de cima dela.

**A geometria fecha, e as contas estão no `BLOCK_SURFACE` do `Composer`.** Vão de
32px, a caixa avançando 8px para dentro dele de cada lado, 16px de superfície a
superfície. O que casa com a leitura é a LARGURA do texto, que é o que decide
onde a linha quebra.

**O vermelho do excluir é `--scriba-rose` (#3A2321), o VINHO da paleta**, com o
glifo em `--scriba-rose-ink`. Não é a tinta rosada clara: sobre o grafite, um
fundo claro com o glifo branco vira um borrão vermelho no canto da tela. Fundo
escuro com glifo rosado é o mesmo aviso, no tom em que o resto do app fala.

**Quem começa pelo disco recua menos à esquerda** (`ROW_LEADING_DISC`): 8px até
o disco, e os mesmos 8 do disco até o texto. Os 12/20px da caixa são recuo de
TEXTO; um disco de 24px já traz a própria margem visual, e com 20px antes dele e
9 acima a mesma linha tinha duas medidas de respiro. Esse recuo é igual nos dois
tamanhos de tela, porque quem manda nele é o disco, que não muda de tamanho.

**O disco que se vê tem 24px; o alvo que se acerta tem 36.** O `p-1.5` estica a
área e o `-m-1.5` devolve o espaço ao layout, então o alvo cresce sem empurrar
altura nenhuma. Um alvo de 24px é metade do mínimo de toque, e é no celular —
sem mouse para mirar — que esse `+` aparece.

**A `AutoTextarea` é `block`, e isso não é decoração.** Uma `textarea` é
inline-block por padrão e pousa na linha de base do pai, deixando por baixo dela
o espaço dos descendentes: quatro píxeis que ninguém pediu, dentro da superfície
do foco (que ficava alta demais, com o texto encostado no topo) e somados a cada
dois parágrafos do documento.

**O vocabulário do editor é MENOR que o do resumo** (`WRITTEN_BLOCK_TYPES`): não
tem `example`, cujo rótulo na tela é "Exemplo do pregador" e não faz sentido num
texto que a própria pessoa escreveu, nem um terceiro nível de título. A "ideia
central" não é bloco: ela é o `shortSummary`, o que aparece no cartão da
Biblioteca e na busca. E é OPCIONAL — o campo não nasce na tela, entra por uma
pastilha "Adicionar ideia central" no topo e sai pelo `×` do próprio cartão.
Resumir a mensagem em uma frase é coisa que só se consegue fazer depois de
escrevê-la; um campo fixo em cima da folha em branco pergunta antes da hora.

**A faixa de versículos se escolhe como um período num calendário.** Um toque
finca a ponta, o outro fecha, e ENTRE os dois o caminho até o número sob o mouse
já aparece pintado — é isso que responde "quanto eu estou pegando?" antes do
segundo toque. Um terceiro toque recomeça dali, como em todo seletor de período.
A grade dos versículos não tem vão entre as colunas (a faixa é uma fita, não uma
fileira de pastilhas) e arredonda nas pontas do intervalo E nas quebras de
linha, senão uma faixa que vira a linha parece duas seleções. Quem sabe onde a
linha quebra é uma CONTA sobre o número de colunas (`useGridColumns`), e não um
seletor `nth-*`: numa grade responsiva as regras de seis colunas continuavam
valendo na grade de oito, e sobravam cantos arredondados no meio da fita.

**Dentro daquele diálogo, realce é VÉU BRANCO, e não `blue-soft`.** O popup tem
`bg-popover`, que é `#2F3035` — exatamente o valor de `--scriba-blue-soft`.
Todo `hover:bg-scriba-blue-soft` ali pintava cinza sobre o mesmo cinza: o toque
não respondia nada e a faixa escolhida ficava invisível entre as duas pontas.
Os três níveis (`VEIL_HOVER`, `VEIL_ACTIVE`, `VEIL_RANGE`) são a mesma tinta
clara em forças diferentes, e por isso leem como escala. Eles guardam a classe
INTEIRA, com a variante junto: um `hover:${...}` montado com template nunca
aparece no código, o Tailwind não gera a regra, e o realce some sem erro nenhum
— a segunda maneira de a mesma coisa ficar invisível.

Todo item escolhível do diálogo tem `active:` (`LIST_ITEM`): num diálogo em que
todo toque troca a tela, `hover:` não existe no celular, e sem o afundar do
toque o dedo pousa no número e nada acontece até a tela seguinte chegar.

**E o terceiro passo termina no `Concluir`, não no toque.** Fechar a faixa
fechava o diálogo junto, e quem errava o último versículo por uma casa refazia
livro e capítulo. Os dois primeiros passos não têm rodapé: ali escolher é
avançar, e um botão de confirmar seria um segundo jeito de fazer a mesma coisa.

**A passagem bíblica guarda só a REFERÊNCIA.** O `PassagePicker` caminha livro →
capítulo → versículos sobre `CHAPTER_VERSE_COUNTS`, então só é possível escolher
o que existe, e o bloco nasce com `text` vazio: quem busca a NVI é o
`PassageVerses`, como num bloco escrito pela IA. Guardar aqui uma cópia do texto
bíblico seria uma segunda fonte para a mesma passagem.

O editor monta o MESMO `PassageVerses`, e não um aviso de que o texto entra
depois: este é o único bloco sem nada para digitar, escolhida a referência não
há mais nada a fazer, e a única confirmação de que se escolheu a certa é ler o
que veio. A busca é em cache por referência (`passageQueryOptions`), então abrir
a leitura em seguida não a refaz. Por isso também o bloco inteiro deixou de ser
um botão: clicável é a PASTILHA da referência, que é a parte que se troca — com
a passagem dentro, o botão teria por nome acessível os sete versículos.

**O salvamento é LOCAL-FIRST.** Cada mudança cai no IndexedDB em 300ms
(`draft-store.ts`) e no banco em 1,8s (`useWrittenDraft`), e ao reabrir a tela
o rascunho do aparelho VENCE o que o servidor devolveu, quando é mais novo que
o último envio confirmado. A sessão nasce no PRIMEIRO envio, não ao abrir a
tela: criar ali encheria a Biblioteca de textos vazios de quem clicou no menu e
desistiu. Até lá a URL é `/escrever`; depois vira `/escrever/{id}`.

**Três regras existem porque cada uma já comeu uma palavra digitada**, e as três
são a mesma ideia: o que está na tela agora é a verdade.

1. A URL do primeiro salvamento muda por `history.replaceState`, não por
   `router.replace`. Navegar remontava o editor com o que o servidor tinha
   acabado de devolver, e o que foi digitado durante o POST voltava atrás.
2. O rascunho lido do IndexedDB não entra se uma tecla já foi digitada nesta
   montagem. A consulta é assíncrona, e quem abre a tela e escreve na hora tinha
   a primeira letra apagada pela resposta que chegava depois.
3. No desmontar, o que ainda não subiu é gravado no aparelho na hora, sem
   esperar a pausa de 300ms — que seria cancelada junto com o componente. E ao
   voltar, um rascunho mais novo que o último envio agenda o envio que faltou;
   sem isso ele ficaria guardado só ali para sempre.

**O autor de um texto manual é quem o escreveu**, e a sessão já nasce assinada
com o `display_name` do perfil. Nos outros modos o `speaker_name` é o PREGADOR —
alguém que não é quem está com o aparelho na mão —, e por isso nasce vazio
esperando ser preenchido; aqui não há terceiro nenhum. Continua editável em
`/summary`, para quem transcreve à mão o sermão de outra pessoa.

**Uma sessão `manual` não tem transcrição**, e três coisas somem da leitura por
causa disso: "Ler transcrição", "Reprocessar" (refaria o resumo a partir de uma
transcrição vazia, cobrando 15 moedas para apagar o que a pessoa escreveu) e
"Algo está errado" (audita a IA contra a transcrição — aqui não houve IA, o
alerta apontaria o dedo para o próprio autor). Gerar estudo também não aparece,
e é decisão do v1: `/api/deepening` recusaria com `empty_transcript`.

A busca por REFERÊNCIA, essa, encontra normalmente — ela lê os blocos
`bibleQuote` do resumo, que o texto escrito tem como qualquer outro.

**A conta mora num lugar só, o `AccountMenu`, e o gatilho é o avatar.** Dentro
dele: o saldo (o `CoinBalance` de verdade, que abre o `BillingDialog`), "Meu
perfil", os atalhos de admin/parceiro quando houver, e o Sair, separado — um
POST para `/auth/sign-out`, o item mais perigoso do app, e por isso o mais
fundo. Ele já teve um segundo gatilho, uma linha no rodapé da gaveta do
hambúrguer, com este mesmo conteúdo; a gaveta morreu e o `variant="row"` foi
junto.

**A GAVETA do hambúrguer durou uma versão, e a lição dela é de tamanho.** Ela
tinha quatro destinos (Biblioteca, Estudos, Escrever, Importar do YouTube) e a
forma da sidebar do `/admin` — marca em cima, destinos no meio, conta no
rodapé. Dos quatro, dois eram CRIAÇÃO e foram para o `+` do rodapé, que é o
lugar onde já se tocava para criar; um saiu do produto; e o que sobrou é a tela
onde se cai ao entrar, que o logotipo alcança sem gaveta nenhuma. Um painel de
tela inteira para um destino é um toque cobrado para mostrar o que o toque
anterior já poderia ter feito.

A cor vem de tokens no namespace `--v2-*` (`src/app/globals.css`), e eles são a
ORIGEM da paleta do produto inteiro: `--background` é `--v2-bg`,
`--scriba-paper` é `--v2-card`, `--secondary` é `--v2-card-hover`. O site e o
painel passaram para a pele do app, e com isso o bloco `.dark` deixou de
existir — há um tema só, declarado uma vez em `:root`.

**O chão é `#212121`, e já foi `#000000`.** Preto chapado embaixo dos post-its
da Biblioteca virava um vão, não uma página. Quem mexer em `--v2-bg` mexe
TAMBÉM no `--v2-dock-fade`, cujos dez `rgba` são a cor da página: um fade preto
sobre grafite não some no chão, ele pinta, e o rodapé vira uma mancha escura de
borda difusa. O `theme-color` NÃO acompanha — ele sai de
`src/shared/theme-color.ts`, que espelha `--scriba-surface` e vale para o site
inteiro; a barra do sistema ficar um degrau mais escura que o app é seam
conhecido, e o conserto seria `theme-color` por rota.

**Os endereços antigos são `redirects()` do `next.config.ts`, não páginas:**

```
/feed /recordings /list   → /home
/billing/assinar          → /assinar        /billing/retorno → /retorno
/recording/:id/summary    → /summary/:id
/recording/:id/deepening  → /studies/:id
/recording/:id/youtube    → /importar/:id
/session/:id              → /summary/:id
```

Eram nove arquivos com um comentário e uma linha de código cada. Mudaram de
lugar por uma razão que não é só contagem: **o `redirects()` roda ANTES do
proxy.** Um anônimo que abre `/recordings` chega ao login com
`?next=/home`, o destino vivo; como página, o gate via `/recordings` primeiro e
guardava no `?next=` um caminho que só existe para ser abandonado.

A query atravessa sozinha, e isso importa em dois deles: `?plan=` carrega a
escolha feita na landing, e `?cs=` é o que permite reconciliar um pagamento cujo
webhook não chegou — uma sessão de Checkout aberta durante o deploy ainda traz
`/billing/retorno` gravado do lado do Stripe.

**Quatro endereços antigos não viraram redirect: viraram a própria rota.**
`/studies`, `/importar`, `/profile` e `/indicar` respondiam 308 para
`/v2/<mesma coisa>`; com o prefixo fora, o endereço antigo É o novo. O
`/v2/` era andaime de uma migração que acabou.

## A Biblioteca e o gravador

O `/home` põe o ACERVO como primeira tela e gravar como o botão no rodapé. O
LAYOUT vem dos prints em `public/prints/new-release/`: barra no topo, blocos por
mês, e embaixo uma faixa que escurece até o grafite da página
(`--v2-dock-fade`) com o botão vermelho no meio. A faixa fica sempre; o BOTÃO
some ao rolar para baixo e volta ao rolar para cima.

### O mural de post-its

Cada sessão é um post-it (`LibraryNote`) num masonry de DUAS colunas
(`columns-2`), e o cartão diz três coisas: **autor, título e data.**

**Os Estudos são o MESMO mural** (`StudyNote`): autor da pregação, título do
estudo, data em que ele foi gerado. Enquanto uma tela era um mural de anotações
e a outra uma lista de fichas com "Baseado em", trocar de aba parecia trocar de
produto. A casca das duas é o `PostItNote` — cor, cartão clicável, véu do toque
—, e o recheio é o único arquivo de cada uma; um `variant` traria de volta o
`if` que matou o `SessionCard`, e copiar a casca faria duas versões do
"stretched link" divergirem até uma parar de ser clicável em silêncio. O cartão
do estudo passa o id da SESSÃO como cor, então estudo e sermão saem da mesma cor
nos dois murais. No estudo não há glifo de modo: ali todo cartão é um estudo, e
um ícone que nunca muda é enfeite ocupando a linha da data. Saíram o
resumo curto, a duração, o local, o botão "Ver resumo →" e as pastilhas de modo
e de estudo — numa coluna de ~150px, cada linha a mais empurrava a data para
fora do primeiro olhar. Sobreviveu o MODO, como glifo ao lado da data: microfone
para o gravado, play para o importado. Marcar só o YouTube seria marcar a
exceção, e o cartão sem glifo diria "não é YouTube" em vez de "gravado".

**O cartão é um `<a>` em volta de tudo**, e o menu de três pontinhos que
morava no canto superior direito SAIU. Ele comia a largura onde o título
quebra — numa coluna de ~150px, duas linhas de título — para oferecer Editar e
Remover, que o menu do `/summary` já tem, na tela em que se vê o que vai ser
editado ou apagado. Com ele foram o `SessionCardMenu`, a Server Action de
apagar da `/home` e o `deleteAction` que descia página adentro. E foi ele
também que segurava o "stretched link" (`::after` esticado + `z-10` no menu),
que existia porque botão dentro de link é HTML inválido: sem botão nenhum lá
dentro, aquilo era mecanismo sem a razão que o justificava.

**A cor de um cartão sai do HASH DO ID, nunca da posição na lista.** Pelo
índice, gravar um sermão novo repinta o acervo inteiro e o cartão amarelo de
ontem é verde hoje; cor de post-it é memória visual, e instável ela é só ruído.
São quatro faces (`--v2-note-*`), cada uma com o próprio par de tinta porque uma
delas é ESCURA — não existe uma tinta só que sirva às quatro.

**A ordem de leitura do masonry é coluna-a-coluna**, então o segundo sermão mais
recente cai ABAIXO do primeiro, não ao lado. É consciente: um grid preservaria a
cronologia e perderia o escalonamento, e o escalonamento é o desenho. O
agrupamento por mês contém o estrago, a bagunça nunca atravessa um bloco.

O `SessionCard`, que servia as duas listas, foi APAGADO junto — quando
`/recordings` virou redirect ele ficou com um consumidor só, e um post-it não é
aquele cartão com menos coisas. Um `variant` teria mantido o rodapé, as
pastilhas e a paleta `--scriba-*` vivos atrás de um `if`, para nunca mais serem
renderizados.

**Os controles da barra do topo são CHIPS REDONDOS** (fundo `--v2-card` sempre
visível), e não alvos transparentes que se acendem no hover: hover não existe no
celular. São 40px com glifo de 20px — 44px com glifo de 24px davam à barra dois
botões que pesavam mais que o próprio título. Eram quadrados arredondados até o
avatar entrar ao lado deles: três controles na mesma barra com duas bordas
diferentes liam como peças de origens diferentes, e quem cede é o chip. A
classe deles mora em `(app)/components/chip.ts`, um `.ts` puro que servidor e
cliente leem igual: são quatro botões em quatro arquivos desenhando o mesmo
objeto, e copiada ela divergiria no primeiro ajuste de raio.

**O avatar PREENCHE o botão**: o toque se anuncia clareando a própria foto
(`hover:brightness-125`), não acendendo um disco atrás dela. Aquele disco era
uma moldura que o celular nunca mostra e que no desktop vira um halo cinza em
volta de uma foto redonda. A CAIXA dele é a mesma do chip (40px, é ela que
alinha a barra), e a foto tem 36: uma foto chapada pesa mais que um disco de
`--v2-card`, que é quase a cor da página, e com os dois a 40 o avatar lia como
o maior dos dois botões.

**O título da barra não é negrito**, e tem `gap-3` até o canto da esquerda: em
`font-semibold` ele competia com o conteúdo que a página veio mostrar, e
encostado no botão lia como legenda dele em vez de nome da tela.

A busca fica atrás da lupa, e não permanente: quem abre o Scriba quase sempre
quer o último sermão, não uma busca. Fechá-la LIMPA os filtros, senão a lista
reabriria recortada por uma escolha de dois dias atrás. O botão mora na `TopBar`
e o estado na lista, então um `SearchScope` (contexto) envolve os dois na
página. **Vale para os Estudos também**, onde a barra já foi permanente: a lupa
é a mesma (`SearchToggle`, com rótulo e alvo de tour por prop), e lá ela só
aparece quando há algum estudo — sem lista montada, o botão abriria uma barra
sem onde existir.

O botão de criar mora na PÁGINA do `/home`, não no layout, e é o que o mantém
fora do `/summary`: uma tela de leitura não oferece gravar.

**Ele é um `+` no canto de baixo à direita, e abre as TRÊS portas** (`CreateDock`):
"Resumo mágico" (o microfone, `/recording?auto=1`), "Escrever" (`/escrever`) e
"Importar do YouTube" (`/importar`), num painel de ícone-e-nome como o dos
prints em `public/prints/new-release/`. Era um microfone sozinho no meio da
faixa, e as outras duas portas moravam na gaveta — três toques longe, num lugar
que ninguém abre para criar, abre para navegar.

Três decisões dele que não são estética:

- **À direita, não no centro.** Centralizado, o botão pousava sobre a coluna
  esquerda do mural e tampava um cartão; e um painel que se abre a partir do
  centro não tem para que lado crescer.
- **O `+` continua VERMELHO** (`--v2-rec`), mesmo não sendo mais só o microfone:
  é a cor da ação do produto, e num mural de post-its coloridos um `+` cinza
  seria mais um retângulo. As opções lá dentro são neutras e iguais entre si —
  quem chegou nelas já decidiu criar.
- **Rolar fecha o painel.** O painel é `fixed`; parado no canto enquanto a lista
  corre atrás dele, com um véu por cima que o dedo atravessa, seriam dois
  comportamentos contraditórios no mesmo gesto.

Girar um `+` em 45° dá um `×`: o botão que abre é o mesmo que fecha, e trocar de
glifo faria o fechar aparecer do nada no lugar do abrir.

**O `/recording` grava UM áudio e transcreve UMA vez.** O produto já
transcreveu a cada 15-20s, porque havia um feed ao vivo que precisava do texto
na hora; sem ele, aquela cadência custaria ~206 chamadas por hora de sermão
para entregar exatamente o mesmo resumo.

O áudio é fatiado mesmo assim, mas por OUTRO motivo e em outra escala, e os dois
cortes não se confundem:

- **Fragmento (2 min), para não perder.** `MediaRecorder.start(timeslice)` emite
  um pedaço a cada 2 minutos, guardado no IndexedDB na hora. O primeiro traz o
  cabeçalho e os seguintes são continuação, então concatená-los devolve o
  arquivo original. A aba morrer custa, no pior caso, 2 minutos.
- **Parte (~7 MB), para caber no POST.** `/api/transcribe` recusa acima de 8 MB,
  uns 46 minutos a 24 kbps. Ao encostar no teto o gravador é encerrado e outro
  começa (cabeçalho novo = arquivo válido por si), esperando um silêncio para a
  emenda não cair no meio de uma palavra. 40 minutos: uma parte, uma chamada.
  60 minutos: duas.

Verificado em navegador: o concatenado decodifica inteiro, um fragmento do meio
sozinho não decodifica, um gravador novo no mesmo stream produz arquivo válido,
e pausar/retomar não corrompe nada.

No stop o áudio JÁ está guardado — foi guardado durante a pregação —, então só
resta criar a sessão, transcrever as partes, resumir e apagar a cópia local.
Falhando qualquer passo, o áudio continua no aparelho e a tela oferece tentar de
novo ou **baixar o arquivo**. Isso conserta o defeito que custou uma palestra de
quase uma hora: o `Blob` vivia numa variável local, a falha caía num `catch` que
mostrava um aviso educado, e o coletor comia a única cópia do que foi dito.

**Dívida conhecida:** começar sem internet. Gravar não depende de rede, mas a
sessão nasce de um `POST` no stop — sem ele o áudio fica guardado esperando, o
que é bem melhor que sumir, mas não é funcionar offline.

**Restrito:** `/admin/*` (gate em `src/app/admin/layout.tsx`, responde `notFound()`
a quem não é admin) e `/partners` (gate em `src/lib/auth/require-partner.ts`).

As três rotas de link de entrada (`/r`, `/i`, `/c`) são irmãs e seguem as
mesmas decisões: são ROTAS e não páginas (para nenhuma delas custar a
estaticidade da LP), respondem 302 e não 308, e redirecionam também quando o
identificador é impossível. A única que difere no destino é `/c`, que vai para
`/sign-in` em vez da landing: um cupom é convite nominal, quem o abriu já disse
sim, e pôr a página de vendas no caminho é pôr um argumento diante de quem já
foi convencido. Nenhuma das três entra no `sitemap.ts` nem no `/llms.txt`, elas
não são conteúdo, são efeito colateral com redirect.

**API:** `src/app/api/`, LLM (`transcribe`, `final-summary[/reprocess]`,
`deepening[/reprocess]`, `youtube/import`, `verse`, `hallucination-report`),
dados (`sessions[/search|/written]`, `speakers`, `locations`, `coins`,
`feedback[/prompt]`, `tour/{start,finish,reset}`), conta (`account/delete`),
cobrança (`billing/*`, `stripe/webhook`) e admin (`admin/users`,
`admin/partners`, `admin/features`, `admin/coupons`, `admin/insights`).

`sessions/written` é a rota do `/escrever`, e a ÚNICA do produto que recebe um
`SummaryPayload` vindo do CLIENTE — todos os outros nascem dentro do servidor, a
partir da resposta de um modelo. Daí `WrittenSummarySchema` ter teto em cada
campo e em cada lista: sem eles uma aba empurraria megabytes de jsonb para
dentro da linha. Ela cria a sessão quando não vem `id` e sobrescreve quando vem
(o editor salva sozinho e não deveria ter de saber se aquele é o primeiro
salvamento), confere o dono antes de trabalhar e recusa com 409 `not_manual`
uma sessão que não foi escrita à mão: o editor fala um vocabulário menor que o
do resumo, e deixá-lo tocar uma gravação apagaria em silêncio o que a IA
escreveu. Esconder a tela nunca é a proteção.

`account/delete` é a ÚNICA rota autenticada que se recusa a usar
`requireAuth()`, e a exceção é o ponto dela: `requireAuth` responde 403 a quem
um admin desativou, e quem foi banido é exatamente quem mais quer sair. Ela usa
`getAuthUser()` direto, não lê saldo e não chama modelo nenhum, então não há o
que `is_active` protegesse ali. Cancela a assinatura no Stripe ANTES de apagar
(`src/lib/account/delete-account.ts`): a ordem inversa deixaria uma cobrança
recorrente viva num `customer` que nenhum usuário resolve mais. Ver
`src/app/profile/delete/page.tsx` e `docs/app-store-ios.md`, Portão 4.

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

`youtube/import` é a outra porta do mesmo pipeline de resumo, e a única cuja
transcrição não veio de um microfone: ela busca a legenda do vídeo em
`sessions.source_url`, grava como transcrição e roda o resumo por cima. A ordem
dentro dela é `dono → já importada? → legenda →
duração → COBRA → resumo`, e a legenda vir ANTES da cobrança é uma inversão
deliberada em relação a `/reprocess` e `/api/deepening`, ela é a chamada
barata (~R$ 0,03) e é ela que diz se o vídeo é importável, então cobrar antes
obrigaria a estornar três recusas rotineiras. A regra que aquelas rotas
protegem continua valendo: a chamada CARA (o resumo) só roda depois do débito.
Ver o cabeçalho da rota.

`sessions/search` é a metade SERVIDOR da busca das listas, e responde a DUAS
perguntas sobre a mesma sessão: o que foi DITO (`ilike` na transcrição) e o que
foi CITADO (os versículos). A segunda não é busca de texto: "Jonas 1" precisa
achar o resumo que cita "Jonas 1:1-17", e o pregador falou "no primeiro capítulo
de Jonas", que não contém nenhuma das duas strings. Quem compara referência com
referência é `src/lib/domain/reference-query.ts`; a peneira por livro é a RPC
`session_verse_references` (migrações 0041/0042). A resposta separa as duas
vias porque o cartão mostra POR QUE está ali, "trecho na transcrição" ou a
referência que casou. Não chama modelo, então não passa por `requireBalance`,
mesma razão de `/api/verse`.

## O proxy é o gate, não a página

`src/proxy.ts` (o antigo middleware) roda em todo request não-estático. Ele renova
o cookie do Supabase e decide o bucket da rota. **Não insira código entre
`createServerClient` e `supabase.auth.getUser()`**, reescrever cookie no meio
quebra o handshake de refresh do `@supabase/ssr`.

- Anônimo em rota protegida → `/sign-in?next=<path>`.
- Anônimo (ou logado) num caminho que **não é** público nem bate com
  `KNOWN_APP_PREFIXES` → passa direto, e o Next responde `404`
  (`src/app/not-found.tsx`). Sem isso o proxy mandava todo caminho inexistente para
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
  // 7. recordChatUsage() para o custo aparecer em /admin/custos
  // 8. log.debug("ok", { latencyMs, finishReason, promptTokens, completionTokens })
}
```

Os cinco primeiros passos são obrigatórios e nessa ordem. O bucket em
`RATE_LIMITS` (`src/lib/rate-limit.ts`) é dimensionado pela cadência real do
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

Débito de moedas passa por `chargeCoins` (`src/lib/db/coins.ts`), que hoje fala com
a RPC pelo **service-role**: `charge_coins` teve o EXECUTE revogado de
`authenticated` na migração 0037 porque, com ele, dava para chamar a função
direto do navegador e escolher o próprio preço. **Crédito não tem rota**, ver
`src/features/billing/AGENTS.md`.

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
  precisa de texto corrido usa `joinVerses` (`src/lib/domain/verse.ts`).
- **Só voltam os versículos que EXISTEM.** Uma faixa que passa do fim do
  capítulo devolve menos linhas, não linhas vazias.

## Server Action é endpoint, não pedaço de página

Uma Server Action é um POST próprio, com id que é hash estável embutido no
bundle. O gate de um layout decide o que RENDERIZA, não o que executa: quem
souber o id invoca a action sem nunca ter passado pelo layout. **Toda action
privilegiada reconfere a autorização dentro de si**, `assertAdmin()` nas
actions de admin (ver `src/lib/auth/require-admin.ts`).

Quando a proteção real for a RLS e não a página, escreva isso no código: o
`deleteSessionAction` da Biblioteca está protegido pela policy, e trocar o
client do usuário pelo service-role ali o transformaria num IDOR sem sinal
nenhum no diff.

## Landing page: o que não pode voltar

A LP é a única página que um visitante anônimo carrega. Duas regras a
protegem, e as duas são fáceis de desfazer sem perceber.

**`src/app/page.tsx` é ESTÁTICA. Nada nela lê cookie, sessão ou header.** Uma
única chamada a `supabase.auth.getUser()` ali dentro marca a rota como
dinâmica, e o efeito é desproporcional: a resposta passa a sair com
`Cache-Control: private, no-store` e `X-Vercel-Cache: MISS`, HTML remontado
na origem a cada visita, com DUAS idas ao Supabase antes do primeiro byte,
numa página cujo conteúdo é idêntico para todo anônimo. O `no-store` ainda
derrubava o bfcache, então voltar para a LP recarregava tudo. O redirect de
quem já está logado mora no `src/proxy.ts`, que já tem o usuário resolvido.

**Quando a LP precisar mesmo se personalizar, o caminho é o do `HeroEyebrow`.**
O selo "indicado por Fulano" que aparece acima do título do hero depende de
um cookie, e resolvê-lo no servidor custaria tudo que o parágrafo acima
descreve. O desenho: as rotas de link gravam um cookie-PISTA legível por JS
(`scriba_ref_hint=1`, sem nome nem código dentro), um componente cliente só
consulta `/api/referral/active` SE a pista existir, e a resposta é `no-store`.
Assim os 99% que não vieram de link nenhum não pagam requisição alguma, e o
HTML continua saindo da CDN. A pílula nasce ESCONDIDA e só existe quando há
indicação a anunciar: um script antes do primeiro paint (`HeroEyebrowScript`)
marca o `<html>`, e o CSS mostra um esqueleto de altura fixa
até a resposta chegar, então nem quem veio indicado vê o título saltar.

Quem garante que a pista existe é o `healReferralHint` do `src/proxy.ts`: um cookie
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
`/#planos` saem de `src/features/billing/plans.ts`, o mesmo catálogo do diálogo de
compra e do `/profile`. Só a lista de recursos (`PLAN_FEATURES` em
`src/app/page.tsx`) é copy local, porque descreve capacidades, não valores. Antes
disso a LP anunciava 2.000/5.000/100 créditos contra os 1.000/2.500/50 reais:
preço de tela errado é promessa quebrada no checkout.

## SEO

`src/lib/seo.ts` é a fonte única de domínio, nome, título e descrição. Um
`metadataBase` divergindo do `Sitemap:` do robots é o tipo de erro que só
aparece semanas depois, num relatório do Search Console.

- **Só produção é indexável.** `IS_INDEXABLE` deriva de `IS_PRODUCTION_DEPLOY`.
  `dev.scriba.cc` é um Preview com domínio fixo: HTML público servido de
  domínio próprio, e a Vercel NÃO manda `X-Robots-Tag: noindex` nesse caso.
  Sem a checagem, o ambiente de dev entra no índice competindo com `scriba.cc`
  por conteúdo idêntico.
- `src/app/robots.ts` e `src/app/sitemap.ts` são código, não arquivo estático, porque
  o ambiente precisa decidir. Só entra no sitemap URL que responde 200 e é
  indexável, `/sign-up` é redirect e `/sign-in` é tela de login com `?next=`
  multiplicando variantes; ambas ficam fora, e o resto do app está atrás do
  proxy (para o rastreador, `307 → /sign-in`).
- Título ≤ ~60 caracteres, descrição ≤ ~155, escritos com o vocabulário de
  quem PROCURA. "Transcrever sermão" e "estudo bíblico" são os termos reais.
- `robots.ts`, `sitemap.ts` e `manifest.ts` NÃO podem ficar atrás do muro de
  autenticação, já ficaram.
- **Página pública nova entra em TRÊS listas no mesmo commit**: `PUBLIC_PREFIXES`
  do `src/proxy.ts` (sem isso ela responde `307 → /sign-in` para quem não tem
  conta, que é exatamente o público dela), `src/app/sitemap.ts` e os `Links` do
  `/llms.txt`. Foi o caminho de `/parceiros`.
- **Conteúdo para agentes** (`/llms.txt`, `/index.md`) sai de
  `src/shared/content/llms.ts`, um lugar só, mesma regra de `src/lib/seo.ts`. A
  seção "Quando usar o Scriba" existe porque o produto não tem API pública: a
  orientação certa para um agente é mandar a pessoa criar conta. Página nova de
  confiança (`/about`, `/contact`) entra na lista de `Links` de lá.
- **Caminho inexistente responde `404` de verdade**, não `307 → /sign-in`. A
  lógica está no `src/proxy.ts` (`KNOWN_APP_PREFIXES`); o `src/app/not-found.tsx`
  aponta para o sitemap e o `/llms.txt`.

## Ícones e metadata

`metadata.icons` no `src/app/layout.tsx` SUPRIME as convenções `src/app/icon.*` e
`src/app/apple-icon.*`, mas NÃO suprime `src/app/favicon.ico`, esse é emitido junto.
Por isso o `apple-touch-icon` está declarado à mão: o arquivo era servido, mas
nenhum `<link>` apontava para ele. O bloco existe porque só ele expressa
`prefers-color-scheme`; a convenção de arquivo emite `<link>` sem `media`.

**O Google não aceita SVG como favicon** (a lista dele é BMP, GIF, ICO, PNG,
JPEG, PPM, TIFF). Enquanto o site declarou só os dois SVGs, e ainda atrás de
`media`, que rastreador não avalia, a busca mostrava o ícone antigo e
`/favicon.ico` dava 404. Por isso `src/app/favicon.ico` existe e não pode sumir de
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
que o código lê, ver `src/lib/bibles/loader.ts` antes de adicionar outra.

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

### A barra de status é uma constante

A cor da barra do sistema no PWA sai de `<meta name="theme-color">`, e hoje ela
é uma tag ESTÁTICA, declarada no `viewport` do root layout. O produto tem um
tema só, então o valor não depende de nada: `#212121`, o mesmo do
`theme_color` e do `background_color` do manifest e das telas de abertura.

Ela já foi escrita por um script inline no `<head>`, porque dependia do
localStorage — que nem CSS nem `<meta>` sabem ler, e que o
`prefers-color-scheme` de uma meta estática não expressa. Com o tema claro fora
do produto, aquele script, o efeito que o corrigia dentro da área logada e o
`useTheme` que o reescrevia a cada troca deixaram de existir. O hexadecimal
mora em `src/shared/theme-color.ts` (e, copiado, em `public/offline.html`).

O `viewport` do root layout declara `viewport-fit=cover`, é o que faz
`env(safe-area-inset-*)` valer diferente de zero. Quem consome os insets é o
`CreateDock` e o rodapé de cada tela; sem eles o iPhone desenha o botão de
criar por baixo da barra do gesto do sistema. Zoom fica liberado
(`maximumScale: 5`): travar o pinch é violação de acessibilidade.

**Em cima quem paga é o LAYOUT do `(app)`**, com `pt-[env(safe-area-inset-top)]`
uma vez só: `viewport-fit=cover` manda a página passar por baixo da barra de
status, e sem esse respiro a hora e a bateria do iPhone instalado pousam em
cima do hambúrguer. Embaixo a folga é de cada tela, porque depende do que ela
põe ali; em cima é sempre a mesma barra, e repetido em seis páginas bastaria
esquecer uma.

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
  continua tendo mouse). As variantes moram em `src/app/globals.css`, ao lado da
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
(`#212121`, o chão da área logada — o app abre na cor em que ele fica; era o
índigo da hero antiga, e a abertura piscava azul antes de virar cinza). **O iOS
ignora isso**:
sem `apple-touch-startup-image` casando exatamente com o aparelho, ele abre o
app numa tela branca. As imagens saem de `src/scripts/generate-splash.mjs` e os
`<link>` de `src/shared/splash.ts`, as duas metades leem o MESMO
`src/shared/splash-screens.json`, e aparelho novo é uma linha lá mais uma
rodada do script.
