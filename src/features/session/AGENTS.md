# src/features/session: a sessão

Tudo que pertence a uma sessão depois que ela existe: a leitura do resumo, o
estudo, a importação do YouTube, os cartões da Biblioteca e a busca das listas.

**O GRAVADOR não mora aqui.** Ele é `src/app/recording/`, e é uma tela só
(`AudioStudio` + `useAudioCapture`). Ver `src/app/AGENTS.md`.

**O EDITOR também não.** `src/app/(app)/escrever/` é a terceira porta de entrada
de uma sessão, a que a pessoa escreve à mão (modo `manual`). Ele mora lá pela
mesma razão do gravador: é uma tela de CRIAÇÃO, e esta pasta é tudo o que vem
depois de a sessão existir. Ele escreve o mesmo `SummaryPayload` que o resumo
gerado, então tudo aqui o lê sem saber que ele existe — com uma exceção, o
`SavedSessionView`, que precisa saber que uma sessão `manual` não tem
transcrição (somem o SLIDE da transcrição e os pontinhos que o anunciam, o
"Reprocessar", o "Algo está errado" e o "Gerar estudo"). Ver
`src/app/AGENTS.md`.

**E ele não é mais só a porta de entrada: `/escrever/:id` REABRE o resumo de
qualquer modo**, e o botão "Editar" do cabeçalho do `SavedSessionView` — que já
foi um item do menu de três pontinhos — aparece em todos. A
IA erra um nome ou perde a frase que valia a pregação, e consertar à mão custa um
minuto contra as 15 moedas de um reprocessamento. Editar não muda mais nada da
sessão — o modo, a transcrição e as três coisas do parágrafo acima continuam
onde estavam —, e **reprocessar continua descartando o que foi editado**, porque
ele refaz o resumo a partir da transcrição. O que permitiu isso foi o
vocabulário do editor virar o do resumo INTEIRO; ver `WRITTEN_BLOCK_TYPES` em
`src/lib/domain/summary.ts` antes de acrescentar um bloco de um lado só.

Esta pasta já foi o dobro do tamanho: ela continha três telas de captura, os
três pipelines de enriquecimento ao vivo, o feed que eles alimentavam e a fila
de chunks que os movia. Nada disso existe — o produto é gravar, resumir e, se a
pessoa quiser, aprofundar.

## Anatomia

| Onde | O que |
|---|---|
| `components/SavedSessionView.tsx` | a tela de uma sessão salva: cabeçalho editável, resumo, estudo, menu |
| `components/SummaryDeck.tsx` | o carrossel resumo ↔ transcrição, e quem busca a transcrição |
| `components/SummaryView.tsx` + `BlockRenderer.tsx` | os blocos do resumo |
| `components/StudyBlockRenderer.tsx` | os blocos a MAIS que o estudo tem |
| `components/PostItNote.tsx` | a casca do post-it dos dois murais: cor, cartão clicável, anatomia |
| `components/LibraryNote.tsx` | o post-it de uma sessão na Biblioteca (autor, título, data) |
| `components/StudyNote.tsx` | o post-it de um estudo, a mesma casca com outro recheio |
| `components/CollectionSearch.tsx` + `src/lib/search.ts` | a barra e o motor das duas listas |
| `components/YoutubeUrlForm.tsx` + `YoutubeImport.tsx` | colar o link (ou recebê-lo por parâmetro), recortar um trecho, e esperar a importação |
| `components/BibloDock.tsx` + `BibloDrawer.tsx` + `BibloMessage.tsx` | a conversa com o Biblo: botão flutuante e gaveta |
| `components/BibloSummaryDock.tsx` | o mesmo Biblo na tela de LEITURA, que precisa de um POST para inserir |
| `biblo-query.ts` | a conversa guardada no aparelho: leitura, pré-busca e a rodada nova |
| `server/biblo/` | allowance, resposta e a abertura derivada |
| `components/DeepenButton.tsx` + `DeepeningMenu.tsx` | gerar e reprocessar o estudo |
| `components/PassageVerses.tsx` + `RichText.tsx` | texto bíblico e menções dentro do parágrafo |
| `components/CacheOwner.tsx` | de quem é o cache deste aparelho, e a faxina quando outra conta entra |
| `query.ts` | a Biblioteca guardada no aparelho: leitura, escrita otimista e o conserto do atraso |
| `hooks/useCoinTick.ts` | o débito por minuto, durante a gravação |
| `recording-store.ts` | um booleano: há gravação viva nesta aba? |
| `server/final-summary.ts` | a chamada única que vira o resumo |
| `server/study/` | as cinco etapas do estudo (ver `src/lib/AGENTS.md`) |
| `server/youtube/` | oEmbed, legenda pela Supadata e a limpeza do título |
| `server/prompts/` | todo system prompt do assunto |
| `lib/transcription/` | sanitize e o veredito de qualidade de uma parte |

