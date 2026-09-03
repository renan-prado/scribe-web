# src/features/session — a gravação

O coração do produto. Esta pasta contém o gravador, os pipelines ao vivo, o
feed e as telas de sessão salva.

**Antes de mudar ritmo, cadência ou threshold:** os números estão todos em
`config.ts`, cada um com o raciocínio ao lado. Leia o comentário da constante
antes de trocar o valor — quase todos foram calibrados contra sessões reais.

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

## O caminho de um chunk

1. `createRecorder` (`lib/recorder.ts`) fatia o áudio por VAD entre
   `RECORDER_MIN_CHUNK_MS` (15s) e `RECORDER_MAX_CHUNK_MS` (20s). Chunk menor
   reduz o atraso até o primeiro card; grande demais faz uma frase longa
   esperar.
2. `isSilentBlob` descarta o que é silêncio antes de gastar uma chamada.
3. `useTranscribeQueue` persiste o chunk no IndexedDB (`lib/chunk-store.ts`) e
   sobe para `/api/transcribe`, com backoff `[1s, 3s, 10s, 30s, 60s]` cujo
   último valor se repete para sempre. **Não desistimos sozinhos** — parar é
   decisão do usuário, e o stop dispara um drain com timeout suave.
4. O chunk volta com texto e um veredito de qualidade. Ver "Qualidade" abaixo.
5. Os pipelines observam a transcrição acumulada e decidem se chamam.

**A persistência em IndexedDB existe para o caso em que a aba morre.** Um
chunk que não subiu vira buraco na transcrição; guardado, a fila o retoma
depois — inclusive num reload da mesma URL de sessão (recuperação silenciosa
de órfãos, com TTL de 24h para não acumular). Tudo degrada em silêncio onde
IndexedDB não existe: o pipeline em memória continua, só sem recuperação.

`startedAtRef` é semeado por `start()` **antes** de virar `setRunning(true)`,
para que `useElapsedTimer` veja uma origem válida no primeiro render.
Preserve essa ordem.

## Os três pipelines ao vivo

Cada um é um hook, coordenado por flags de voo no store (`bibleInFlight`,
`insightsInFlight`, `finalizing`). **Todos são ADITIVOS** — só acrescentam a
`feedItems`; nada é reescrito ou reordenado durante a gravação. O dedup por
`feedItemDedupKey` protege contra itens equivalentes chegando de chamadas
sobrepostas.

### `useBiblePipeline` → `/api/bible` (rápido, por chunk)

Único emissor de `citedVerse`. Gate de duas camadas antes de gastar a chamada:

1. **`hasBibleMention`** (`lib/bible/detect.ts`) — regex barato: livros com
   acento opcional e ordinal em número, romano ou extenso; dispara também em
   `capítulo` / `versículo` / `verso` mesmo sem livro no trecho. Sem menção,
   sai.
2. **`scoreBibleGuard`** (`lib/bible/guard.ts`) — soma sinais ponderados e só
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
recente resolvido, TTL de 5min — é o que faz "versículo 10" sozinho valer
`continuationHit`) e `lastBibleEmit` (cooldown de 90s, cujo `duplicateEmit`
de −5 mata sozinho um `bookWithNumber`, impedindo re-disparo enquanto o
pregador segue discutindo a mesma passagem). Os dois são atualizados após um
retorno com `citedVerse` parseável. Skips por camada contam separado em
`bibleGateSkipped` e `bibleGuardSkipped`.

### `useInsightsPipeline` → `/api/insights` (lento, por contagem de chunks)

Emite os outros cinco tipos: `speakerHighlight`, `speakerCitation`,
`relatedVerse`, `context`, `suggestedQuote`. Dispara a cada
`INSIGHTS_CHUNK_INTERVAL` (6) chunks OK — contagem de chunks, não tempo. O
PRIMEIRO disparo da sessão usa `INSIGHTS_FIRST_FIRE_CHUNK` (1): sem esse
warmup, o primeiro card só apareceria depois de 2min, o que lê como "não está
funcionando".

Dois gates de economia: `INSIGHTS_MIN_TAIL_DELTA_CHARS` (tick em quase
silêncio vira no-op) e `INSIGHTS_QUEUE_BACKPRESSURE` (se a fila de drip já tem
2 pendentes, pula — enquanto os cards antigos não aparecem, gerar mais só
gasta token e produz insight fora do momento).

`insightsInFlight` NÃO está nas deps do effect de propósito — re-disparar na
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

**Exceção ao "só acrescenta" — RANGE SUPERSEDE para `citedVerse`.** Quando uma
referência que chega contém estritamente uma já visível (mesmo livro e
capítulo, faixa maior — `Tiago 1:1-4` chegando com `Tiago 1:1` na tela), o
card mais estreito é removido, para que um único card acompanhe a passagem
conforme o pregador lê. A contenção é ASSIMÉTRICA: referência de capítulo
inteiro nunca cobre uma com versículo (`João 4` não substitui `João 4:7`),
casando com a regra do prompt. Ver `referenceStrictlyContains` em
`lib/domain/feed.ts`.

Na direção inversa, sim: um `citedVerse` de capítulo só renderiza assumindo
que a leitura começa no versículo 1, e uma referência com versículo para o
mesmo livro/capítulo SUBSTITUI o card assumido (`referenceResolvesChapterOnly`)
— o versículo falado corrige a suposição.

