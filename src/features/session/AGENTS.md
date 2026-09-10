# src/features/session: a gravação

O coração do produto. Esta pasta contém o gravador, os pipelines ao vivo, o
feed e as telas de sessão salva.

**Antes de mudar ritmo, cadência ou threshold:** os números estão todos em
`config.ts`, cada um com o raciocínio ao lado. Leia o comentário da constante
antes de trocar o valor, quase todos foram calibrados contra sessões reais.

## Anatomia

```
components/    toda peça de UI da gravação e da sessão salva
hooks/         comportamento com estado; um hook por preocupação
lib/           helpers puros: audio, text, chunks, api, haptics, nativeBridge
config.ts      TODAS as constantes de ritmo. Nenhuma número mágico fora daqui
store.ts       zustand: chunks, feedItems, dripQueue, contadores, guard ctx
types.ts       ChunkRow, FinalAudio, TranscriptState, VerseFetchState
```

As páginas em `app/(app)/recording/[id]/*` são **orquestração pura**: elas
resolvem a sessão, conferem o modo e montam um dos três componentes de
gravação. Peça de UI nova vai em `components/`, helper puro em `lib/`,
comportamento com estado reusável em `hooks/`.

Os três componentes de topo, um por modo: `RecordingLive`,
`RecordingAudioOnly`, `RecordingTranscribe`.

**E `YoutubeImport`, que não é um deles.** O modo `youtube` mora na mesma casa
(`/recording/:id/youtube`) e cumpre o mesmo papel no fluxo, é para onde o
diálogo empurra, e de onde a sessão sai pronta, mas NADA desta pasta se
aplica a ele: sem recorder, sem chunks, sem VAD, sem IndexedDB, sem `store.ts`,
sem cronômetro e sem cobrança por minuto. Ele dispara `POST /api/youtube/import`
ao montar e espera. `isCaptureMode(mode)` (`lib/domain/session.ts`) é a pergunta
a fazer antes de assumir que um modo tem microfone, não teste `!== "youtube"`
solto, que erra em silêncio no dia em que entrar uma segunda origem importada.

Duas decisões dele que parecem detalhe:

- **A tela de espera não tem barra de progresso**, e sim frases que avançam por
  tempo. Não há progresso real para medir (a rota é uma requisição só, e SSE é
  coisa que o produto deliberadamente não tem); barra inventada que trava em
  90% é pior que texto honesto.
- **O link NÃO é colado no `NewRecordingDialog`.** Ele já foi: um card de modo
  com um `<input>` embutido, no meio de uma lista de irmãos do mesmo tamanho.
  Duas coisas quebraram, e as duas são o motivo de `/importar` existir como
  página, o card tinha de crescer no meio da fileira, e o rodapé do diálogo
  precisava mentir sobre a unidade do preço ("/min" num modo que cobra por
  vídeo). Escolher COMO capturar e escolher QUAL vídeo são duas perguntas.
  O diálogo itera sobre `CAPTURE_MODES`, não sobre `SESSION_MODES`, e é o tipo
  que impede o modo importado de voltar para lá por distração.
- **Ficar fora do diálogo cobra um preço, e `YoutubeTipCard` é quem o paga.**
  A porta da importação é um botão secundário em `/recordings`; quem vive no
  `/feed` pode nunca esbarrar nela. O card ensina que ela existe, no `/feed`,
  **no máximo três vezes**, espaçadas por quatro dias, e nunca para quem já
  importou algum vídeo (esse gate é do SERVIDOR: `sessions.some(mode ===
  "youtube")`, decidido em `app/(app)/feed/page.tsx`). Um aviso de descoberta
  que aparece sempre vira mobília, e o dia em que ele disser outra coisa
  também não será lido. A contagem é `localStorage`, como a soneca do
  `InviteFriendCard`, e degrada para "aparece de novo" quando não há storage.
- **A Biblioteca VAZIA precisa da sua própria porta.** O cabeçalho onde o botão
  de importar mora não é renderizado quando não há sessão nenhuma, e sem uma
  segunda porta `/importar` some do app inteiro justamente para quem ainda não
  gravou nada, "Gravar" está no header e na barra inferior, importar não estaria
  em lugar algum. Daí o slot `action` do `SessionsEmptyState` e o `fullLabel` do
  `ImportYoutubeButton`, dentro de um card que ocupa a tela, "Importar" sozinho
  não diz importar o quê.

## O caminho de um chunk

1. `createRecorder` (`lib/recorder.ts`) fatia o áudio por VAD entre
   `RECORDER_MIN_CHUNK_MS` (15s) e `RECORDER_MAX_CHUNK_MS` (20s). Chunk menor
   reduz o atraso até o primeiro card; grande demais faz uma frase longa
   esperar.
