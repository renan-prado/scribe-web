# src/features/session: a sessão

Tudo que pertence a uma sessão depois que ela existe: a leitura do resumo, o
estudo, a importação do YouTube, os cartões da Biblioteca e a busca das listas.

**O GRAVADOR não mora aqui.** Ele é `src/app/recording/`, e é uma tela só
(`AudioStudio` + `useAudioCapture` + `useRecordingPresence` +
`RecordingWorkbench`). Ver `src/app/AGENTS.md`.

**O que a gravação DEIXA, esse mora.** O áudio guardado no aparelho, a pipeline
que o transforma em resumo e a fila que insiste por ele são desta pasta
(`lib/capture-store.ts`, `lib/capture-upload.ts`, `capture-queue.ts`): eles eram
da tela de gravação, e ser dela foi exatamente o defeito — ver "A gravação
guardada, e quem insiste por ela".

**O EDITOR também não.** `src/app/(app)/(shell)/summary/_editor/` (a folha em
branco de `/summary/new` e o `/summary/[id]/edit` que reabre um resumo) é a
terceira porta de entrada de uma sessão, a que a pessoa escreve à mão (modo
`manual`). Diferente do gravador, ele não é uma pasta irmã de topo: mora
DENTRO de `summary/`, porque as duas entradas são páginas do mesmo segmento
que a leitura, `/summary/[id]`, e compartilham o `Composer`. Ele escreve o
mesmo `SummaryPayload` que o resumo gerado, então tudo aqui o lê sem saber que
ele existe — com uma exceção, o `SavedSessionView`, que precisa saber que uma
sessão `manual` não tem transcrição (somem o SLIDE da transcrição e os
pontinhos que o anunciam, o "Reprocessar" e o "Algo está errado"). Ver
`src/app/AGENTS.md`.

**E ele não é mais só a porta de entrada: `/summary/:id/edit` REABRE o resumo de
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
| `components/SavedSessionView.tsx` | a tela de uma sessão salva: cabeçalho (só o título se corrige aqui), resumo, menu |
| `components/SummaryDeck.tsx` | o carrossel resumo ↔ transcrição, e quem busca a transcrição |
| `components/SummaryView.tsx` + `BlockRenderer.tsx` | os blocos do resumo |
| `components/SummaryEmptyState.tsx` | sessão salva sem resumo nenhum: o botão que abre o editor |
| `components/StudyBlockRenderer.tsx` | os blocos a MAIS que o estudo tem |
| `components/PostItNote.tsx` | a casca do post-it dos dois murais: cor, cartão clicável, anatomia |
| `components/LibraryNote.tsx` | o post-it de uma sessão na Biblioteca (autor, título, data) |
| `components/SessionModeGlyph.tsx` | o ícone do modo, o mesmo nas três vistas |
| `components/StudyNote.tsx` | o post-it de um estudo, a mesma casca com outro recheio |
| `components/CollectionSearch.tsx` + `src/lib/search.ts` | a barra dos Estudos e o motor da busca (também usado pela `GlobalSearchDialog`) |
| `components/SummaryFind.tsx` | procurar DENTRO do resumo aberto: `Range`s + CSS Custom Highlight API |
| `components/FindBar.tsx` | a barra dessa busca, FIXA no topo — a casca que a leitura e o editor dividem |
| `components/YoutubeUrlForm.tsx` + `YoutubeImport.tsx` | colar o link (ou recebê-lo por parâmetro), recortar um trecho, e esperar a importação |
| `components/BibloDock.tsx` + `BibloDrawer.tsx` + `BibloMessage.tsx` | a conversa com o Biblo: botão flutuante e gaveta (ou painel `inline`) |
| `components/BibloSummaryDock.tsx` | o mesmo Biblo na tela de LEITURA, que precisa de um POST para inserir |
| `hooks/useWrittenReadingDraft.ts` + `components/SummaryInsertContext.tsx` | escrever num resumo salvo sem rascunho local — o POST que o Biblo e o "Adicionar ao resumo" da referência dividem |
| `components/BibloHomeDock.tsx` + `biblo-workspace.ts` | o Biblo da Biblioteca, que ESCREVE um documento em vez de sugerir um bloco |
| `biblo-query.ts` | a conversa guardada no aparelho: leitura, pré-busca e a rodada nova |
| `server/biblo/` | allowance, resposta e a abertura derivada |
| `components/DeepenButton.tsx` + `DeepeningMenu.tsx` | gerar e reprocessar o estudo |
| `components/PassageVerses.tsx` + `RichText.tsx` | texto bíblico e menções dentro do parágrafo |
| `components/BibleReader.tsx` | a Bíblia para LER: livro → capítulo → texto, dentro de uma aba ou de uma gaveta |
| `components/BibleDock.tsx` | a aba colada na borda direita que abre o leitor, na leitura, no editor e no gravador |
| `components/CacheOwner.tsx` | de quem é o cache deste aparelho, e a faxina quando outra conta entra |
| `lib/capture-store.ts` | o áudio guardado no IndexedDB: fragmentos, partes, os PEDAÇOS do envio e a linha de cada gravação |
| `lib/capture-upload.ts` | sessão → transcrição → resumo, com a falha CLASSIFICADA |
| `capture-queue.ts` | a fila que insiste pelas gravações guardadas, de qualquer tela |
| `components/PendingCaptureRunner.tsx` | quem acorda a fila (mora no layout de `(shell)`) |
| `components/PendingCaptures.tsx` + `PendingCaptureNote.tsx` | o bloco e o cartão do que ainda não subiu |
| `query.ts` | a Biblioteca guardada no aparelho: leitura, escrita otimista e o conserto do atraso |
| `folders-query.ts` | as PASTAS guardadas no aparelho, mesmo desenho de `query.ts` |
| `components/FolderGrid.tsx` | a grade de pastas de um nível da Biblioteca: navegar, criar, editar, mover, excluir, soltar |
| `components/FolderDialog.tsx` + `DeleteFolderDialog.tsx` + `MoveToFolderDialog.tsx` | criar/editar, excluir (com o destino do conteúdo) e mover uma sessão só |
| `lib/folder-dnd.ts` | os dois `dataTransfer` de tipo próprio do arrastar-e-soltar (sessão e pasta) |
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