**Convenção visual.** Cards ORIGINADOS do pregador (`citedVerse`,
`speakerHighlight`, `speakerEcho`, `speakerCitation`) usam a superfície de
gradiente de citação; cards de autoria da IA (`relatedVerse`, `context`,
`suggestedQuote`) usam a superfície tracejada. A origem é DERIVADA do `kind`
por `feedItemOrigin` — não acrescente um campo `origin`.

**`coerceFeedItemsLoose` só serve para contexto de prompt.** Ele descarta em
silêncio o que não bate com o schema, o que está certo nas rotas ao vivo
(entrada malformada não deve derrubar a requisição inteira) e errado em quem
PERSISTE o array: o `final-summary` rejeita com 400, para o cliente aprender o
bug em vez de perder cards calado.

## Qualidade da transcrição e escalada de modelo

Um chunk volta marcado como `poor` quando qualquer uma de três fontes acusa —
assinatura de alucinação, baixa confiança do modelo, ou densidade de texto por
segundo baixa demais (ver `lib/AGENTS.md`). Consequências:

- O chunk **não volta como contexto** (`prevText`) e não alimenta os
  pipelines. Sem isso, um loop de repetição se realimenta no chunk seguinte.
- Se `TRANSCRIBE_ESCALATION_BAD_COUNT` (3) dos últimos
  `TRANSCRIBE_ESCALATION_WINDOW` (5) chunks saíram ruins, a **sessão inteira**
  passa a pedir o modelo escalado direto — evita pagar dois modelos por chunk
  em áudio sabidamente ruim. A promoção é pegajosa até o fim da sessão, e o
  usuário vê um banner para decidir se continua gastando moedas.

O usuário também pode acionar o alerta manual de alucinação
(`HallucinationReportDialog` → `/api/hallucination-report`), que roda uma
auditoria da IA contra a transcrição. É raro e de alto impacto, por isso usa
o modelo bom.

## Saldo durante a gravação

`useCoinGuard`, usado pelos três modos. Acabar o saldo no meio de um sermão
**congela** a captura, não a encerra — antes ela finalizava e disparava o
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
   de parar do sistema — tratado por `onExternalStop`.
3. **`nativeBridge`** — quando o app roda dentro de uma WebView React Native,
   as mensagens sobem para a shell nativa iniciar um foreground service
   (Android) ou ativar a `AVAudioSession` (iOS). Em aba normal,
   `window.ReactNativeWebView` é undefined e tudo vira no-op. O haptic de card
   novo passa por aqui porque o Safari não implementa `navigator.vibrate`.

`useWakeLock` segura a tela; `useUnloadGuard` pede confirmação antes de fechar
a aba durante uma gravação.

## Depois do stop

O resumo final é **single-shot**: `/api/final-summary` roda uma vez com a
transcrição completa mais os `feedItems` acumulados. O prompt trata o feed
como contexto curado de alta prioridade — versículos citados e destaques do
pregador têm de atravessar; sugestões da IA só ficam se ainda couberem no
todo.

Modo `transcript_only` não tem resumo: o texto é salvo por
`PUT /api/sessions/:id/transcript` com `final_summary` nulo, e a sessão abre
em `/recording/:id/transcript`.

Sessões nunca encerradas (`ended_at is null`) saem da lista principal e
aparecem numa faixa "Gravações em aberto" no `/list`, com opção de continuar
ou apagar — ver `listUnfinishedSessions`.

Depois disso a sessão pode gerar o **estudo** (`/api/deepening`, uma vez por
sessão — `unique(session_id)` na migração 0009, com uma rota de reprocessamento
separada) e os cards de acompanhamento — praticar / releia / lembra — que
alimentam o `/feed` unificado (`lib/db/feed-entries.ts`) por data agendada.

O estudo tem duas particularidades que mordem de fora:

- **Ele não fala o vocabulário de blocos do resumo.** `StudyBlock`
  (`lib/domain/study.ts`) acrescenta `objection`, `distinction`, `reading` e
  `question`, e reinterpreta `example` — no resumo é "Exemplo do pregador",
  no estudo é ilustração do próprio estudo. Por isso a página usa
  `StudyBlockRenderer`, que desenha esses cinco e delega o resto ao
  `BlockRenderer`. Um bloco novo precisa entrar nos DOIS lugares: no parser e
  no renderer.

  O `question` tem limite de dois blocos, e só no fecho. Não é estética: o
  estudo é um ARTIGO, e o pipeline que o produz passa por uma etapa de
  perguntas — sem esse limite, o redator devolve o andaime como se fosse o
  produto, e o texto vira um FAQ.
- **Gerar exige plano `Estudioso`.** LER um estudo salvo, não. O booleano vem
  do servidor por prop (`canGenerate` / `canReprocess`); a proteção real está
  em `requireFeature` dentro da rota. Ver `lib/AGENTS.md`.

  Consequência na tela: o `/studies` tem TRÊS estados, não dois. Sem plano e
  sem nenhum estudo, a página inteira é o convite (`StudiesUpsell` variante
  `full`) — o `StudiesEmptyState`, que ensina a gerar, seria instrução para
  algo que a pessoa não pode fazer. Sem plano MAS com estudos antigos, a lista
  fica e o convite vira faixa acima dela: esconder o que a pessoa já pagou
  para produzir seria confisco.

## Ao mexer aqui

Mantenha as predicados dos guards e os arrays de dependência dos effects
intactos, a menos que a mudança seja intencional — as omissões nas deps de
`useInsightsPipeline` e `useBiblePipeline` são deliberadas e estão comentadas.

Mudou uma cadência? Atualize o comentário da constante em `config.ts` junto,
porque o próximo a ler vai confiar nele.