2. `isSilentBlob` descarta o que é silêncio antes de gastar uma chamada. Ele
   decodifica num **`OfflineAudioContext` único, reusado pela sessão inteira**.
   Antes era um `new AudioContext()` por chunk, fechado sem `await`, e o do
   ÚLTIMO chunk nascia no meio do teardown do stop, abrindo uma unidade de
   áudio nativa no exato instante em que as tracks eram paradas e a shell RN
   desativava a `AVAudioSession`. Contexto offline renderiza para memória: não
   toca no hardware, não conta para o limite de contextos do Chrome.
3. `useTranscribeQueue` persiste o chunk no IndexedDB (`lib/chunk-store.ts`) e
   sobe para `/api/transcribe`, com backoff `[1s, 3s, 10s, 30s, 60s]` cujo
   último valor se repete para sempre. **Não desistimos sozinhos**, parar é
   decisão do usuário, e o stop dispara um drain com timeout suave.
4. O chunk volta com texto e um veredito de qualidade. Ver "Qualidade" abaixo.
5. Os pipelines observam a transcrição acumulada e decidem se chamam.

**A persistência em IndexedDB existe para o caso em que a aba morre.** Um
chunk que não subiu vira buraco na transcrição; guardado, a fila o retoma
depois, inclusive num reload da mesma URL de sessão (recuperação silenciosa
de órfãos, com TTL de 24h para não acumular). Tudo degrada em silêncio onde
IndexedDB não existe: o pipeline em memória continua, só sem recuperação.

`startedAtRef` é semeado por `start()` **antes** de virar `setRunning(true)`,
para que `useElapsedTimer` veja uma origem válida no primeiro render.
Preserve essa ordem.

**Só existe UM MediaRecorder, o dos chunks.** Havia um segundo gravando a
sessão inteira em paralelo, com um `onFinalAudio` que nenhum chamador jamais
registrou: o áudio era codificado duas vezes, acumulado num array do início ao
fim, e no stop virava um `new Blob` contíguo (~1 MB/min, então ~50 MB num
sermão de 50 min) só para ser descartado. Numa WebView React Native, onde o
heap é bem menor que o de uma aba de Chrome, esse pico caía exatamente no
instante do "parar". Se um dia quisermos guardar o áudio, ele tem de ir para o
IndexedDB incrementalmente, como os chunks, nunca se acumular em memória.

**Os três modos registram `rec.onError`** (`lib/recorderErrors.ts`). Por muito
tempo ninguém registrava, e o recorder emitia falha de encoder para um callback
nulo: um MediaRecorder morto no meio da pregação é indistinguível, na tela, de
um trecho em silêncio, o timer segue correndo e nenhum chunk chega. O erro não
derruba a gravação (`chunk` e `vad` são recuperáveis pelo hard-cut timer); ele
vai para o logger E para a shell nativa, que é o único caminho até um crash
report em produção.

## Os três pipelines ao vivo

Cada um é um hook, coordenado por flags de voo no store (`bibleInFlight`,
`insightsInFlight`, `finalizing`). **Todos são ADITIVOS**, só acrescentam a
`feedItems`; nada é reescrito ou reordenado durante a gravação. O dedup por
`feedItemDedupKey` protege contra itens equivalentes chegando de chamadas
sobrepostas.

### `useBiblePipeline` → `/api/bible` (rápido, por chunk)

Único emissor de `citedVerse`. Gate de duas camadas antes de gastar a chamada:

1. **`hasBibleMention`** (`lib/bible/detect.ts`), regex barato: livros com
   acento opcional e ordinal em número, romano ou extenso; dispara também em
   `capítulo` / `versículo` / `verso` mesmo sem livro no trecho. Sem menção,
   sai.
2. **`scoreBibleGuard`** (`lib/bible/guard.ts`), soma sinais ponderados e só
   chama se `score >= BIBLE_GUARD_THRESHOLD` (4):

   | Sinal | Peso |
   |---|---|
   | `bookWithNumber` ("Salmo 23") | +4 |
   | `readingVerbNear` ("abram em…") | +3 |
   | `continuationHit` ("no verso seguinte") | +3 |
   | `congregationalCue` | +3 |
   | `triggerWithNumber` | +2 |
   | `verseProgression` | +2 |
   | `duplicateEmit` | −5 |
   | `demonstrativeAnaphora` ("esse texto aí") | −4 |
   | `bookRepeatNoNumber` | −3 |
   | `pastTenseNear` ("acabei de ler") | −2 |

   Cada sinal contribui no máximo uma vez por chamada. O threshold 4 equivale
   a exigir um sinal forte, ou dois médios que se somem.

O contexto do guard vem do store: `currentReading` (livro/capítulo/verso mais
recente resolvido, TTL de 5min, é o que faz "versículo 10" sozinho valer
`continuationHit`) e `lastBibleEmit` (cooldown de 90s, cujo `duplicateEmit`
de −5 mata sozinho um `bookWithNumber`, impedindo re-disparo enquanto o
pregador segue discutindo a mesma passagem). Os dois são atualizados após um
retorno com `citedVerse` parseável. Skips por camada contam separado em
`bibleGateSkipped` e `bibleGuardSkipped`.