São QUATRO componentes, e a diferença entre eles é a PERGUNTA que cada um
responde, nunca o desenho:

| | de onde parte | o que faz |
|---|---|---|
| `PassageVerses` | uma referência dentro de um bloco | desenha os versículos dela |
| `ChapterDialog` | uma menção tocada no meio do texto | mostra o capítulo e fecha |
| `PassagePicker` (`/summary/new`) | nada | devolve uma REFERÊNCIA para virar bloco |
| `BibleReader` | nada | deixa LER: livro → capítulo → texto, e as setas andam de capítulo |
| `BibleReader` (modo "ask") | uma pergunta de sentido | pede ao Biblo, mostra passagens achadas |

Os dois últimos parecem o mesmo e não são: o seletor tem um terceiro passo (a
faixa de versículos), um rodapé de confirmar e um `onPick`, porque o produto
dele é uma referência; o leitor termina na leitura, e um terceiro passo ali
seria pedir que a pessoa escolha versículos para poder ler o capítulo.

**O `ChapterDialog` ganhou um botão, "Adicionar ao resumo".** Ele é a única
das quatro respostas que aparece dentro de OUTRA prosa — a referência tocada
pode estar no resumo, no estudo ou numa mensagem do Biblo — e por isso não
sabe, sozinho, se há onde escrever a resposta. Quem sabe é
`SummaryInsertContext` (`SummaryInsertProvider`, montado em
`/summary/[id]/page.tsx` envolvendo `SavedSessionView` E `BibloSummaryDock`):
fora dele `useSummaryInsert()` devolve `null` e o botão não desenha. A
escrita é a MESMA de `useWrittenReadingDraft` — `POST /api/sessions/written`
+ `router.refresh()`, com `insertionIndex` respeitando o teto da conclusão —,
extraída de dentro do próprio `BibloSummaryDock` para as duas portas
(o Biblo e este botão) escreverem sobre uma ÚNICA cópia do documento: duas
instâncias do rascunho, cada uma achando que sabe o estado atual dos blocos,
fariam a segunda escrita apagar a primeira.

**O `BibleReader` é uma REGIÃO, não um diálogo**, e é isso que o torna reusável:
ele entra numa aba da bancada do gravador e dentro de uma gaveta na leitura, e
quem quiser um diálogo o põe dentro de um. O contrário não daria — um componente
que carrega o próprio `Dialog` não entra numa aba.

**Quando nenhum livro está aberto, um alternador troca a lista de livros por
uma pergunta ao Biblo** (`POST /api/bible-search`, `COIN_COSTS.bibleSearch`,
gate pela MESMA feature do chat, `biblo_chat` — não uma segunda entrada no
catálogo de planos). O modelo devolve só REFERÊNCIA e uma nota curta, nunca o
texto do versículo: quem resolve cada uma contra a NVI local é
`server/biblo/bible-search.ts`, a mesma técnica de `server/study/anchor.ts`
(passo 3 do estudo) — uma referência que não existir é descartada em
silêncio, sem aviso na tela. "Ir para a passagem" usa o MESMO `book`/`chapter`
que o resto do componente e reaproveita a classe de piscada do
`revealSummaryBlock` (`.summary-block-flash`) para destacar o versículo
depois que o capítulo termina de carregar.

**Quem o abre na leitura, no editor e no gravador é o `BibleDock`, uma aba na
borda DIREITA**, e não mais um disco no canto de baixo: aquele canto já tem
dois donos, o Biblo (permanente, embaixo) e o voltar ao topo (empilhado por
cima quando aparece — ausente só no gravador), e um terceiro faria uma torre
de três botões sobre o texto. A gaveta abre pela direita no desktop e sobe do
rodapé no celular, o mesmo desenho da do Biblo — e some enquanto a conversa
está aberta, porque as duas entram pelo mesmo lado (a regra está em
`globals.css`).