## A Biblioteca mora no APARELHO

`query.ts` é o acervo do lado do cliente. A lista vinha do render de `/home`, o
que significava refazer a consulta a cada abertura do app e a cada volta para a
Biblioteca, com a tela em esqueleto até a resposta chegar — e num WebView, que o
sistema mata a toda troca de app, "a cada abertura" é o tempo todo. Hoje ela é
lida do IndexedDB no primeiro quadro e revalidada atrás
(`GET /api/sessions`).

**O que se paga:** a PRIMEIRA visita num aparelho sem cache ganhou uma ida à
rede, porque o HTML não traz mais a lista dentro. É a troca que define
local-first, e ela compensa porque a primeira visita acontece uma vez.

**A chave carrega o id do usuário, e isso é correção, não higiene.** O cache é
do aparelho e um aparelho recebe duas contas; com a chave escopada, quem entra
depois não tem entrada nenhuma e busca do servidor — não existe o quadro em que
a Biblioteca de outra pessoa aparece na tela. Um `useEffect` que limpasse o
cache rodaria DEPOIS do primeiro desenho. A higiene vem junto, no `CacheOwner`,
que apaga o cache do dono anterior do disco. Ele fica na ENTRADA porque sair é
um `<form method="post">` repetido em seis telas, e ainda haveria a sessão que
expira sozinha.

**Escrita otimista:** apagar e renomear mexem no cache ANTES da resposta
(`useLibraryWriter`), e desfazem se a chamada falhar. Sem isso, apagar um sermão
e voltar para a Biblioteca o mostraria ainda lá, o que se lê como "não apagou".

**O conserto do atraso mora num lugar só.** `useLibrarySync`, chamado pela tela
do resumo: se o cache não conhece a sessão aberta, ele é velho. Todo caminho de
criação desemboca ali — gravar, importar, escrever —, então um ponto cobre os
três, e o quarto quando existir. A alternativa era um `invalidate` em cada um,
que é três lugares para esquecer um.

## O resumo e a transcrição são DOIS SLIDES

`/summary` é um carrossel de dois: o resumo, sempre o primeiro, e a
transcrição, quando a sessão tem uma. Os pontinhos ficam acima da "Ideia
central", e são `tab`s de verdade (setas do teclado, leitor de tela). Quem
monta isso é `components/SummaryDeck.tsx`, e o cabeçalho dele tem o raciocínio
inteiro; três consequências que mordem de fora:

- **"Ler transcrição" saiu do menu de três pontinhos**, e não deve voltar: ela
  está a um deslize do resumo, e um item de menu para o que está ao lado na
  tela é um segundo caminho para o mesmo lugar. O `TranscriptDialog` foi
  apagado junto.
- **A busca do resumo não varre a transcrição.** O slide dela leva
  `data-find-skip`, e o `SummaryFind` pula tudo que estiver lá dentro — a
  transcrição tem a busca DELA, que filtra as linhas. Sem isso o "3 de 17" da
  barra apontaria para um texto fora da tela.
- **A altura do trilho é medida, não livre.** Um contêiner com `overflow-x`
  tem uma altura só para os dois slides, e eles têm alturas muito diferentes;
  livre, o resumo ganharia dez telas de branco embaixo, e com `overflow-y:
  auto` apareceria um segundo scroll vertical dentro da página. Quem mexer no
  conteúdo dos slides não precisa fazer nada — o `ResizeObserver` cobre —, mas
  quem mexer no TRILHO precisa ler aquele cabeçalho antes.

**Sem transcrição não há carrossel nenhum** (é o caso de toda sessão `manual`):
o `SummaryDeck` devolve o resumo direto, sem trilho e sem pontinhos.

## Texto bíblico na tela

`PassageVerses` faz **uma** busca por passagem e tem **um** estado: ou o
esqueleto do bloco inteiro, ou o texto inteiro. Não há revelação progressiva.

Ela já teve um componente por versículo, cada um com a sua requisição. Duas
coisas quebraram, e as duas são o motivo de o arquivo estar como está:

1. **Rate limit.** Um estudo com dezessete passagens passava das 60/min de
   `/api/verse`. Os versículos recusados voltavam vazios, e a tela mostrava
   número sem texto, sem erro nenhum visível.
2. **Montagem aos pedaços.** O bloco aparecia e ia se preenchendo linha a
   linha, empurrando o conteúdo abaixo a cada versículo que chegava.