### `useInsightsPipeline` → `/api/insights` (lento, por contagem de chunks)

Emite os outros cinco tipos: `speakerHighlight`, `speakerCitation`,
`relatedVerse`, `context`, `suggestedQuote`. Dispara a cada
`INSIGHTS_CHUNK_INTERVAL` (6) chunks OK, contagem de chunks, não tempo. O
PRIMEIRO disparo da sessão usa `INSIGHTS_FIRST_FIRE_CHUNK` (1): sem esse
warmup, o primeiro card só apareceria depois de 2min, o que lê como "não está
funcionando".

Dois gates de economia: `INSIGHTS_MIN_TAIL_DELTA_CHARS` (tick em quase
silêncio vira no-op) e `INSIGHTS_QUEUE_BACKPRESSURE` (se a fila de drip já tem
2 pendentes, pula, enquanto os cards antigos não aparecem, gerar mais só
gasta token e produz insight fora do momento).

`insightsInFlight` NÃO está nas deps do effect de propósito, re-disparar na
mudança de voo causaria re-runs desnecessários. O estado é lido por
`getState()` dentro do effect.

### `useEchoPipeline` → `/api/sermon-echo` (por sequência)

Injeta uma frase literal (`speakerEcho`) quando o feed acumula N cards de IA
seguidos. O N é sorteado em `[ECHO_STREAK_MIN, ECHO_STREAK_MAX]` e
re-sorteado a cada revelação, para o ritmo não ficar metronômico.

### Não junte `bible` e `insights`

Elas são rotas separadas porque os perfis de custo e latência são
fundamentalmente diferentes. `bible` precisa aparecer na tela no momento em
que o pregador começa a ler (baixa latência, barato porque é gated por regex);
`insights` precisa de contexto acumulado e pode esperar (latência maior,
tolerada porque a cadência lenta limita o custo). `citedVerse` é exclusivo de
`/api/bible`; os outros cinco tipos são exclusivos de `/api/insights`.

## O feed

**Drip queue.** Os pipelines podem devolver 2+ itens de uma vez; uma fila no
cliente os espaça para o ouvinte ter tempo de ler. O store decide O QUE e
QUANDO; `useDrainTimer` decide COM QUE FREQUÊNCIA. O gap é sensível à cabeça
da fila:

- `citedVerse` no head → `FEED_CITED_VERSE_GAP_MS` = **0**. A citação vem do
  pregador lendo agora; ela também FURA A FILA (prepend no `enqueueFeedItems`).
- feed ainda vazio → `FEED_FIRST_CARD_GAP_MS` (20s), warmup.
- caso geral → `FEED_MIN_GAP_MS` (90s).

`scheduleDrainIfIdle` sempre reagenda, para que um `citedVerse` que fura fila
substitua o timer pendente de gap longo.

**Exceção ao "só acrescenta", RANGE SUPERSEDE para `citedVerse`.** Quando uma
referência que chega contém estritamente uma já visível (mesmo livro e
capítulo, faixa maior, `Tiago 1:1-4` chegando com `Tiago 1:1` na tela), o
card mais estreito é removido, para que um único card acompanhe a passagem
conforme o pregador lê. A contenção é ASSIMÉTRICA: referência de capítulo
inteiro nunca cobre uma com versículo (`João 4` não substitui `João 4:7`),
casando com a regra do prompt. Ver `referenceStrictlyContains` em
`lib/domain/feed.ts`.

Na direção inversa, sim: um `citedVerse` de capítulo só renderiza assumindo
que a leitura começa no versículo 1, e uma referência com versículo para o
mesmo livro/capítulo SUBSTITUI o card assumido (`referenceResolvesChapterOnly`),
o versículo falado corrige a suposição.

**Convenção visual.** Cards ORIGINADOS do pregador (`citedVerse`,
`speakerHighlight`, `speakerEcho`, `speakerCitation`) usam a superfície de
gradiente de citação; cards de autoria da IA (`relatedVerse`, `context`,
`suggestedQuote`) usam a superfície tracejada. A origem é DERIVADA do `kind`
por `feedItemOrigin`, não acrescente um campo `origin`.

**`coerceFeedItemsLoose` só serve para contexto de prompt.** Ele descarta em
silêncio o que não bate com o schema, o que está certo nas rotas ao vivo
(entrada malformada não deve derrubar a requisição inteira) e errado em quem
PERSISTE o array: o `final-summary` rejeita com 400, para o cliente aprender o
bug em vez de perder cards calado.

## Texto bíblico na tela

`PassageVerses` faz **uma** busca por passagem e tem **um** estado: ou o
esqueleto do bloco inteiro, ou o texto inteiro. Não há revelação progressiva.

Ela já teve: um componente por versículo, cada um com a sua requisição,
revelando em ordem conforme resolviam. Duas coisas quebraram, e as duas são o
motivo de o arquivo estar como está:

