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
transcrição (some "Ler transcrição", "Reprocessar", "Algo está errado" e o
"Gerar estudo"). Ver `src/app/AGENTS.md`.

Esta pasta já foi o dobro do tamanho: ela continha três telas de captura, os
três pipelines de enriquecimento ao vivo, o feed que eles alimentavam e a fila
de chunks que os movia. Nada disso existe — o produto é gravar, resumir e, se a
pessoa quiser, aprofundar.

## Anatomia

| Onde | O que |
|---|---|
| `components/SavedSessionView.tsx` | a tela de uma sessão salva: cabeçalho editável, resumo, estudo, menu |
| `components/SummaryView.tsx` + `BlockRenderer.tsx` | os blocos do resumo |
| `components/StudyBlockRenderer.tsx` | os blocos a MAIS que o estudo tem |
| `components/PostItNote.tsx` | a casca do post-it dos dois murais: cor, cartão clicável, anatomia |
| `components/LibraryNote.tsx` | o post-it de uma sessão na Biblioteca (autor, título, data) |
| `components/StudyNote.tsx` | o post-it de um estudo, a mesma casca com outro recheio |
| `components/CollectionSearch.tsx` + `src/lib/search.ts` | a barra e o motor das duas listas |
| `components/YoutubeUrlForm.tsx` + `YoutubeImport.tsx` | colar o link, e esperar a importação |
| `components/DeepenButton.tsx` + `DeepeningMenu.tsx` | gerar e reprocessar o estudo |
| `components/PassageVerses.tsx` + `RichText.tsx` | texto bíblico e menções dentro do parágrafo |
| `hooks/useCoinTick.ts` | o débito por minuto, durante a gravação |
| `recording-store.ts` | um booleano: há gravação viva nesta aba? |
| `server/final-summary.ts` | a chamada única que vira o resumo |
| `server/study/` | as cinco etapas do estudo (ver `src/lib/AGENTS.md`) |
| `server/youtube/` | oEmbed, legenda pela Supadata e a limpeza do título |
| `server/prompts/` | todo system prompt do assunto |
| `lib/transcription/` | sanitize e o veredito de qualidade de uma parte |

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

`RichText` é o que o resumo e o estudo usam para desenhar PROSA. Ele passa o
texto por `annotateText` (`src/lib/domain/annotate.ts`) e marca três coisas:
referência bíblica, personagem/lugar e figura citada.

**É regex sobre um léxico curado (`src/lib/domain/lexicon.ts`), não uma etapa de
IA.** Marcar entidade com LLM seria mais uma chamada por sessão, com custo,
latência e a chance de o modelo marcar o que não está no texto, para um
problema que um autômato resolve igual toda vez.

- **A passada de referência vem ANTES da de nomes, e exige número de
  capítulo.** É o que separa o evangelho do apóstolo: "João 3:16" é consumido
  inteiro pela primeira passada. Um "João" solto no meio da frase continua
  sendo o apóstolo.
- **O casamento é exato**, acento e maiúscula inclusive. A entrada aqui é texto
  escrito por um modelo, e tolerância que não é necessária só compra falso
  positivo.
- **Só a referência é CLICÁVEL, e por isso só ela é colorida.** Nome próprio
  ganha a faixa de marca-texto (`--session-mention-wash`) e nada mais: não há
  para onde ir a partir dele. Três cores de marcação num parágrafo é uma página
  de arco-íris, e o realce só funciona enquanto for exceção.
- **Nunca aplique `RichText` em texto bíblico** (`bibleQuote`) nem em frase de
  efeito (`highlight`). No primeiro todo nome é personagem e a marcação
  pintaria o bloco inteiro; a segunda já carrega a faixa amarela.

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