O cache do React Query é por PASSAGEM (`["passage", reference]`) e
`staleTime: Infinity` — texto bíblico não muda, e sem isso voltar para uma
sessão refazia todas as buscas.

As larguras do esqueleto são fixas por posição, e não sorteadas: um
`Math.random()` ali daria hidratação divergente e o React descartaria o HTML do
servidor.

## Menções dentro do parágrafo

`RichText` é o que o resumo, o estudo e o Biblo usam para desenhar PROSA. Ele
passa o texto por `annotateText` (`src/lib/domain/annotate.ts`) e marca duas
coisas: referência bíblica e nome próprio do LÉXICO.

**É regex sobre um léxico curado, não uma etapa de IA.** Marcar entidade com LLM
seria mais uma chamada por sessão, com custo, latência e a chance de o modelo
marcar o que não está no texto, para um problema que um autômato resolve igual
toda vez.

### O léxico é CADASTRO, e marcado quer dizer "tem cartão"

Ele já foi um array de ~330 strings em `src/lib/domain/lexicon.ts`, compilado no
bundle. Hoje é `lexicon_entries` (migração 0063), editado em **/admin/lexico**,
e cada entrada carrega um cartão: título, descrição e, opcionalmente, imagem. O
arquivo antigo virou só o vocabulário (tipos, limites e o `slugifyTerm`); as
strings foram para a tabela pelo seed daquela migração, **todas como rascunho**.

> **está marcado ⇔ tem cartão ⇔ abre no toque.**

A alternativa era marcar todo nome e deixar metade surda ao toque, que é pior
que as duas pontas: promete e não entrega. O preço, aceito de olhos abertos, é
que no dia da migração nada fica marcado — cada nome acende quando alguém
escreve o cartão dele. A categoria (`person`/`place`/`figure`) segue nos dados
e FORA da tinta, pela razão de sempre: três cores de faixa num parágrafo é uma
página de arco-íris, e o realce só funciona enquanto for exceção.

- **A passada de referência vem ANTES da de nomes, e exige número de
  capítulo.** É o que separa o evangelho do apóstolo: "João 3:16" é consumido
  inteiro pela primeira passada. Um "João" solto no meio da frase continua
  sendo o apóstolo. A lista de LIVROS não é cadastrável — ela é fechada há dois
  mil anos.
- **O casamento é exato**, acento e maiúscula inclusive. A entrada aqui é texto
  escrito por um modelo, e tolerância que não é necessária só compra falso
  positivo.
- **Os APELIDOS são o que impede um cartão por grafia.** "Lutero" e "Martinho
  Lutero", "Abrão" e "Abraão", "Saulo" e "Paulo" são a mesma entrada, e os dois
  termos abrem o mesmo cartão. O seed da 0063 já fundiu 35 pares desses.
- **Nunca aplique `RichText` em texto bíblico** (`bibleQuote`) nem em frase de
  efeito (`highlight`). No primeiro todo nome é personagem e a marcação
  pintaria o bloco inteiro; a segunda já carrega a faixa amarela.

### O índice desce, o cartão é buscado

Duas leituras, e separá-las é a decisão de desempenho da feature:

| | o quê | quando |
|---|---|---|
| `getLexiconIndex` | termo, apelidos, slug, categoria | no layout de `(app)`, cacheado 1 min em memória |
| `getLexiconCard` | título, descrição, imagem | `GET /api/lexicon/:slug`, no toque |

Juntá-las faria cada abertura de resumo baixar 300 descrições e 300 URLs de
imagem para mostrar zero delas. O cartão entra por `dynamic(ssr:false)`, igual
ao `ChapterDialog`, e é cacheado por sessão no React Query.

**No cartão, a imagem é o RETRATO do cabeçalho, ao lado do título, e não uma
faixa acima dele.** A faixa foi tentada em três alturas antes de o problema
aparecer, e ele nunca foi a altura: era o PAPEL. Uma faixa sobre o título é a
capa de um artigo, e anuncia que a imagem é o conteúdo — mas quem tocou num nome
tocou para LER sobre ele, e cada pixel de faixa empurrava a resposta para baixo
da dobra. `object-contain` sempre, e sem chão atrás: o léxico guarda as duas
formas (retrato em pé, mapa deitado), nenhum recorte serve às duas, e o cinza
por trás só desenhava as sobras de um quadrado que a arte quase nunca preenche.

**O índice chega ao `RichText` por CONTEXTO** (`LexiconProvider`), e não por
prop: o caminho até ele tem cinco degraus em quatro árvores, e esquecer um faria
a marcação sumir daquela tela sem erro nenhum. O preço foi o `RichText` virar
`"use client"`. **A landing não monta o provedor**, de propósito — sem ele a
lista é vazia e o anotador só reconhece referência, que é o que ele já fazia lá.