1. **Rate limit.** Um estudo com dezessete passagens passava das 60/min de
   `/api/verse`. Os versículos recusados voltavam vazios, e a tela mostrava
   número sem texto, sem erro nenhum visível, porque `requestVerse` não
   conferia `res.ok` e um 429 virava uma passagem vazia indistinguível de
   "não existe".
2. **Montagem aos pedaços.** O bloco aparecia e ia se preenchendo linha a
   linha, empurrando o conteúdo abaixo a cada versículo que chegava.

O cache do React Query é por PASSAGEM (`["passage", reference]`) e
`staleTime: Infinity`, texto bíblico não muda, e sem isso voltar para uma
sessão refazia todas as buscas.

As larguras do esqueleto são fixas por posição, e não sorteadas: um
`Math.random()` ali daria hidratação divergente e o React descartaria o HTML
do servidor.

## Menções dentro do parágrafo

`RichText` (`components/RichText.tsx`) é o que o resumo e o estudo usam para
desenhar PROSA. Ele passa o texto por `annotateText` (`lib/domain/annotate.ts`)
e marca três coisas: referência bíblica, personagem/lugar e figura citada.

**É regex sobre um léxico curado (`lib/domain/lexicon.ts`), não uma etapa de
IA.** Marcar entidade com LLM seria mais uma chamada por sessão, com custo,
latência e a chance de o modelo marcar o que não está no texto, para um
problema que um autômato resolve, igual toda vez.

Quatro decisões que o próximo a mexer precisa conhecer:

- **A passada de referência vem ANTES da de nomes, e exige número de
  capítulo.** É o que separa o evangelho do apóstolo: "João 3:16" é consumido
  inteiro pela primeira passada, e a segunda nunca vê aquele "João". Um "João"
  solto no meio da frase continua sendo o apóstolo.
- **O casamento é exato, acento e maiúscula inclusive.** O gate do pipeline ao
  vivo (`lib/bible/detect.ts`) é tolerante porque a entrada dele é fala
  transcrita; aqui a entrada é texto escrito por um modelo, e tolerância que
  não é necessária só compra falso positivo.
- **Só a referência é CLICÁVEL, e por isso só ela é colorida.** Nome próprio
  ganha a faixa de marca-texto (`--session-mention-wash`) e nada mais, não há
  para onde ir a partir dele. As três categorias continuam distintas nos dados
  (`data-mention`), não na tinta: três cores de marcação num parágrafo é uma
  página de arco-íris, e o realce só funciona enquanto for exceção.
- **Nunca aplique `RichText` em texto bíblico** (`bibleQuote`, `relatedVerse`)
  nem em frase de efeito (`highlight`). No primeiro todo nome é personagem e a
  marcação pintaria o bloco inteiro; a segunda já carrega a faixa amarela.

Os dois tokens (`--session-mention-ink`, `--session-mention-wash`) trocam de
família dentro de `.tone-study`, no estudo o acento é verde, como o resto.

## Os três modos oferecem as MESMAS ações

Um modo de gravação não é uma versão reduzida do outro: o que muda é o que o
Scriba FAZ com o áudio, nunca o que o usuário pode fazer com a gravação. Toda
tela de captura tem, sem exceção:

| | onde |
|---|---|
| `RecordingHeader` (título, autor, local) | topo, com o menu dentro |
| Ler transcrição (agrupada por minuto) | `SessionMenu` → diálogo |
| Algo está errado | `SessionMenu` → `HallucinationReportDialog` |
| **Descartar gravação** | `SessionMenu`, lixeira da barra, `PausedOverlay` |
| Pausar / parar | barra do gravador e `PausedOverlay` |

**"Descartar" mora em TRÊS lugares de propósito.** A lixeira da barra do
gravador existia sozinha no modo transcrição, e o usuário relatou que o modo
não tinha como cancelar, ele tinha: um ícone de 14px numa barra que se apaga
sozinha depois de alguns segundos parada. Quem procura "como cancelar isto"
abre o menu de três pontos. Ação destrutiva precisa estar onde se procura por
ela, não onde coube.

O `audio_only` era o modo fora do padrão, sem cabeçalho, sem descartar, com o
menu solto num canto e sem sequer usar o store. Ele hoje semeia os metadados no
store em `start()` (é de lá que o `RecordingHeader` lê) e **lê autor e local do
STORE na hora de salvar**, não das props: salvar a prop descartaria em silêncio
o que a pessoa editou durante a gravação.

A ÚNICA diferença legítima entre os três é o que existe para ser mostrado: só o
`live` tem feed, então só ele tem "Ver conteúdo do live" no menu e a aba
`Conteúdo`; e o `transcript_only` não tem alternador de visão porque a página
inteira já é a única visão que ele tem.

## As duas visões de uma gravação

`live` e `audio_only` mostram duas coisas do mesmo momento, e a `RecordingDock`
é onde se troca entre elas:

| Modo | Aba 1 | Aba 2 |
|---|---|---|
| `live` | `Feed` (ou `SummaryView`, parado) | `LiveTranscriptStream` |
| `audio_only` | o botão grande do microfone | `LiveTranscriptStream` |