**Abrir e fechar a Bíblia não custa NADA do que estava na tela.** A rolagem
fica (o painel é um portal, a página não desmonta), os realces do `SummaryFind`
ficam (eles são `Range`s sobre o DOM já pintado), e o capítulo aberto também:
o `keepMounted` do `SheetContent` existe para isso — sem ele, fechar o painel
para conferir um parágrafo devolveria a pessoa à lista dos 66 livros.

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
bundle. Hoje é `lexicon_entries` (migração 0063), editado em **/admin/lexicon**,
e cada entrada carrega um cartão: título, descrição e, opcionalmente, imagem. O
arquivo antigo virou só o vocabulário (tipos, limites e o `slugifyTerm`); as
strings foram para a tabela pelo seed daquela migração, **todas como rascunho**.

> **está marcado ⇔ tem cartão ⇔ abre no toque.**

A alternativa era marcar todo nome e deixar metade surda ao toque, que é pior
que as duas pontas: promete e não entrega. O preço, aceito de olhos abertos, é
que no dia da migração nada fica marcado — cada nome acende quando alguém
escreve o cartão dele.

**A marcação é um PONTILHADO, e essa é a terceira forma dela.** Por duas
versões ela teve matiz — azul para personagem, verde para lugar, neutro para
figura citada —, e o argumento era que, valendo "aqui abre um cartão", ela podia
adiantar **qual** cartão. Depois ela virou uma faixa de lavado branco sob as
palavras, sem categoria nenhuma. As duas saíram pelo mesmo motivo, levado até o
fim: a DENSIDADE. Um cartão do léxico cita meia dúzia de nomes num parágrafo, e
ali qualquer tratamento com ÁREA — cor de fundo, faixa, realce — deixa de marcar
palavras e passa a manchar o bloco. A escala desceu de 70% para 22% em três
passadas tentando resolver isso, e cada degrau comprou menos ruído ao preço de
uma marcação que ninguém enxergava; **uma faixa fraca continua sendo uma
faixa.**

Hoje o nome leva **um pontilhado e nada mais**: `underline decoration-dotted`
sobre `--session-mention-ink` a 30%, sem fundo, sem recuo e sem peso — o glifo é
exatamente o que era antes de ser marcado. Ele não tem área, é uma linha de um
pixel no lugar em que um leitor já espera encontrá-la, e o parágrafo volta a ler
como parágrafo.

**É o MESMO vocabulário da referência bíblica**, e isso deixou de ser um
problema para virar a resposta: o argumento de antes era que dois links
idênticos com destinos diferentes seriam uma promessa só para duas coisas, e o
que ele não pesava é que a promessa é a MESMA — "toca e abre" —, com o destino
descoberto no toque, como em qualquer link. O que os separa é a FORÇA: a
referência leva a tinta clara na letra e o pontilhado a 50%, porque ela é um
endereço; o nome fica na tinta do parágrafo, com o pontilhado a 30%, porque ele
é uma palavra do texto que por acaso tem ficha.

A ÁREA DE TOQUE não mudou com isso: ela é a do `<button>`, que é a palavra, e
uma decoração de texto não participa do teste de acerto de nada. O que some é o
fundo; o alvo é o mesmo.

A categoria continua nos dados (`data-mention`) e no rótulo que o leitor de tela
ouve, e continua fora da tinta. `--session-mention-wash` sobreviveu porque o
`EntityCombobox` o usa para outra coisa: pintar o trecho que casou no
autocompletar de autor e local, numa lista curta em que o realce com área é
exatamente o certo.