**O anotador memoiza a regex pela IDENTIDADE do array.** O índice desce como uma
referência estável; um `[]` literal novo a cada render recompilaria uma
alternação de trezentos termos por parágrafo.

Os dois tokens trocam de família dentro de `.tone-study`: no estudo o acento é
verde, como o resto.

## Depois do stop

O resumo é **uma chamada só**: `/api/final-summary`, com a transcrição
completa, quando o gravador termina de subir o áudio.

Já foram muitas mais. Houve uma segunda chamada de "enriquecimento" (que
inseria contexto histórico e "leia também" como comentários do Scriba), houve
três pipelines alimentando um feed durante a pregação, e houve três cards de
acompanhamento gerados junto com o resumo — releia, lembra e frase marcante —
que abasteciam um `/feed`. **Tudo isso saiu**, e o histórico importa por um
motivo prático: os payloads antigos continuam no banco, e o `BlockRenderer`
devolve `null` para tipo que não conhece, então eles simplesmente não desenham.
As linhas de custo também continuam em `llm_usage_events`, e
`src/features/admin/server/db/usage.ts` continua lendo-as pelo nome, para o custo histórico não
migrar para a linha errada do painel.

O que fica no resumo é a voz do pregador: `bibleQuote` com a referência,
`highlight` com a frase marcante, `example`, `quote` e a `conclusion`.

Sessões nunca encerradas (`ended_at is null`) saem da lista principal e
aparecem numa faixa "Gravações em aberto", com opção de continuar ou apagar.
Ver `listUnfinishedSessions`.

O usuário pode acionar o alerta manual de alucinação
(`HallucinationReportDialog` → `/api/hallucination-report`), que roda uma
auditoria da IA contra a transcrição salva. É raro e de alto impacto, por isso
usa o modelo bom, e não cobra moeda: o usuário está reportando um defeito nosso.

## O estudo

**Ele está saindo do produto, e ninguém chega mais nele pela interface.** O
"Gerar estudo" do `/summary`, o item da gaveta e o atalho do manifesto saíram;
o código desta seção continua inteiro e funcionando, e o dia de removê-lo é
outro commit. Ver `src/app/AGENTS.md`.

Duas particularidades que mordem de fora:

- **Ele não fala o vocabulário de blocos do resumo.** `StudyBlock`
  (`src/lib/domain/study.ts`) acrescenta `objection`, `reading` e `question`, e
  reinterpreta `example` — no resumo é "Exemplo do pregador", no estudo é
  ilustração do próprio estudo. Por isso a página usa `StudyBlockRenderer`, que
  desenha esses quatro e delega o resto ao `BlockRenderer`. Um bloco novo
  precisa entrar nos DOIS lugares.

  **Havia um quinto, o `distinction`** (`{ a, b, text }`, duas pastilhas com um
  "não é" no meio), e ele saiu do produto: do prompt, do parser, da selagem e
  da tela. Os estudos já gerados continuam com ele salvo no jsonb e não foram
  migrados — o bloco cai no `default` do renderer, o `BlockRenderer` devolve
  `null` para tipo que não conhece, e ele some da tela sem erro. É a mesma
  porta por onde saíram os blocos do feed ao vivo.

  O `question` tem limite de dois blocos, e só no fecho. Não é estética: o
  estudo é um ARTIGO, e o pipeline que o produz passa por uma etapa de
  perguntas; sem esse limite o redator devolve o andaime como se fosse o
  produto, e o texto vira um FAQ.
- **Gerar exige plano `Estudioso`. LER um estudo salvo, não.** O booleano vem
  do servidor por prop; a proteção real está em `requireFeature` dentro da
  rota. Ver `src/lib/AGENTS.md`.

  Consequência na tela: `/studies` tem TRÊS estados, não dois. Sem plano e
  sem nenhum estudo, a página inteira é o convite (`StudiesUpsell` variante
  `full`) — o `StudiesEmptyState`, que ensina a gerar, seria instrução para algo
  que a pessoa não pode fazer. Sem plano MAS com estudos antigos, a lista fica e
  o convite vira faixa acima dela: esconder o que a pessoa já pagou para
  produzir seria confisco.

## O Biblo: a conversa dentro da sessão

Um botão flutuante no canto de baixo à direita abre uma gaveta onde se conversa
sobre o texto que está na tela — contexto, personagens, outras passagens,
provocações —, e o que presta volta para o resumo como BLOCO. Ele vive nas duas
telas que têm um `SummaryPayload`: `/summary/:id` e `/escrever/:id`.