**A transcrição usa o `LiveTranscriptStream`, o MESMO do modo transcrição, e
não o `TranscriptView` do diálogo.** Os dois existem e resolvem coisas
diferentes: o `TranscriptView` agrupa por minuto, para leitura calma depois; o
stream dá uma linha por chunk, com o carimbo de tempo, no instante em que o
`/api/transcribe` responde. Durante a pregação o que se quer conferir é o
trecho que acabou de chegar. (O diálogo do menu de três pontos continua ali,
ele serve à leitura, não à conferência.)

**Os dois painéis são MONTADOS E DESMONTADOS, nunca escondidos com `hidden`.**
A rolagem aqui é a da janela; duas árvores altas empilhadas dariam à página a
soma das duas alturas, e o autoscroll de cada uma miraria uma posição que não é
o fim da tela.

### Por que a faixa fica embaixo, e em duas linhas

O conteúdo destas telas cresce por uma hora. **Um alternador no topo obrigaria
a rolar o sermão inteiro de volta só para trocar de aba**, que é exatamente o
que ele deveria evitar. Embaixo ele fica no polegar o tempo todo.

As abas já dividiram UMA linha com a barra do gravador, e num telefone de 390px
não coube: a barra sozinha carrega tempo, pausar, parar e descartar, e o que
sobrava obrigava as abas a virarem dois ícones sem rótulo. Duas caixinhas mudas
não contam a ninguém que existe uma transcrição para ler. Empilhadas em duas
faixas, cada uma tem a largura de que precisa.

De baixo para cima, e a ordem é a regra: **o que sempre está lá primeiro, o que
às vezes aparece por último.**

```
1,50rem   barra do gravador          (some quando não está gravando)
5,75rem   abas                       (descem para 1,50rem sem a barra)
9,75rem   pílulas transientes        (RECORDING_TRANSIENT_BAND)
```

Quem crescer o conteúdo dessas telas mexe no `pb-*` da seção junto, hoje
`pb-44`, dimensionado para a última linha não morrer atrás das duas faixas.

**"Ler novidades" e o contador da aba nunca aparecem juntos**, e é de propósito:
os dois dizem a mesma coisa. O contador só existe na aba FECHADA; a pílula é
gateada em `view === "feed"`. Na aba do feed avisa a pílula (que também rola até
o fim); na da transcrição avisa o contador.

**As abas não recolhem junto com a barra do gravador.** Aquele apagamento por
inatividade existe para ninguém ENCERRAR um sermão encostando na tela; trocar de
aba não destrói nada, e cobrar dois toques por isso não compraria segurança
nenhuma.

## Qualidade da transcrição

Um chunk volta marcado como `poor` quando qualquer uma de três fontes acusa,
assinatura de alucinação, baixa confiança do modelo, ou densidade de texto por
segundo baixa demais (ver `lib/AGENTS.md`). Consequências:

- O chunk **não volta como contexto** (`prevText`) e não alimenta os
  pipelines. Sem isso, um loop de repetição se realimenta no chunk seguinte.
- Se `POOR_AUDIO_BAD_COUNT` (3) dos últimos `POOR_AUDIO_WINDOW` (5) chunks
  saíram ruins, a sessão acende o banner de áudio ruim. Ele é **pegajoso** até
  o fim da sessão, um trecho bom depois de dez ruins não significa que o
  microfone melhorou, e aviso que pisca é pior que aviso nenhum.

**O banner não troca nada sozinho, e a mensagem não pode voltar a prometer que
troca.** Ela já dizia "ativamos um modelo mais preciso": havia uma escalada de
modelo, e ela foi removida porque o modelo "mais preciso" era medidamente pior
(`docs/transcricao.md` §1). O que o aviso pede hoje é a única coisa que a
pessoa na cadeira ainda pode fazer, aproximar o aparelho de quem fala.

**A captação é onde está o ganho que sobra.** `lib/recorder.ts` pede ao
navegador para NÃO aplicar supressão de ruído, cancelamento de eco nem controle
automático de ganho: limpar o áudio antes de transcrever piora o resultado em
quase 10 pontos de WER. Ver `docs/transcricao.md`, "O que NÃO funcionou".

O usuário também pode acionar o alerta manual de alucinação
(`HallucinationReportDialog` → `/api/hallucination-report`), que roda uma
auditoria da IA contra a transcrição. É raro e de alto impacto, por isso usa
o modelo bom.

## Saldo durante a gravação

`useCoinGuard`, usado pelos três modos. Acabar o saldo no meio de um sermão
**congela** a captura, não a encerra, antes ela finalizava e disparava o
resumo com metade do conteúdo, sem chance de reagir.

Fluxo: aviso em 5 min e 2 min restantes (cada degrau uma vez, rearmado se o
saldo subir) → ao zerar, `pause()` + `PausedOverlay` com `outOfCoins` → o
usuário compra em **aba nova** (sair da página mataria o MediaRecorder e a
fila de chunks) → o saldo é ressincronizado por `focus`, `visibilitychange` e
polling curto (`COIN_RECOVERY_POLL_MS`, só com a aba visível) → a trava cai e
"Retomar" reaparece.