- **O MARCA-TEXTO é repartido ANTES de tudo**, e a ordem é o que torna as duas
  camadas compatíveis. A marca é da PESSOA (ela arrastou o dedo e disse "isto
  importa"), a anotação é do SISTEMA. Anotando primeiro, as cercas `==` cairiam
  no meio de um segmento já fechado e apareceriam como texto na tela. O efeito
  colateral é uma regra e não um defeito: **uma menção partida ao meio por uma
  marca deixa de ser menção** — marcar "João 3" e deixar o ":16" de fora entrega
  dois pedaços, e nenhum deles é a referência. A sintaxe inteira mora em
  `lib/domain/mark.ts`, e a faixa é a `.highlight-mark`: o mesmo amarelo da frase
  de destaque — um segundo matiz seria uma segunda gramática para a mesma ideia
  —, mas cobrindo a palavra de cima a baixo, e não passando por baixo dela como
  a `.highlight-phrase`. Sobre duas palavras no meio de um parágrafo aquela
  faixa lia como sublinhado gordo, e é por isso que hoje são duas classes.
- **A passada de referência vem ANTES da de nomes, e exige número de
  capítulo.** É o que separa o evangelho do apóstolo: "João 3:16" é consumido
  inteiro pela primeira passada. Um "João" solto no meio da frase continua
  sendo o apóstolo. A lista de LIVROS não é cadastrável — ela é fechada há dois
  mil anos.
- **A ABREVIAÇÃO também é reconhecida**, com capítulo solto ou com versículo:
  "At 2", "Ap 21", "1Tm 4:12", "Fp 2:19-22". O que casa e o que ABRE são
  diferentes: `text` é "1Tm 4:12" e `reference` é "1 Timóteo 4:12", porque o
  lookup resolve nome de livro, não sigla.
- **Duas siglas são exceção, e só duas: `Os` e `Na`.** O risco do capítulo solto
  é uma sigla que também é palavra do português capitalizada em começo de frase,
  e "**Os** 12 discípulos" viraria Oseias 12. Varridas as 66, só o artigo e a
  preposição são isso — `At`, `Am`, `Ed`, `Jd` não são palavras do português, e
  `Ml` só aparece depois do número. Então elas exigem os dois-pontos e as outras
  64 não, o que é cirúrgico em vez de geral. O preço: "Os 3" e "Na 1" ficam
  texto, e quem quiser linká-los escreve "Oseias 3".
- **Uma referência ENCADEADA liga no contexto da anterior.** Em "2Tm 1:5; 3:15",
  o "3:15" herda o livro de "2Tm" e vira "2 Timóteo 3:15"; em "João 3:16, 17"
  o "17" herda livro E capítulo e vira "João 3:17". Quem faz essa máquina de
  estado pequena é `withChains`, em `annotate.ts` — ver o cabeçalho de lá.
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

**O índice do servidor é a primeira PINTURA, não a verdade da sessão.** Ele
desce dentro do HTML (marcação no primeiro quadro, sem requisição), e o
`LexiconProvider` o revalida a cada NAVEGAÇÃO quando ele passa de
`LEXICON_INDEX_STALE_MS` — um número só, compartilhado com o cache do servidor.

Isso conserta um defeito que o desenho original tinha e o documento escondia: o
provedor mora num LAYOUT, e o App Router reusa o payload de um layout em toda
navegação entre telas que o compartilham. A lista ficava congelada **até um
F5**, e a promessa de "um minuto no máximo entre publicar e acender" era falsa.
O sintoma foi publicar um nome, tocar em "Salvar" no editor e não ver
marcação nenhuma.

E a query leva `meta: { persist: false }`: o índice já vem no HTML, então
guardá-lo no disco não economiza espera e, ao restaurar, o valor do disco
venceria o que o servidor acabou de mandar — recarregar a página passaria a
devolver a lista de ontem.

Juntá-las faria cada abertura de resumo baixar 300 descrições e 300 URLs de
imagem para mostrar zero delas. O cartão entra por `dynamic(ssr:false)`, igual
ao `ChapterDialog`, e é cacheado por sessão no React Query.

**O cartão é repartido em PARÁGRAFOS por `toParagraphs`**
(`lib/domain/paragraphs.ts`), e não por um `split` próprio. Ele exigia linha EM
BRANCO entre as ideias (`
{2,}`), então quem escreveu a descrição no painel
apertando Enter uma vez só via o cartão inteiro grudado num bloco de cinza, sem
nada na tela explicando por quê. E a descrição digitada de um fôlego continuava
parede mesmo com o corte certo: quem a reparte em fronteira de frase é o
`splitWall`, o MESMO que já põe respiro na resposta do Biblo — ele saiu de
dentro do `biblo/answer.ts` (que é `server-only`) quando o segundo consumidor
apareceu, porque dois limiares para a mesma pergunta divergem no primeiro
ajuste.

**A descrição é escrita à MÃO, não gerada.** Não há modelo nenhum produzindo o
texto do cartão; quem escreve é uma pessoa em `/admin/lexicon`, e é por isso que
a instrução de "uma ideia por parágrafo" mora no campo daquele formulário. O
`splitWall` é a rede embaixo de quem esquece — uma quebra escolhida por quem
escreveu cai sempre num lugar melhor que uma calculada por contagem de
caracteres.

**O texto do cartão PASSA pelo `RichText`, e o cartão navega dentro de si
mesmo.** Ele não passava, e o argumento era a circularidade: um nome dentro do
cartão abriria outro cartão por cima, sem caminho de volta. O problema era real
e a conclusão estava errada — um cartão de personagem cita meia dúzia de nomes
e uma dúzia de referências, e todas ficavam mortas no meio da prosa. A saída é
uma TRILHA: a menção troca o conteúdo do mesmo diálogo (`LexiconNav`) e ele
ganha um voltar. O próprio nome não é marcado, porque seria um caminho para
onde a pessoa já está. A referência bíblica continua abrindo o `ChapterDialog`
por cima, e ali empilhar é aceitável: ele é uma FOLHA, mostra o texto e fecha.

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

Dentro de `.tone-study` sobra `--session-mention-ink`: o `--session-mention-wash`
era reapontado ali para a faixa não sumir na superfície meio degrau mais clara
do estudo, e com a faixa fora do produto aquele override deixou de governar
qualquer pixel.

## A gravação guardada, e quem insiste por ela

Guardar o áudio nunca bastou, e o custo dessa diferença foi uma pregação de
quase uma hora dada por perdida. Os fragmentos SEMPRE estiveram no IndexedDB
durante a captura; o que faltava é que a gravação guardada só existia DENTRO da
tela de gravação — era lá que a falha aparecia, lá que ficava o botão de tentar
de novo, e sair daquela tela era o gesto que sumia com o áudio do app inteiro.
Ele continuava no aparelho, intacto, e nenhuma tela voltava a mencioná-lo.
**Guardar sem devolver é a mesma coisa que perder, com o agravante de não
parecer um defeito.**

O conserto tem três partes, e nenhuma delas mora numa tela:

- **`lib/capture-store.ts`** é o disco. A linha de uma gravação nasce no
  PRIMEIRO SEGUNDO, e não no stop: nascendo no stop, a aba morta no minuto 40
  deixava 20 fragmentos sem índice nenhum apontando para eles, invisíveis para o
  resgate e para a faxina por idade. `closed` diz se o `stop()` chegou ao fim e
  `heartbeatAt` é a hora do último fragmento, que é como uma segunda aba
  distingue "abandonada" de "gravando agora".
- **`lib/capture-upload.ts`** é o caminho até o resumo, e o produto dele é a
  TAXONOMIA da falha. "Não consegui" não é resposta: a pessoa precisa saber se
  espera a rede voltar (`offline`), se espera o Scriba (`server`), se recarrega
  moedas (`balance`) ou se baixa o arquivo porque nada disso vai resolver
  (`fatal`). É a classificação que decide se a fila retenta sozinha, e a frase
  fica GRAVADA na linha da gravação para a Biblioteca escrevê-la no cartão.
- **`capture-queue.ts`** é quem insiste, acordada pelo `PendingCaptureRunner` no
  layout de `(shell)`. Quatro sinais, porque esperar por um só é escolher o dia
  em que nada acontece: a abertura do app, o evento `online`, a volta ao app e
  um relógio de 20s que só pergunta se já venceu a espera daquela gravação (ela
  cresce de 15s a 10min a cada falha).

**O TAMANHO do POST é conta do cliente, e não um aviso na tela.** O gravador já
corta a gravação em partes de ~7 MB enquanto grava, mas o corte educado (o que
espera um silêncio) depende de um `requestAnimationFrame`, e o navegador PARA o
`requestAnimationFrame` com a aba em segundo plano — que é exatamente o que quem
apoia o celular no banco faz durante a pregação. A pregação de 40 minutos saía
numa parte única, recusada com 413 no fim, e a pessoa lia "baixe o arquivo e nos
avise" depois de ter gravado tudo.

São duas defesas, e elas são independentes de propósito:

- **No gravador**, `PART_HARD_MAX_BYTES` corta a parte de dentro do
  `ondataavailable`, que é evento do `MediaRecorder` e continua chegando com a
  aba escondida. Conserta a causa, e só vale para gravação nova.
- **No envio**, `loadChunks` recorta a parte que não couber, na hora de enviar,
  quando o tamanho já é fato e não previsão. Conserta também o que já está
  guardado no aparelho. O corte é possível porque o PRIMEIRO fragmento de uma
  parte é o que traz o cabeçalho do contêiner: prefixá-lo a qualquer corrida de
  fragmentos devolve um arquivo que decodifica, sem reencodar nada no navegador.
  Um 413 que ainda assim volte parte o pedaço em dois e continua (`splitChunk`),
  sem custo — a rota recusa pelo tamanho antes de falar com o provedor.

Daí `fatal` não falar mais de tamanho, e o aviso "ficou grande demais, baixe o
arquivo e nos avise" ter saído do produto.

**O áudio é apagado numa LINHA SÓ do app inteiro**, no `run()` da fila, depois
de `ok: true`. Antes de o resumo existir, nada apaga nada.

**A fila nunca sobe a gravação que está sendo gravada**, e a guarda é dupla de
propósito: `capturing` é o id vivo nesta aba, e o `heartbeatAt` cobre a aba
vizinha, que esta não enxerga. Ela também não trabalha durante uma gravação —
subir 7 MB enquanto o microfone está aberto disputa rede e CPU com a única coisa
da tela que não pode falhar.

**Retentar é seguro porque moeda não é cobrada nessa pipeline.** O débito sai do
navegador por minuto GRAVADO (`useCoinTick`); `transcribe` e `final-summary` só
exigem saldo positivo. E a sessão é criada uma vez porque o ID é sorteado no
APARELHO e gravado na linha da gravação desde o primeiro segundo: toda
tentativa manda o mesmo, e `POST /api/sessions` com um id que já é seu devolve
o mesmo id em vez de criar outra linha. Por isso o envio chama aquela rota
SEMPRE, e não só quando falta um id — ele não precisa saber se a linha já
nasceu durante a pregação (ver `ensureSession` no `AudioStudio`).

**A Biblioteca mostra o que está pendente** (`PendingCaptures`), num bloco
próprio acima dos meses, fora da busca. O cartão não é um `PostItNote`: aquele é
um `<a>` em volta de tudo justamente por não ter botão dentro, e este é três
botões e nenhum destino. Ele some sozinho, quando o resumo existe ou quando a
pessoa apaga o áudio, e nunca antes disso.

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
  reinterpreta `example` — no resumo é "Exemplo", no estudo é
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
telas que têm um `SummaryPayload`: `/summary/:id` e `/summary/:id/edit`.

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
- **QUATRO coisas do texto da resposta são garantidas no servidor, não pedidas**
  (`biblo/answer.ts`): a parede de parágrafo é quebrada em fronteira de frase
  (`breathe`), o "quer que eu escreva isso?" do fim é removido
  (`dropTrailingOffer`), a oferta é virada para a voz de quem pergunta
  (`asUserVoice`) — o chip da oferta é ENVIADO como se a pessoa o tivesse
  digitado, e uma pergunta ali deixa de fazer sentido no instante do toque —, e
  o TRAVESSÃO é trocado por vírgula (`undash`), em tudo o que o modelo escreve:
  resposta, chips, oferta, rótulo e blocos das ferramentas. A proibição do "—"
  está no prompt desde sempre e o `gpt-4.1-mini` a respeitava; o `gpt-5-mini`
  põe dois ou três por resposta de análise, e uma regra que vale SEMPRE não se
  pede a quem pode esquecer. Três exceções, todas no código: entre dígitos ele
  é faixa de versículos e vira hífen, no começo da linha é marcador de lista e
  some, e depois de pontuação some em vez de virar uma segunda vírgula.
- **O modelo é `gpt-5-mini` com `reasoningEffort: "low"`**, e a troca (de
  `gpt-4.1-mini`) foi por PROFUNDIDADE: o anterior respondia bem o que é
  recuperação ("quem foi Paulo?") e raso tudo o que pede um passo de
  pensamento, que é a pergunta de quem já passou da primeira semana no app.
  Junto veio a régua de tamanho no prompt (fato em um ou dois parágrafos,
  análise em quatro a seis que ANDAM) e os tetos de saída dobrados, porque na
  família de raciocínio o `max_completion_tokens` inclui o pensamento. O preço
  disso está medido em `COIN_COSTS.bibloMessage`: margem de 69 a 79% na
  conversa, 59% no `criarDocumento` da Biblioteca. **E a resposta passou de ~4s
  para ~9s**, o que reabre a pergunta do streaming — medido, o tempo é o prompt
  de ~4.800 tokens na entrada, não o raciocínio: em esforço `minimal`, com zero
  token de pensamento, ela ainda leva 9s.
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
- **Na BIBLIOTECA ele tem FERRAMENTAS, e é a única superfície que as tem.**
  Ali não há texto na tela, então não há `suggestion` possível: no lugar dela
  vêm `criarDocumento`, `editarTitulo` e `adicionarBlocoDeConteudo`, pedidas ao
  modelo por um bloco de prompt que só entra quando `surface === "home"` e
  executadas no CLIENTE, por `/api/sessions/written` — a mesma rota do editor,
  que confere dono e passa pela RLS. Elas são um campo do contrato e não
  `tool_calls`: a resposta já é um JSON com rede em todo campo, e um segundo
  canal de saída seria um segundo caminho de erro. A conversa se ancora numa
  sessão VAZIA que nunca é encerrada (e por isso nunca aparece no acervo); o
  documento que ela cria é outra sessão. Ver `docs/biblo-implementacao.md` §15.
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
- **O botão da despedida abre o `BillingDialog`, não `/subscribe`.** É o mesmo
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

## Pastas

`folders` (migrações 0068 e 0069) e `sessions.folder_id`, nullable — uma sessão
vive em NO MÁXIMO uma pasta, e sem pasta continua sendo o estado padrão (a
"raiz"). `GET/POST /api/folders` e `PATCH/DELETE /api/folders/:id`, mais um
`folderId` a mais no `PATCH /api/sessions/:id` de sempre.

**A pasta que uma sessão aponta precisa ser DO MESMO DONO, e isso é RLS, não
a rota.** `sessions_insert_own`/`sessions_update_own` (migração 0068) levam um
`exists (select 1 from folders where id = folder_id and user_id = auth.uid())`
no `with check` — a mesma classe de furo fechada em `session_deepenings` na
0040 (ver `supabase/AGENTS.md`), aqui prevenida em vez de corrigida depois. A
rota confere de novo (`getFolder` antes do PATCH) só para devolver
`folder_not_found` em vez do erro cru do Postgres.

### Três níveis, e o teto é do BANCO

`folders.parent_id` (migração 0069), com profundidade máxima 3 garantida pelo
gatilho `folders_tree` — não por um `if` no TypeScript, que valeria só para o
caminho que alguém lembrou de proteger. Ele recusa três coisas: passar de três
níveis (contando a corrente de pais **e** a altura da subárvore, porque mover
uma pasta move as filhas com ela), ciclo, e pai de outro dono.
`MAX_FOLDER_DEPTH` em `lib/domain/folder.ts` é o mesmo número, e serve só para
a tela esconder "Nova pasta" no último nível em vez de oferecer um gesto que
vai falhar.

**Por que TRÊS.** Uma árvore sem limite pede uma tela que navegue árvore
(recolher, expandir, arrastar para dentro de um nó fechado), e o produto é um
mural de cartões. Com três, o caminho inteiro cabe numa migalha de pão de uma
linha ("Biblioteca › 2026 › Romanos"), que é o que a tela já desenha.

**O nome é único DENTRO DA MÃE**, não no acervo (o índice da 0069 troca o da
0068). "Romanos" em 2025 e "Romanos" em 2026 são duas pastas legítimas. O
`coalesce(parent_id, <uuid nil>)` do índice existe porque dois `null` são
valores DISTINTOS num índice único, e sem ele as pastas de raiz deixariam de
ser comparadas entre si.

**A policy de `folders` usa `parent_id in (select p.id …)`, e NÃO
`exists (… where p.id = parent_id)`.** A forma da 0068 funciona para
`sessions` porque a subconsulta lê OUTRA tabela; aqui ela lê a MESMA, e
`parent_id` sem qualificação é resolvido no escopo mais interno — vira
`p.parent_id`, a condição fica `p.id = p.parent_id`, e a policy recusa toda
subpasta, inclusive as legítimas. Foi medido em dev antes de a migração sair
de lá. O cabeçalho da 0069 tem o parágrafo inteiro.

**Apagar uma pasta apaga as SUBPASTAS, sempre.** `parent_id` é
`on delete cascade`, e não há "apagar esta e manter as filhas" — uma subpasta
sem mãe não teria por onde ser alcançada na tela. Por isso o
`DeleteFolderDialog` AVISA quantas somem, em vez de oferecer uma terceira
opção.

**Apagar uma pasta não apaga o CONTEÚDO por padrão.** `folder_id` é
`on delete set null`: apagar a linha da pasta já solta as sessões para a raiz
sozinho, sem UPDATE nenhum, e vale igual para as que estavam nas subpastas.
"Excluir também as sessões" é o caminho OPOSTO, e por isso pede a escolha
explícita — apagar sessão é raro e caro de desfazer, mover para a raiz não
perde nada. **O alcance dessa opção é a SUBÁRVORE**, não a pasta clicada: um
`.eq("folder_id", id)` deixaria intacto justamente o conteúdo das subpastas
que o mesmo gesto acabou de apagar.

### A tela: cartões, não pastilhas

`FolderGrid` desenha as pastas de UM nível como cartões numa grade, sob um
`<h2>` "Pastas" que é o mesmo cabeçalho de "Este mês". Ela substituiu o
`FolderChips`, uma fileira de pastilhas arredondadas acima dos meses, e o
problema dela não era feiura, era PERTENCIMENTO: a Biblioteca é uma sequência
de seções com título e cartões embaixo, e a fileira era a única coisa da tela
que não era nem título nem cartão. Cartão e cabeçalho fazem de pastas uma
seção da lista em vez de uma barra de ferramentas antes dela — e o cartão tem
onde dizer quantos resumos e quantas subpastas há dentro.

**A seção fica ABAIXO do seletor de vista**, não no topo da página. Lá em cima,
a primeira coisa da primeira tela do app passava a ser a organização do acervo,
e não o acervo. O seletor não governa esta seção (uma pasta não tem post-it nem
linha) e é a única que ele não alcança: ele é sobre a vista das SESSÕES.

**O ÍCONE de pasta é o que torna o cartão legível**, e a cor da pasta é a TINTA
dele (`FOLDER_ICON_INK`), não um segundo objeto na linha. Um pontinho colorido
ao lado de um nome diz "isto tem uma cor", não "isto é uma pasta".

**Dentro de uma pasta a página ganha TÍTULO** (`LibraryBrowser`), com a migalha
de pão acima. Ele existe porque o nome da tela mora na barra do topo, e lá ele
é "Biblioteca" em toda navegação — a barra é do LAYOUT do segmento e nem
poderia saber qual pasta está aberta, que vem de um `searchParams` lido só pela
página. **A migalha NAVEGA e o título INFORMA**: o último degrau da migalha não
é botão justamente porque ele é o título logo abaixo. Na raiz não há título, a
barra já o diz.

**Pasta NÃO tem escolha de cor**, e o `FolderDialog` é um campo de texto e
mais nada. Ele teve um seletor de quatro faces (as do post-it) e ele saiu: a
pasta não mora num mural de cores sorteadas, mora numa grade de cartões
cinzas iguais, onde a cor entrava só como a tinta de um ícone de 20px — quatro
opções compravam um enfeite e cobravam um passo, no único diálogo do produto
que existe para receber uma palavra e sair da frente.

Duas consequências:

- **`folders.color` continua no banco** (0068) e a API continua aceitando o
  campo, opcional. Nada na tela o manda; toda pasta nova nasce `null` e
  `FOLDER_ICON_INK[color ?? "mist"]` pinta o ícone. É o seam por onde a cor
  volta se um dia ela tiver trabalho a fazer, e não vale uma migração para
  derrubar.
- **O caso do `slate` deixou de existir por não ter mais onde aparecer.** Ele
  é `#2F3035`, exatamente `--v2-card` e `bg-popover`, e como pastilha de 28px
  dentro do diálogo lia como um buraco em vez de uma opção. A primeira
  correção foi um fio de borda (`ring-1 ring-white/20`, o recurso que o
  post-it escuro usa); a correção da correção foi tirar o seletor.
- **As quatro entradas de `FOLDER_ICON_INK` apontam para `slate-mute`**, e o
  ícone sai da mesma tinta qualquer que seja a linha gravada. O ícone pousa no
  cartão do APP, não no post-it, e a paleta do post-it não serve a essa
  superfície nos dois temas: a superfície de uma face é quase a cor do cartão
  no claro, e o `-mute` das faces pastel é tinta escura, calibrada sobre papel
  claro, que sobre o cartão escuro dá 1,75:1. O `slate` é a única face cuja
  tinta apagada foi feita para este lugar nos dois temas. O cabeçalho da
  constante tem as duas direções do erro; quando a cor de pasta voltar a ter
  trabalho, o que ela pede é um token próprio, não o empréstimo de uma face do
  mural.

### Mover: duas portas, nenhuma no cartão da sessão

**Não existe um menu de três pontinhos no CARTÃO da Biblioteca, de propósito**
(ver o cabeçalho de `PostItNote`), e "mover para pasta" não é exceção:

- **Arrastar** (`lib/folder-dnd.ts`), no desktop. São DOIS MIME próprios, e
  serem dois é o que permite ao mesmo alvo fazer coisas diferentes com cada
  carga: `application/x-scriba-session-id` move a SESSÃO,
  `application/x-scriba-folder-id` move a PASTA para dentro da outra. Tipos
  inventados e não o `text/plain` que um `<a>` carregaria sozinho, para que
  soltar um cartão fora de uma pasta não vire "abrir link" em silêncio.
- **`MoveToFolderDialog`**, aberto pelo item "Mover para pasta" do
  `SessionMenu` de uma sessão já aberta (`/summary/:id`), e "Mover para a
  raiz" no "⋯" de uma subpasta. É a via de TECLADO e de CELULAR que o
  arrastar não cobre — o requisito de acessibilidade do sistema de pastas não
  é um segundo desenho do arrastar, são estes dois.

**No diálogo a árvore aparece INTEIRA, com recuo por nível**
(`flattenFolderTree`), ao contrário da grade, que mostra um nível e navega para
dentro. São duas perguntas diferentes: na grade a pessoa está navegando e o
caminho está na migalha; no diálogo ela está escolhendo um destino, e um
destino que exige três toques para ser visto é um destino que ela não acha.

**A pasta em si tem UM menu de três pontinhos** (`FolderCardMenu`, dentro de
`FolderGrid`), e ali ele é o desenho certo: o "⋯" e o botão que navega são
dois BOTÕES IRMÃOS, nunca um dentro do outro — a régua que tirou o menu do
cartão de sessão (botão dentro de `<a>` é HTML inválido) continua valendo, só
que aqui não há link nenhum por baixo para o botão invadir.

**A tela de leitura mostra o CAMINHO, não a última pasta.** A pastilha do
cabeçalho do `SavedSessionView` escreve "2026 › Romanos": com três níveis,
"Romanos" sozinho não diz qual dos dois é, e a Biblioteca permite os dois nomes
justamente porque cada um mora numa mãe diferente.

## As listas: busca e filtros

**A Biblioteca não tem mais busca PRÓPRIA.** Ela teve uma barra atrás da lupa
do cabeçalho (`CollectionSearch` + `SearchScope`, aberta por `?busca=1`), e
essa barra saiu — a busca virou GLOBAL
(`(app)/(shell)/components/GlobalSearchDialog.tsx`), um diálogo por cima de
QUALQUER tela do app, aberto por Ctrl+K, pelo `SearchTrigger` do desktop ou
pelo botão de busca da `MobileActionBar` **da Biblioteca** (no `/summary` e no
`/summary/new` aquele botão procura dentro do texto aberto, ver
`src/app/AGENTS.md`). `LibraryBrowser` voltou a mostrar
sempre o acervo inteiro (pastas, pendentes, meses), sem estado de "busca
aberta" nenhum; o diálogo lê a MESMA `useLibrary()`, sem consulta nova, e
reaproveita o mesmo motor (`src/lib/search.ts`) e a mesma metade servidor
(`useContentSearch`, abaixo).

**`/studies` continua com a barra ANTIGA** (`CollectionSearch` + `SearchScope`
+ `SearchToggle`, atrás da lupa do cabeçalho, fechando limpa os filtros): os
Estudos estão saindo do produto (ver `src/app/AGENTS.md`) e não valeram a
migração para o diálogo global. `StudiesBrowser` é hoje o único consumidor de
`CollectionSearch`. **O passo de busca do tour dos Estudos aponta para a LUPA**
— ancorado na barra, ele seria descartado em silêncio porque ela ainda não
existe quando o tour abre. O passo irmão da Biblioteca aponta para o botão que
abre o diálogo global, não para um resultado dentro dele.

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