Desenho completo em [`docs/biblo-implementacao.md`](../../../docs/biblo-implementacao.md).
Cinco coisas que mordem de fora:

- **O território é uma PERGUNTA, não uma lista de assuntos**: "isso ajuda a
  entender, pregar ou escrever o texto na tela?". Pedido de código, de receita,
  de tradução e a tentativa de trocar as instruções levam uma linha gentil de
  volta para o texto; mas Nietzsche, Dostoiévski, um filme e "como explico a
  graça para quem não crê?" são PONTE, e ponte é matéria de sermão — recusar uma
  dessas é um erro muito pior que responder a receita, e o prompt diz isso com
  essas palavras. O que o servidor faz é fechar as portas do documento: com
  `offtopic: true` a `suggestion`, a `offer` e a `passage` caem, porque
  "Adicionar este parágrafo" embaixo de uma recusa põe a recusa no resumo de
  alguém. Ver `O TERRITÓRIO` em `server/prompts/biblo.ts`.
- **O texto bíblico nunca vem do modelo.** Ele escreve a REFERÊNCIA, o
  `RichText` a transforma em link para a NVI local, e numa sugestão
  `bibleQuote` o `text` é escrito pelo SERVIDOR (`verifySuggestion`) — a
  sugestão inteira é descartada se a referência não resolver. É o que torna um
  versículo inventado impossível em vez de improvável.
- **A referência tem DUAS formas, e o que as separa é a POSIÇÃO na linha.** No
  meio da frase é link; sozinha numa linha (com faixa de versículos) vira a
  passagem ABERTA dentro do balão, com os versículos da NVI desenhados ali
  (`asStandaloneScripture` → `BibloPassage`). Numa conversa sobre a Bíblia, ver a
  Bíblia é o padrão. Quem garante que ela apareça não é o prompt — é o campo
  `passage` do contrato, que o servidor encaixa depois do primeiro parágrafo
  (`splicePassage`); pedir a disposição em prosa foi tentado e medido, e perde
  para o hábito de escrever prosa corrida.
- **Três coisas do texto da resposta são garantidas no servidor, não pedidas**
  (`biblo/answer.ts`): a parede de parágrafo é quebrada em fronteira de frase
  (`breathe`), o "quer que eu escreva isso?" do fim é removido
  (`dropTrailingOffer`) e a oferta é virada para a voz de quem pergunta
  (`asUserVoice`) — o chip da oferta é ENVIADO como se a pessoa o tivesse
  digitado, e uma pergunta ali deixa de fazer sentido no instante do toque.
- **A sugestão é um `SummaryBlock`, e não um formato novo.** Se o que o Biblo
  quer oferecer não couber nos oito tipos que o editor já desenha, não há
  sugestão. Um "bloco do Biblo" seria um nono tipo que o `BlockRenderer`, o
  `Composer` e o `WRITTEN_BLOCK_TYPES` teriam de aprender.
- **Inserir ROLA até o bloco e pisca nele** (`revealSummaryBlock`), porque o
  "Adicionar" está na gaveta e o efeito dele está três telas abaixo. **No
  celular a gaveta fecha antes** — ela cobre o texto, e a piscada atrás dela é o
  mesmo que gesto nenhum; no desktop ela empurra, o texto está à vista, e fechar
  tiraria da tela uma conversa inacabada. Só a inserção fecha, nunca o
  "Desfazer". As duas telas revelam em momentos diferentes (o editor espera o
  commit do React, a leitura espera o `router.refresh()` voltar com o bloco), e
  é por isso que `revealSummaryBlock` não espera nada por conta própria: o nó
  daquele índice já existe, com o conteúdo antigo. No editor a inserção pela
  conversa **não pede o foco** — o bloco chegou pronto, e o cursor abriria o
  teclado por cima do que a rolagem acabou de centralizar.
- **São TRÊS portas para o documento, e só uma passa pelo modelo.** A
  `suggestion`/`offer` é dele; o **"+"** no canto de uma passagem
  (`BibloAddButton`) e o **trecho selecionado** (`BibloSelection`) são da pessoa.
  As duas últimas entram pelo MESMO `onInsert`, como uma `BibloSuggestion`
  montada no cliente com `afterIndex: BIBLO_AT_END` — um segundo canal até o
  texto seria uma segunda regra de posição, de desfazer e de salvamento.
- **A CONCLUSÃO é o teto de toda inserção, e quem decide isso é
  `insertionIndex`** (`domain/summary.ts`), chamado pelas DUAS telas. A regra
  morava só no `insertAt` do editor, e a leitura grampeava o índice ao tamanho
  da lista e nada mais: uma passagem adicionada pelo "+" caía depois do fecho,
  que é um texto acabando duas vezes.