**O hook nunca retoma sozinho.** Reabrir o microfone sem gesto do usuário
seria surpreendente e, em alguns navegadores, bloqueado.

## Sobreviver ao segundo plano

`useBackgroundKeepalive` reúne tudo que a plataforma web permite para manter
uma gravação viva com a aba em segundo plano ou a tela apagada:

1. **Loop de áudio silencioso** num `<audio>` escondido (WAV de 2s com zero
   amostras, gerado em memória). Por contar como mídia tocando, o navegador
   para de estrangular `setInterval`, mantém AudioContexts vivos, expõe
   controles na tela de bloqueio do Android e resiste a matar a aba sob
   pressão de memória. É por isso que o `Permissions-Policy` do
   `next.config.ts` libera `autoplay=(self)`.
2. **Media Session** com metadata e `playbackState`, o que também dá o botão
   de parar do sistema, tratado por `onExternalStop`.
3. **`nativeBridge`**: quando o app roda dentro de uma WebView React Native,
   as mensagens sobem para a shell nativa iniciar um foreground service
   (Android) ou ativar a `AVAudioSession` (iOS). Em aba normal,
   `window.ReactNativeWebView` é undefined e tudo vira no-op. O haptic de card
   novo passa por aqui porque o Safari não implementa `navigator.vibrate`; o
   `recorder:error` passa porque o console da WebView não existe em produção.

   **A ponte é de mão única, o web não lê nada de volta.**

   **Pausa NÃO é parada, e a ponte distingue as duas.** Os eventos saem de
   TRANSIÇÕES da prop `phase` (`idle` | `recording` | `paused`), num effect
   próprio, não da limpeza do effect de keepalive. Enquanto saíam de lá, toda
   pausa emitia `recording:stop` e toda retomada um `recording:start`: a shell,
   que reage a `stop` DESTRUINDO recursos (foreground service no Android,
   `AVAudioSession` no iOS), destruía e recriava tudo uma vez por pausa. Pior
   no congelamento por saldo zerado (`useCoinGuard.onFreeze`), que pausa sem
   gesto do usuário e talvez com o app em segundo plano, soltar o foreground
   service ali convida o Android a matar o processo justamente quando a sessão
   está viva esperando crédito. Numa pausa a captura para, mas a sessão
   continua; a shell deve segurar o serviço e só trocar o texto da notificação.

`useWakeLock` segura a tela; `useUnloadGuard` pede confirmação antes de fechar
a aba durante uma gravação.

## Depois do stop

O resumo final é **single-shot**: `/api/final-summary` roda uma vez com a
transcrição completa mais os `feedItems` acumulados. O prompt trata o feed
como contexto curado de alta prioridade, versículos citados e destaques do
pregador têm de atravessar; sugestões da IA só ficam se ainda couberem no
todo.

**Voltou a ser uma chamada só.** Houve uma segunda, o "enriquecimento": ela
recebia os blocks já organizados e devolvia inserções de `contextCard`
(contexto histórico, nota exegética, área doutrinária) e `relatedVerse`
("leia também"), os **comentários do Scriba**, que o `SummaryView` agrupava
com o bloco anterior e escondia atrás de um botão de balão. Saiu inteiro:
prompt, tipos de bloco, `ScribaComment`, o hook `use-read-flag` que marcava o
balão como lido, a env var do modelo e as quatro rotas `summary-enrichment*`
de `UsageRoute`. Era a segunda chamada mais cara do produto, o sermão inteiro
de novo na entrada, por uma camada que o leitor não abria.

O que ficou no resumo é só a voz do pregador: `bibleQuote` com a referência,
`highlight` com a frase marcante, `example`, `quote` e a `conclusion`. Nada
disso veio do enriquecimento e nada disso mudou.

Resumos ANTIGOS continuam com aqueles dois blocos no `final_summary`, nada os
apaga; `BlockRenderer` devolve `null` para tipo que não conhece, então eles
simplesmente não desenham. As linhas de `summary-enrichment*` também continuam
em `llm_usage_events`, e `lib/db/admin/usage.ts` continua lendo-as, para o
custo histórico de reprocessar resumo não migrar para a linha da gravação.

Modo `transcript_only` não tem resumo NA HORA DO STOP: o texto é salvo por
`PUT /api/sessions/:id/transcript` com `final_summary` nulo, e a sessão abre
em `/recording/:id/transcript`.

**Mas ele pode ganhar um depois.** `SummarizeTranscriptButton` no cabeçalho
daquela página chama `/api/final-summary/from-transcript`, que roda o MESMO
`generateFinalSummary` sobre a transcrição salva (com `feedItems: []`, porque
o modo não tem feed) e grava releia / lembra / frases marcantes junto. Custa
`summary_from_transcript`, 15 moedas, o mesmo do reprocessamento, porque é o
mesmo trabalho.