- **"Add isso ao resumo" NÃO faz o Biblo reescrever a resposta.** Quando o
  "isso" é o que ele acabou de dizer, a `answer` é uma linha e o texto do bloco
  vem do servidor — a última resposta da conversa, palavra por palavra
  (`ANSWER_IS_A_POINTER_BELOW`). Sem isso ele repetia dois parágrafos inteiros a
  cada mensagem seguinte, e a pessoa pagava para reler o que estava na tela. **O
  harness que pega esse tipo de defeito é `tmp/dev-scripts/biblo-chat.mts`**, que
  roda uma CONVERSA; o `biblo-eval.mts`, de uma pergunta só, é cego para ele.
- **NENHUM campo do contrato é fatal, e campo novo nasce com rede.** A chamada
  já aconteceu e a moeda já foi debitada quando o schema roda: recusar ali não
  economiza nada, só transforma dinheiro gasto em "Não consegui responder
  agora". O único erro é a resposta vazia dos DOIS lados (`answer` e o texto da
  sugestão), que é quando não há literalmente o que mostrar.

  A regra custou caro para ser aprendida, e a última lição foi medida em
  produção: em 17/09/2026, **36% das perguntas ficaram sem resposta** (9 de 25).
  Cinco eram o modelo escrevendo em `offer` o OBJETO da `suggestion`
  (`{label, block, afterIndex}`) num campo que era `z.string()` sem `.catch()`,
  e quatro eram o JSON cortado ao meio pelo teto de 400 tokens de saída. Nas
  nove a resposta existia, estava correta e tinha sido paga. Ver `offerText` e o
  cabeçalho de `BibloReplySchema` em `lib/domain/biblo.ts`.

  As três defesas, e elas são independentes de propósito: o teto subiu para 700
  (`BIBLO_ANSWER_MAX_TOKENS`, que limita o OBJETO inteiro e não a prosa); um
  JSON truncado tem a prosa resgatada por varredura (`salvageAnswer`), porque
  `answer` é o primeiro campo longo e chega inteiro; e o prompt separa com todas
  as letras a FRASE da `offer` do OBJETO da `suggestion`. Um prompt mais claro
  baixa a frequência, nunca a zero, e é o schema que decide o que acontece
  quando ele erra.
- **O LÉXICO entra como FONTE, e é a única coisa do produto que governa o que o
  modelo diz.** Quando a pergunta toca um nome cadastrado e publicado, a
  descrição dele vai ao prompt como material NOSSO — não como mandado de
  repetir: se a pergunta pede mais do que está escrito ali, o Biblo responde do
  que sabe, o que ele não faz é contradizer. É o mesmo reconhecimento por regex
  que marca o nome na tela (`annotateText`), então ele recebe exatamente as
  entradas que a pessoa VÊ marcadas. Teto de 3 cartões e 600 caracteres cada, e
  falha de leitura não derruba a resposta: sem o bloco, o Biblo responde como
  respondia antes. Ver `bibloLexiconBlock` em `server/prompts/biblo.ts`.
- **O que sobe para a tela é só a IMAGEM, nunca o cartão.** O texto já está
  diluído na resposta, e desenhá-lo embaixo dela seria dizer a mesma coisa duas
  vezes, uma em voz de conversa e outra em voz de ficha. A foto é a única parte
  que a prosa não carrega. Quem escolhe é o SERVIDOR (`entityForAnswer`), não um
  campo do contrato: as menções da pergunta já foram achadas de graça, e um campo
  no JSON custaria prompt, tokens e uma conferência contra invenção de slug. Duas
  condições, as duas conservadoras — exatamente UMA entrada na pergunta, e ela
  tem imagem. O slug fica em `biblo_messages.entity_slug` (migração 0065) para o
  retrato sobreviver a fechar e reabrir a gaveta.
- **A abertura é DERIVADA, sem LLM** (`server/biblo/opening.ts`): o cumprimento
  sai do título e os chips das referências citadas. Abrir a gaveta não custa
  moeda, não custa dólar e não espera nada. Os chips com inteligência são os que
  vêm DEPOIS de uma resposta, no mesmo JSON que a escreveu.
- **A janela é de 6 pares de mensagens**, e o que fica fora vira o `thread`. É o
  que mantém o custo por mensagem CONSTANTE — sem ela um preço fixo por mensagem
  estaria errado justamente na conversa longa, que é a boa.
- **Nada na gaveta mostra preço.** Não há contador de mensagens nem "2 moedas"
  escrito em lugar nenhum; cobrar por mensagem só é aceitável porque o saldo
  deixou de ser um número na barra. Ver `docs/creditos-na-tela.md`.
- **A conversa mora no APARELHO, como a Biblioteca** (`biblo-query.ts`). O
  `BibloDock` desmonta a gaveta inteira ao fechar — é o que faz o botão VIRAR a
  gaveta —, e enquanto o `GET` era um `fetch` solto num `useEffect` isso
  significava recomeçar do zero a cada abertura: quem fechava para conferir um
  versículo no resumo e voltava esperava a conversa carregar de novo para reler
  o que já tinha lido. Hoje ela vem do IndexedDB no primeiro quadro, o
  `BibloDock` a PRÉ-BUSCA quando a tela monta (para a primeira abertura também
  ser instantânea), e a rodada que volta do `POST` é escrita no cache, não num
  estado da montagem. Dá para guardar porque o `GET` não cobra, não chama modelo
  e não grava, e porque a conversa só anda quando é a própria pessoa que fala. O
  que é volátil é o `allowance`, e por isso o `staleTime` é de 30s: o cache
  remove a ESPERA, nunca a conferência — quem cobra continua sendo o `POST`.
- **O presente com `remaining === 0` é o FIM, não um aviso.** Ele foi um estado
  intermediário: a gaveta dizia "foram por nossa conta" e deixava o campo e os
  chips vivos embaixo, então a pessoa digitava a pergunta seguinte, esperava, e
  só descobria pelo 403 que a conversa tinha acabado. O servidor sempre soube
  (`remaining` volta já descontado), e a gaveta agora traduz zero em
  `gift_exhausted` sem uma segunda ida ao servidor.
- **A despedida tem o ROSTO do Biblo ao lado, e nenhuma frase do produto usa
  travessão.** Um parágrafo cinza sem dono dentro de um chat lê como erro de
  sistema, e é justamente na despedida do presente que isso mais custa, porque é
  ali que se decide assinar. O "—" está proibido na nossa cópia e no prompt (ver
  `NADA DE TRAVESSÃO` em `server/prompts/biblo.ts`): é a marca registrada de
  texto escrito por máquina, e o Biblo inteiro existe para não soar como uma.
- **O botão da despedida abre o `BillingDialog`, não `/assinar`.** É o mesmo
  diálogo do avatar ("Créditos e planos") e o mesmo do overlay de saldo
  esgotado. Navegar dali tiraria a pessoa do meio da conversa que é justamente o
  motivo de ela considerar assinar; o diálogo pousa por cima sem desmontar nada,
  o checkout sai em outra aba, e quem fecha sem comprar volta para onde estava.

**Inserir é diferente nas duas telas, e é bom que seja.** No editor a sugestão
entra no rascunho local pelo mesmo `insertAt` do menu do `+`. Na leitura não há
rascunho: o `BibloSummaryDock` faz um POST em `/api/sessions/written` e
`router.refresh()`. Isso só é possível porque aquela rota deixou de exigir
sessão `manual` — enquanto o `409 not_manual` existia, o Biblo da leitura não
teria onde escrever.

## As listas: busca e filtros

`/home` e `/studies` têm a MESMA barra (`CollectionSearch`) e o mesmo
motor (`src/lib/search.ts`, puro e client-safe). Quem filtra é um componente
cliente por página (`LibraryBrowser`, `StudiesBrowser`); as páginas continuam
sendo só quem BUSCA no banco.

**Nas DUAS a barra fica atrás da lupa do cabeçalho**, e fechá-la limpa os
filtros. Nos Estudos ela já foi permanente, e a diferença não se sustentava:
quem abre qualquer uma das listas quase sempre quer o último item, não uma
busca, e uma barra montada por padrão come a primeira dobra dos cartões. O
estado (`SearchScope`) mora num provider porque a lupa está na `TopBar` e os
filtros na lista, ramos diferentes da árvore. **O passo de busca do tour aponta
para a LUPA nas duas telas** — ancorado na barra, ele é descartado em silêncio
porque ela ainda não existe quando o tour abre.

**Lista vazia e busca sem resultado são DUAS telas, não uma.** As duas páginas
têm um estado vazio de verdade (`SessionsEmptyState`, `StudiesEmptyState`, sobre
a casca comum do `CollectionEmptyState`) que ensina o caminho de encher a lista,
e ele só entra quando não há nada mesmo. Com filtro ligado quem aparece é o
"nenhuma gravação com esse recorte", cuja saída é limpar a busca: ensinar a
gravar a quem tem trinta gravações e digitou uma palavra errada é responder
outra pergunta.

**A filtragem é no CLIENTE, e isso é escolha.** As duas páginas já carregam
tudo do usuário num render de servidor, não há paginação em lugar nenhum, e a
escala é a de quem grava um ou dois sermões por semana. Filtrar ali responde a
cada tecla sem uma ida ao servidor por caractere.