Três consequências que mordem quem for mexer:

- **O gate de rota passou a ser a presença do PAYLOAD, não o modo.**
  `/recording/:id/summary` só devolve para `/transcript` quando
  `final_summary` é nulo. Voltar a testar `mode === "transcript_only"` ali
  esconde o resumo que a pessoa acabou de pagar.
- **`savedRouteFor(mode, hasSummary)` tem um segundo argumento**, e só o
  `/recordings` o passa, via `listSessionIdsWithSummary`, uma consulta de
  chave no molde de `listDeepenedSessionIds`. Quem só tem o modo em mãos omite
  e cai em `/transcript`, de onde o cabeçalho leva ao resumo em um toque.
- **O título da linha é preservado** (`updateSessionSummary(..., { keepTitle })`).
  Naquele modo não há LLM para gerar título, então o que está na coluna foi
  escolhido por gente, sobrescrevê-lo com o do resumo apagaria o que ela
  digitou.

Sessões nunca encerradas (`ended_at is null`) saem da lista principal e
aparecem numa faixa "Gravações em aberto" no `/recordings`, com opção de
continuar ou apagar, ver `listUnfinishedSessions`.

Depois disso a sessão pode gerar o **estudo** (`/api/deepening`, uma vez por
sessão, `unique(session_id)` na migração 0009, com uma rota de reprocessamento
separada) e os cards de acompanhamento, releia / lembra / frase marcante, que
alimentam o `/feed` unificado (`lib/db/feed-entries.ts`) por data agendada.

Havia um quarto card, "Coloque em prática" (`session_practices`), gerado junto
com o resumo. Ele saiu, do prompt, do feed e da página de resumo. A tabela e
os payloads antigos continuam no banco; ver `supabase/AGENTS.md`.

**Releitura sem texto não existe.** O card de "releia" é a passagem em si; sem
o texto da NVI embaixo, o que sobra é a pastilha da referência e um retângulo
vazio. As fontes do pool (`citedVerse` do feed, `bibleQuote` do resumo) NÃO
prometem uma referência completa, um "Judas", livro sem capítulo, já
atravessou até o feed de um usuário. Três guardas, em camadas:

1. `collectRereadPool` só admite referência que `parseVerseReference` aceita.
2. `withVerseText` resolve o texto **antes** de o candidato ganhar um
   `dayOffset`, e descarta quem fica sem. A ordem importa: montar os dez e
   buscar o texto depois, como era, não deixa devolver o slot.
3. `listFeedEntries` esconde item sem texto, para as sessões geradas antes da
   correção não continuarem vencendo dia após dia.

O preço da guarda 2 é que o pool encolhe, e dez slots com menos candidatos
reprovam em `isCompleteRereadsPayload`. Por isso a chamada de preenchimento
pede `needed + FILL_SLACK` referências: uma sugestão torta do modelo não pode
custar a releitura inteira da sessão.

O estudo tem duas particularidades que mordem de fora:

- **Ele não fala o vocabulário de blocos do resumo.** `StudyBlock`
  (`lib/domain/study.ts`) acrescenta `objection`, `distinction`, `reading` e
  `question`, e reinterpreta `example`, no resumo é "Exemplo do pregador",
  no estudo é ilustração do próprio estudo. Por isso a página usa
  `StudyBlockRenderer`, que desenha esses cinco e delega o resto ao
  `BlockRenderer`. Um bloco novo precisa entrar nos DOIS lugares: no parser e
  no renderer.

  O `question` tem limite de dois blocos, e só no fecho. Não é estética: o
  estudo é um ARTIGO, e o pipeline que o produz passa por uma etapa de
  perguntas, sem esse limite, o redator devolve o andaime como se fosse o
  produto, e o texto vira um FAQ.
- **Gerar exige plano `Estudioso`.** LER um estudo salvo, não. O booleano vem
  do servidor por prop (`canGenerate` / `canReprocess`); a proteção real está
  em `requireFeature` dentro da rota. Ver `lib/AGENTS.md`.

  Consequência na tela: o `/studies` tem TRÊS estados, não dois. Sem plano e
  sem nenhum estudo, a página inteira é o convite (`StudiesUpsell` variante
  `full`), o `StudiesEmptyState`, que ensina a gerar, seria instrução para
  algo que a pessoa não pode fazer. Sem plano MAS com estudos antigos, a lista
  fica e o convite vira faixa acima dela: esconder o que a pessoa já pagou
  para produzir seria confisco.

## As listas: busca e filtros

`/recordings` e `/studies` têm a MESMA barra
(`components/CollectionSearch.tsx`) e o mesmo motor (`lib/search.ts`, puro e
client-safe). Quem filtra é um componente cliente por página,
`app/(app)/recordings/SessionsBrowser.tsx` e
`app/(app)/studies/StudiesBrowser.tsx`; as páginas continuam sendo só quem
BUSCA.