**A exceção é a TRANSCRIÇÃO, e ela é servidor obrigatoriamente.** O texto da
pregação não vai para a lista (`SELECT_LIST` o exclui de propósito) e não pode
ir: trazer uma hora de sermão por cartão trocaria a busca por um problema pior.
Quem procura uma FRASE dita no púlpito passa por `GET /api/sessions/search`, que
devolve só ids; `useContentSearch` os une ao resultado local. Três invariantes
desse hook:

- **`null` não é conjunto vazio.** `null` = "não há resposta de conteúdo" —
  termo curto, requisição em voo, ou falha. Tratá-lo como `[]` faria cada tecla
  apagar os resultados por um instante, e uma falha de rede viraria "nada
  encontrado".
- **Resposta de consulta velha é descartada** (`seqRef`). Sem isso, a
  requisição lenta de "gra" chegando depois da de "graça" repinta a lista com o
  termo anterior.
- **`pending` não é `ids === null`.** O hook diz, separado dos ids, que ainda há
  resposta a caminho, e as listas usam isso para NÃO desenhar "nenhum resultado"
  no intervalo entre a tecla e a resposta. Sem essa distinção a tela afirmava o
  vazio e se desmentia meio segundo depois.

**A outra metade servidor é o VERSÍCULO, e ela não é busca de texto.** Procurar
"Jonas 1" tem de achar a pregação cujo resumo cita "Jonas 1:1-17", e o pregador
disse "no primeiro capítulo de Jonas" — a transcrição não ajuda, e nenhuma das
duas strings é substring da outra. `src/lib/domain/reference-query.ts` entende os
dois lados como REFERÊNCIA: resolve o livro pelos apelidos de
`src/lib/bibles/books.ts` ("genesis", "1co", "jona") e compara capítulo e faixa de
versículos por interseção, não por igualdade.

O trabalho é dividido: a RPC `session_verse_references` peneira por prefixo de
livro, e o casamento fino (capítulo, faixa de versículos) acontece no
TypeScript, com `parseVerseReference` (`src/lib/domain/reference.ts`).

**A fonte é o bloco `bibleQuote` do resumo, e só.** Já foram duas: a projeção
`session_feed_items` guardava os cards `citedVerse` do feed ao vivo, e era ela
que respondia pelas sessões gravadas naquele modo. Ela foi dropada na migração
0058, e a RPC passou a ler só o resumo — que toda sessão tem.

**Nos ESTUDOS**, o cartão que casou só pela transcrição ganha a linha "Trecho na
transcrição" e o que casou por versículo mostra a REFERÊNCIA — na tinta do
próprio post-it, não numa pastilha de cor fixa, que sobre quatro papéis
diferentes some em uns e grita em outros. Ali essa linha é obrigatória: o
post-it do estudo não cita o sermão, então sem ela o cartão aparece sem nenhuma
explicação visível para estar ali. Na Biblioteca as pastilhas equivalentes
saíram com o `SessionCard` — lá o cartão É o sermão buscado. Ver o cabeçalho de
`LibraryBrowser`.

**O agrupamento por mês foi para dentro do browser**, junto com a filtragem:
agrupar no servidor e filtrar no cliente deixa seções vazias na tela toda vez
que um filtro esvazia um mês. Em troca, `nowIso` desce do servidor por prop —
`groupLabel` compara com "agora", e um `new Date()` do cliente pode cair do
outro lado da meia-noite em relação ao HTML servido, o que faria o React
descartar a página inteira por divergência de hidratação por causa de um rótulo.

As opções de autor e de local saem dos ITENS da lista (`facetOptions`), não das
tabelas `speakers` / `locations`: um filtro que oferece um nome sem resultado
atrás é um beco, e o que a lista mostra é o SNAPSHOT em
`sessions.speaker_name` — renomear um pregador não reescreve o passado.

## Saldo durante a gravação

`useCoinTick` debita `recording_minute` a cada 60 segundos de captura, do
NAVEGADOR. É o cliente quem sabe quanto tempo o microfone ficou aberto, e o
servidor se defende do resto com `requireBalance` (ver `src/lib/AGENTS.md`).

**Falha de cobrança que não seja "saldo insuficiente" vai para o log**, e essa
linha não é decorativa: ela ficou meses sendo engolida em silêncio enquanto a
rota respondia 400 a cada minuto, e a gravação inteira saía de graça sem sinal
nenhum na tela.

## Ao mexer aqui

Um doc errado é pior que doc nenhum. Mudou o comportamento que este arquivo
descreve? Atualize-o no MESMO commit.