**A filtragem é no CLIENTE, e isso é escolha.** As duas páginas já carregam
tudo do usuário num render de servidor, não há paginação em lugar nenhum, e
a escala é a de quem grava um ou dois sermões por semana. Filtrar ali responde
a cada tecla sem uma ida ao servidor por caractere e sem estado de carregamento
piscando entre os cartões.

**A exceção é a TRANSCRIÇÃO, e ela é servidor obrigatoriamente.** O texto da
pregação não vai para a lista (`SELECT_LIST` o exclui de propósito) e não pode
ir: trazer uma hora de sermão por cartão para desenhar uma lista trocaria a
busca por um problema pior. Quem procura uma FRASE dita no púlpito passa por
`GET /api/sessions/search`, que devolve só ids; `useContentSearch` os une ao
resultado local. Duas invariantes desse hook:

- **`null` não é conjunto vazio.** `null` = "não há resposta de conteúdo",
  termo curto, requisição em voo, ou falha. Tratá-lo como `[]` faria cada tecla
  apagar os resultados por um instante, e uma falha de rede viraria "nada
  encontrado".
- **Resposta de consulta velha é descartada** (`seqRef`). Sem isso, a
  requisição lenta de "gra" chegando depois da de "graça" repinta a lista com
  o termo anterior, e o usuário não tem como saber que não é o que digitou.
- **`pending` não é `ids === null`.** O hook diz, separado dos ids, que ainda
  há resposta a caminho, e as listas usam isso para NÃO desenhar "nenhum
  resultado" no intervalo entre a tecla e a resposta. Sem essa distinção a
  tela afirmava o vazio e se desmentia meio segundo depois, quando entrava o
  cartão que só casa pela transcrição. Espera só o caso VAZIO: havendo
  resultado local a lista continua desenhada, e quem avisa é o contador
  ("Procurando…").

**A outra metade servidor é o VERSÍCULO, e ela não é busca de texto.** Procurar
"Jonas 1" tem de achar a pregação cujo card diz "Jonas 1:1-17", e o pregador
disse "no primeiro capítulo de Jonas", então a transcrição não ajuda e nenhuma
das duas strings é substring da outra. `lib/domain/reference-query.ts` entende
os dois lados como REFERÊNCIA: resolve o livro pelos apelidos de
`lib/bibles/books.ts` (acento, abreviação, prefixo, "genesis", "1co", "jona"),
e compara capítulo e faixa de versículos por interseção, não por igualdade.
Capítulo sem versículo cobre o capítulo inteiro, dos dois lados.

O trabalho é dividido: a RPC `session_verse_references` peneira por LIVRO nas
duas fontes que guardam referência, os cards `citedVerse` de
`session_feed_items` e os blocos `bibleQuote` de `final_summary`, e o
casamento fino acontece no TypeScript, com `parseVerseReference`, a mesma
função que o feed usa para deduplicar card. **As duas fontes são obrigatórias:**
sessão `audio_only` não tem card nenhum (o pipeline bíblico não roda nela), e
procurar só nos cards perderia um modo inteiro do produto sem nenhum sinal na
tela.

O cartão que casou SÓ pela transcrição ganha a pastilha "Trecho na
transcrição"; o que casou por versículo mostra a REFERÊNCIA que casou. Sem elas
o cartão apareceria na lista sem nenhuma explicação visível para estar ali, e
a referência ainda responde metade da pergunta de quem procurou "Jonas 1":
qual pedaço de Jonas 1 foi lido.

**O agrupamento por período foi para dentro do browser**, junto com a
filtragem. Agrupar no servidor e filtrar no cliente deixa seções vazias na tela
toda vez que um filtro esvazia um mês. Em troca, `nowIso` desce do servidor por
prop: `groupLabel` compara com "agora", e um `new Date()` do cliente pode cair
do outro lado da meia-noite em relação ao HTML servido, o React descartaria a
página inteira por divergência de hidratação por causa de um rótulo.

As opções de autor e de local saem dos ITENS da lista (`facetOptions`), não das
tabelas `speakers` / `locations`: um filtro que oferece um nome sem resultado
atrás é um beco, e o que a lista mostra é o SNAPSHOT em `sessions.speaker_name`,
renomear um pregador não reescreve o passado, então filtrar pela entidade não
casaria com o texto na tela.

**A barra aparece sempre que a lista aparece.** Houve um piso de quatro itens
por página; ele caiu. Rolar até o cartão é mesmo mais rápido numa lista curta,
mas a busca daqui alcança a TRANSCRIÇÃO, que o cartão não mostra, e uma
barra que só nasce no quarto item é uma função que se descobre por acidente. O
que o `CollectionSearch` esconde é a faceta sem nenhuma opção, que não filtra
nada.

## Ao mexer aqui

Mantenha as predicados dos guards e os arrays de dependência dos effects
intactos, a menos que a mudança seja intencional, as omissões nas deps de
`useInsightsPipeline` e `useBiblePipeline` são deliberadas e estão comentadas.

Mudou uma cadência? Atualize o comentário da constante em `config.ts` junto,
porque o próximo a ler vai confiar nele.
