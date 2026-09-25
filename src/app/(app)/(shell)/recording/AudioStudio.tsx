"use client";

import { Pause, Play, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { useCaptureQueue } from "@/features/session/capture-queue";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import {
  type CaptureMeta,
  deleteCapture,
  patchCaptureMeta,
  putCaptureMeta,
  putFragment,
} from "@/features/session/lib/capture-store";
import { phaseLabel } from "@/features/session/lib/capture-upload";
import { useRecordingStore } from "@/features/session/recording-store";
import { pickMime } from "@/lib/audio-constraints";
import { cn } from "@/lib/utils";
import { useClockScope } from "./ClockScope";
import { RecordingWorkbench } from "./RecordingWorkbench";
import { useRecordingNotes } from "./recording-notes";
import { type InterruptReason, useAudioCapture, WAVE_BARS } from "./useAudioCapture";
import { askRecordingNotificationPermission, useRecordingPresence } from "./useRecordingPresence";

/**
 * O gravador do v2.
 *
 * **Uma gravação, uma transcrição.** O app de hoje transcreve a cada 15-20s
 * porque o feed ao vivo precisa do texto na hora; aqui não há feed, e fazer o
 * mesmo custaria ~206 chamadas por hora de sermão para entregar o mesmo resumo.
 *
 * O áudio é fatiado mesmo assim, mas por outro motivo e em outra escala: um
 * fragmento a cada 2 minutos, guardado no IndexedDB na hora, para que nada se
 * perca se a aba morrer. No stop os fragmentos são concatenados de volta e o
 * que sobe é o arquivo inteiro (ver `useAudioCapture` e
 * `features/session/lib/capture-store.ts`).
 *
 * Só quando o arquivo encosta no teto de `/api/transcribe` (8 MB, uns 46
 * minutos a 24 kbps) é que ele vira DUAS partes, e aí são duas chamadas. 40
 * minutos: uma. 60 minutos: duas. Nunca duzentas.
 *
 * ## A linha da gravação nasce no PRIMEIRO SEGUNDO
 *
 * E não no stop, que é como era. A linha em `captures` é o que faz os
 * fragmentos serem encontráveis: sem ela, uma aba morta no minuto 40 deixava 20
 * fragmentos no banco e nenhum índice apontando para eles, invisíveis para o
 * resgate e para a faxina. Ela nasce aberta (`closed: false`), recebe a duração
 * a cada fragmento, e só fecha quando o `stop()` termina. O porquê inteiro está
 * no cabeçalho do `capture-store`.
 *
 * ## Esta tela NÃO é mais a dona do resgate
 *
 * Ela era, e foi por isso que uma pregação se perdeu. O envio, a falha, o botão
 * de tentar de novo e o aviso viviam todos aqui dentro: sair desta tela depois
 * de uma falha de rede era o gesto que sumia com o áudio do app inteiro. Ele
 * continuava no aparelho, intacto e sem ninguém por ele.
 *
 * Agora quem envia é a FILA (`features/session/capture-queue.ts`), que não mora
 * em tela nenhuma, insiste sozinha enquanto o app estiver aberto e publica o
 * cartão na Biblioteca. Esta tela virou o que ela sempre deveria ter sido: um
 * gravador que entrega o arquivo e acompanha a primeira tentativa.
 *
 * **E é por isso que o erro daqui termina em `/home`.** Quem parou de gravar
 * sem internet não pode ficar preso numa tela de erro cujo único conteúdo é um
 * botão que não vai funcionar: o lugar dessa gravação é a Biblioteca, com o
 * cartão amarelo dizendo o que aconteceu e o Scriba tentando de novo atrás. A
 * pessoa vai para onde a gravação dela está.
 *
 * ## Esta tela SÓ existe gravando
 *
 * Chegar aqui sem `?auto=1` devolve a pessoa para `/home`, e o disco de
 * microfone no meio da tela ociosa deixou de existir. Ele era o botão mais
 * perigoso do produto por um motivo que não se vê olhando para ele: `/recording`
 * é alcançável por caminhos que NÃO são um pedido de gravar (a notificação que
 * sobrou de uma aba morta, o atalho da tela offline, o histórico do navegador, o
 * app restaurado pelo sistema na última rota). Quem chegava por um desses via
 * uma tela pronta para gravar e um botão no meio, e o gesto seguinte começava
 * uma gravação NOVA por cima da que tinha acabado de se perder.
 *
 * Gravar passa a ser sempre um pedido explícito, feito de onde se cria: o `+` do
 * rodapé, os chips da barra no desktop e o atalho do sistema, todos com
 * `?auto=1`. A única coisa que sobrou em repouso é a saída de um start que
 * falhou (microfone negado), com o motivo escrito e um "Tentar de novo".
 *
 * ## A tela diz o que está acontecendo DE VERDADE
 *
 * O relógio é tempo de parede, e por isso ele nunca soube se havia áudio
 * entrando. Quem sabe é o `useAudioCapture`, que agora reporta `interrupted`
 * quando o sistema tira o microfone, quando o gravador desiste ou quando os
 * fragmentos param de chegar (ver o cabeçalho de lá). Aqui isso vira um estado
 * VISÍVEL: o relógio congela, a tela diz o que houve, a cobrança para, e os
 * controles viram "Retomar" e "Parar".
 *
 * Nada disso descarta o que já foi gravado: os fragmentos estão no IndexedDB
 * desde o primeiro minuto, e parar depois de uma interrupção entrega a pregação
 * até ali como qualquer outra.
 *
 * ## O que ainda NÃO faz
 *
 * Começar sem internet. A gravação em si não depende de rede, mas a sessão
 * nasce de um `POST` no stop; sem ele o áudio fica guardado e esperando, que
 * hoje é uma espera com cartão, aviso e retentativa, mas ainda não é o mesmo
 * que funcionar offline.
 */

/**
 * De quanto em quanto a linha da gravação recebe um pulso.
 *
 * Ele saía JUNTO do fragmento, e por isso só existia enquanto havia áudio
 * entrando: uma gravação pausada por dez minutos, ou interrompida por uma
 * ligação longa, envelhecia até passar do `STALE_OPEN_MS` da fila e ser dada
 * por abandonada, com o risco de outra aba subi-la no meio da pregação. São
 * duas perguntas diferentes, e agora têm duas respostas: o fragmento diz
 * "está entrando áudio", o pulso diz "esta aba ainda é a dona disto".
 */
const HEARTBEAT_MS = 30_000;

/**
 * O que a tela diz quando a gravação para sozinha.
 *
 * Três motivos, três frases, e nenhuma delas culpa a pessoa nem inventa
 * certeza: o hook sabe QUE parou e sabe por qual sensor, não sabe o que estava
 * acontecendo no aparelho. Todas terminam na mesma garantia, que é a única
 * coisa que importa nesse instante.
 */
const INTERRUPTION_TEXT: Record<InterruptReason, string> = {
  device:
    "O microfone foi tomado por outra coisa no aparelho (uma ligação, um áudio de outro app ou um fone que desconectou).",
  recorder: "A gravação parou sozinha neste navegador.",
  stalled:
    "O Scriba parou de receber áudio. Costuma ser o sistema congelando o app em segundo plano.",
};
export function AudioStudio({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const startedRef = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [depleted, setDepleted] = useState(false);
  /** `false` quando o IndexedDB recusou os fragmentos: a gravação corre sem
   * rede de segurança e a tela precisa dizer isso. */
  const [persisted, setPersisted] = useState(true);

  const captureIdRef = useRef<string | null>(null);
  /**
   * A sessão que ancora a conversa com o Biblo durante a gravação.
   *
   * **O id é sorteado no APARELHO, no mesmo instante que o da gravação, e a
   * LINHA no banco é outra coisa** — ela só nasce quando alguém pergunta algo
   * ao Biblo, ou no envio. É o mesmo desenho do `/summary/new` e do Biblo da
   * Biblioteca, e é a segunda vez que ele substitui um `POST` adiantado aqui:
   * criar a linha no toque em "gravar" punha uma ida ao servidor no instante
   * em que a tela tem uma coisa só para fazer, e deixava uma sessão vazia no
   * banco para cada gravação abandonada no primeiro minuto.
   *
   * A ref é a verdade (ela é lida por callbacks que não repintam) e o estado é
   * a cópia que a bancada lê. `sessionSavedRef` é a outra pergunta, a de se a
   * LINHA já existe: `ensureSession` responde por ela.
   */
  const sessionIdRef = useRef<string | null>(null);
  const sessionSavedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** Os `putFragment` em andamento. O stop espera por eles antes de entregar à
   * fila, senão o último fragmento pode não estar no banco ainda. */
  const writesRef = useRef<Set<Promise<void>>>(new Set());

  // A fila é a dona do envio; esta tela só empurra a gravação para dentro dela
  // e mostra em que passo ela está.
  const setCapturing = useCaptureQueue((s) => s.setCapturing);
  const track = useCaptureQueue((s) => s.track);
  const run = useCaptureQueue((s) => s.run);
  const uploading = useCaptureQueue((s) => s.uploading);
  const phase = useCaptureQueue((s) => s.phase);
  const chunk = useCaptureQueue((s) => s.chunk);

  /** A gravação que ESTA tela entregou à fila e está acompanhando. Enquanto
   *  ela existe, a tela mostra o passo do envio em vez dos controles. */
  const [sending, setSending] = useState<string | null>(null);

  /**
   * A geometria da onda, numa REF e não numa prop.
   *
   * Um tamanho só, gravando ou em repouso — é o objeto em volta do qual esta
   * tela foi desenhada, e nada mais disputa espaço com ela (ver o cabeçalho
   * de `RecordingWorkbench`). A ref existe porque `paintLevels` roda a 60
   * quadros por segundo: uma prop recriaria o callback a cada render, e com
   * ele o `useAudioCapture` inteiro.
   */
  const waveRef = useRef({ base: 14, span: 154 });

  const paintLevels = useCallback((levels: Float32Array) => {
    const { base, span } = waveRef.current;
    for (let i = 0; i < levels.length; i++) {
      const bar = barsRef.current[i];
      if (!bar) continue;
      bar.style.height = `${base + levels[i] * span}px`;
    }
  }, []);

  // O relógio do cabeçalho lê daqui (ver `ClockScope`): a origem é dele, e este
  // hook só a move.
  const { startedAtRef, setRunning, setVisible } = useClockScope();

  const { state, error, setError, interruptedBy, start, pause, resume, recover, stop, discard } =
    useAudioCapture({
      startedAtRef,
      onLevels: paintLevels,
      onFragment: ({ part, seq, blob }) => {
        const id = captureIdRef.current;
        if (!id) return;
        const set = writesRef.current;
        const write: Promise<void> = putFragment({ captureId: id, part, seq, blob })
          .then(async (ok) => {
            if (!ok) {
              setPersisted(false);
              return;
            }
            // O pulso da gravação aberta, e a duração aproximada dela. Os dois
            // existem para o caso em que o `stop()` NUNCA acontece: o pulso diz
            // à fila que esta gravação ainda está viva (e que ela não deve
            // subi-la de outra aba), e a duração é o que sobra para a tela
            // mostrar se a aba morrer no meio. Um `stop()` normal reescreve os
            // dois com o valor exato trinta segundos depois, no máximo.
            //
            // O pulso TAMBÉM tem um relógio próprio (ver `HEARTBEAT_MS`): aqui
            // ele só existe enquanto há áudio entrando, e pausa e interrupção
            // são justamente os momentos em que não há.
            const elapsed = startedAtRef.current > 0 ? performance.now() - startedAtRef.current : 0;
            await patchCaptureMeta(id, {
              heartbeatAt: Date.now(),
              durationMs: Math.max(0, Math.round(elapsed)),
              parts: part + 1,
              // As notas vão junto do pulso: é o que sobra delas se a aba
              // morrer no meio da pregação. `getState()` e não um seletor —
              // assinar o texto aqui repintaria o gravador a cada tecla (ver
              // `recording-notes.ts`).
              notes: useRecordingNotes.getState().notes.trim() || null,
            });
          })
          .finally(() => set.delete(write));
        set.add(write);
      },
    });

  const idle = state === "idle";
  const busy = sending !== null;
  const capturing = state === "recording" || state === "paused";
  /** A gravação parou sozinha e está esperando uma decisão. O áudio até aqui
   *  já está no disco; ver o cabeçalho e o de `useAudioCapture`. */
  const interrupted = state === "interrupted";
  /** O microfone está abrindo: chegou por `?auto=1` e o `start()` ainda não
   *  respondeu. Sem isto a tela mostrava o vazio nesse intervalo, agora que não
   *  há mais botão nenhum em repouso. */
  const opening = idle && autoStart && !busy && !error;
  /**
   * A dica embaixo da onda só aparece enquanto o microfone abre. Ela responde
   * "e depois, o que acontece?", e essa pergunta tem hora: depois que a
   * gravação começa, a resposta virou passado, e o lugar embaixo da onda passa
   * a ser dos avisos (saldo no fim, gravação interrompida, cópia local que
   * falhou). Por isso ela também cede a `error`: uma dica e um alerta
   * empilhados rebaixam o alerta.
   */
  const hinting = opening && !depleted;

  useUnloadGuard(capturing || interrupted || busy);

  /**
   * **Esta tela não é um destino.** Sem `?auto=1` ninguém PEDIU para gravar:
   * quem chegou aqui veio por um caminho que não é o botão de criar (a
   * notificação de uma aba morta, o atalho da tela offline, o histórico, o app
   * restaurado pelo sistema na última rota). A resposta certa é a Biblioteca,
   * que é onde uma gravação que ficou para trás está esperando como cartão.
   *
   * Ver o cabeçalho: era este o caminho pelo qual alguém tocava no microfone do
   * meio da tela e começava uma segunda gravação por cima da primeira.
   */
  useEffect(() => {
    if (autoStart) return;
    router.replace("/home");
  }, [autoStart, router]);

  /**
   * A resposta de "há gravação viva NESTA aba?", que mora num store porque quem
   * pergunta está fora desta árvore (ver `features/session/recording-store.ts`).
   *
   * **Ninguém escrevia nele**, e as duas proteções que ele sustenta estavam
   * mortas há tempos: a fila subia uma gravação antiga de 7 MB no meio de uma
   * pregação ao vivo (`kick()` lê este booleano), e o `BillingDialog` abria o
   * checkout NA MESMA ABA quando o pop-up era bloqueado, destruindo o
   * `MediaRecorder`. O segundo é o pior dos dois, porque a tela oferece comprar
   * moedas exatamente quando o saldo acaba no meio da gravação.
   *
   * `busy` entra junto: o envio já não tem microfone aberto, mas continua sendo
   * trabalho desta aba que uma navegação interromperia.
   */
  const setRecordingLive = useRecordingStore((s) => s.setRunning);
  useEffect(() => {
    setRecordingLive(capturing || interrupted || busy);
  }, [capturing, interrupted, busy, setRecordingLive]);
  useEffect(() => () => setRecordingLive(false), [setRecordingLive]);

  /**
   * O pulso da linha da gravação, com relógio próprio.
   *
   * Ele vale para o que o fragmento não cobre: a pausa e a interrupção, em que
   * não entra áudio nenhum e o pulso do `onFragment` simplesmente não acontece.
   * Sem ele, uma gravação parada por mais que o `STALE_OPEN_MS` da fila passa a
   * ser lida como abandonada. Ver `HEARTBEAT_MS`.
   */
  useEffect(() => {
    if (!capturing && !interrupted) return;
    const timer = window.setInterval(() => {
      const id = captureIdRef.current;
      if (id) void patchCaptureMeta(id, { heartbeatAt: Date.now() });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [capturing, interrupted]);

  // A onda tem um tamanho só, gravando ou em repouso. Ela já encolheu para dar
  // lugar à bancada (as três ferramentas do lado); hoje elas são camadas
  // flutuantes fora do fluxo (ver `RecordingWorkbench`), e não sobra mais
  // ninguém para essa folga defender — a tela fica limpa com a onda no
  // tamanho de sempre. O efeito continua existindo para DEFLACIONAR as barras
  // ao sair da gravação: sem ele, parar no meio de um pico deixava a onda
  // congelada alta enquanto a tela voltava ao repouso.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `capturing` e `interrupted` não são LIDOS pelo efeito, e são dependência de propósito — o gatilho é a TRANSIÇÃO (parar de gravar), não o valor.
  useEffect(() => {
    for (const bar of barsRef.current) {
      if (bar) bar.style.height = `${waveRef.current.base}px`;
    }
  }, [capturing, interrupted]);

  /**
   * A gravação vista de FORA da aba: a notificação do sistema quando o app é
   * minimizado, os controles da tela de bloqueio e a faixa silenciosa que
   * impede o navegador de congelar a aba. Ver `useRecordingPresence`.
   *
   * O "retomar" de lá passa pela MESMA guarda do botão da tela: com as moedas
   * no fim, a tela de bloqueio não pode religar um microfone que esta tela se
   * recusa a religar.
   */
  useRecordingPresence({
    // A interrupção entra como ATIVA e PAUSADA: a gravação não acabou (o áudio
    // está no disco e o "Retomar" está a um toque), e a notificação passa a
    // dizer que o Scriba não está gravando agora, que é a verdade. Deixá-la
    // fora daqui apagaria a notificação e a faixa que mantém a aba acordada
    // justamente no instante em que a pessoa mais precisa voltar ao app.
    active: capturing || interrupted,
    paused: state === "paused" || interrupted,
    onPause: pause,
    onResume: () => {
      if (depleted) return;
      // O "tocar" da tela de bloqueio é o mesmo gesto do botão da tela, e
      // depois de uma interrupção retomar quer dizer reabrir o microfone.
      if (interrupted) void recover();
      else resume();
    },
    onStop: () => void finish(),
  });

  // O relógio corre gravando, congela na pausa E na interrupção, e some ao
  // voltar ao repouso. Congelar é o ponto: enquanto ele corria sobre uma
  // gravação morta, ele era a própria afirmação falsa que esta tela passou a
  // existir para não fazer.
  useEffect(() => {
    setRunning(state === "recording");
    if (capturing || interrupted) setVisible(true);
    else if (idle && !busy) setVisible(false);
  }, [state, capturing, interrupted, idle, busy, setRunning, setVisible]);

  useCoinTick({
    enabled: state === "recording",
    reason: "recording_minute",
    sessionId: null,
    onDepleted: () => {
      setDepleted(true);
      pause();
    },
  });

  /**
   * Garante que a LINHA da sessão exista no banco, e devolve o id.
   *
   * Quem chama é a bancada, na PRIMEIRA pergunta ao Biblo — uma conversa
   * precisa de uma sessão a que se ancorar, e não há como perguntar sobre a
   * pregação que está acontecendo sem ela. Quem grava e nunca abre aquela aba
   * (que é a maioria) não paga ida ao servidor nenhuma aqui: a linha nasce no
   * envio, como sempre nasceu.
   *
   * O id vai no corpo, e é o mesmo que já está gravado na linha da gravação
   * desde o primeiro segundo. `POST /api/sessions` com um id que já é seu
   * devolve o mesmo id em vez de recusar, então uma segunda chamada — desta
   * tela ou do `uploadCapture` no fim — não cria uma segunda sessão.
   *
   * **Gravar continua sem depender de rede**: uma falha aqui devolve `null`, a
   * aba de conversa diz que está sem internet, e o resto da tela segue.
   */
  const ensureSession = useCallback(async (): Promise<string | null> => {
    const id = sessionIdRef.current;
    if (!id) return null;
    if (sessionSavedRef.current) return id;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, mode: "audio" }),
      });
      if (!res.ok) return null;
      sessionSavedRef.current = true;
      return id;
    } catch {
      return null;
    }
  }, []);

  const begin = useCallback(async () => {
    // O toque em "gravar" é o único gesto do fluxo com um porquê visível para
    // pedir a permissão de notificar: a pessoa acabou de mandar gravar uma hora
    // de pregação. Não esperamos a resposta, gravar não depende dela.
    void askRecordingNotificationPermission();
    const picked = pickMime();
    const id = crypto.randomUUID();
    captureIdRef.current = id;
    // Os dois ids nascem juntos, e nenhum dos dois custa rede. Ver
    // `sessionIdRef`.
    const session = crypto.randomUUID();
    sessionIdRef.current = session;
    sessionSavedRef.current = false;
    setSessionId(session);
    // Uma gravação nova não herda as notas da anterior.
    useRecordingNotes.getState().reset();
    setPersisted(true);
    setError(null);

    // A linha ANTES do microfone abrir. `pickMime()` é determinístico, então o
    // contêiner escrito aqui é o mesmo que o `start()` vai escolher lá dentro;
    // sem mime não há gravação, e o `start()` recusa em seguida com a frase
    // certa. Ver o cabeçalho.
    const meta: CaptureMeta = {
      id,
      sessionId: session,
      mimeType: picked?.mime ?? "audio/webm",
      extension: picked?.extension ?? "webm",
      durationMs: 0,
      parts: 1,
      createdAt: Date.now(),
      attempts: 0,
      closed: false,
      heartbeatAt: Date.now(),
      failure: null,
      failureMessage: null,
      notes: null,
    };
    if (!(await putCaptureMeta(meta))) setPersisted(false);
    setCapturing(id);

    if (!(await start())) {
      captureIdRef.current = null;
      sessionIdRef.current = null;
      setSessionId(null);
      setCapturing(null);
      // Microfone negado não é gravação nenhuma: a linha que acabou de nascer
      // não tem um único byte atrás dela, e deixá-la viva encheria a Biblioteca
      // de cartões de zero segundo a cada permissão recusada.
      await deleteCapture(id);
      return;
    }
  }, [start, setError, setCapturing]);

  /**
   * Entrega a gravação à fila e acompanha a primeira tentativa.
   *
   * A resposta decide para onde a pessoa vai, e as duas saídas são igualmente
   * deliberadas: deu certo, o resumo; não deu, a Biblioteca, onde o cartão
   * amarelo da gravação está esperando com o motivo escrito nele. O que NÃO
   * existe mais é a terceira saída, a de ficar nesta tela com um erro e um
   * botão. Ver o cabeçalho.
   */
  const handOff = useCallback(
    async (meta: CaptureMeta) => {
      setSending(meta.id);
      track(meta);
      await run(meta.id, { force: true });
      const { done } = useCaptureQueue.getState();
      if (done?.captureId === meta.id) {
        router.replace(`/summary/${done.sessionId}`);
        return;
      }
      // `sending` NÃO é apagado aqui: a navegação é o que desmonta esta tela, e
      // limpar antes devolveria a tela por um quadro ao estado de quem acabou
      // de chegar para gravar, com o "Abrindo o microfone…" por cima de uma
      // gravação que acabou de ser entregue à fila.
      router.replace("/home");
    },
    [router, track, run]
  );

  async function finish() {
    const id = captureIdRef.current;
    const result = await stop();
    // `null` aqui quer dizer que o gravador nunca chegou a existir (o `start()`
    // falhou). Uma gravação INTERROMPIDA não cai neste caminho: o `stop()`
    // devolve normalmente o que foi gravado até a interrupção, porque os
    // fragmentos já estão no disco. Ver o cabeçalho de `useAudioCapture`.
    if (!id || !result) {
      setError("Não deu tempo de gravar nada. Tente de novo.");
      return;
    }
    // Os fragmentos precisam estar no banco ANTES de a fila remontar o arquivo.
    await Promise.allSettled([...writesRef.current]);
    captureIdRef.current = null;
    setCapturing(null);

    const meta = await patchCaptureMeta(id, {
      closed: true,
      durationMs: result.durationMs,
      parts: result.parts,
      mimeType: result.mimeType,
      extension: result.extension,
      heartbeatAt: Date.now(),
      notes: useRecordingNotes.getState().notes.trim() || null,
    });
    if (!meta) {
      // A linha sumiu (IndexedDB recusado desde o começo, aba anônima, cota).
      // Não há o que enviar nem o que resgatar, e prometer que está guardado
      // seria a mentira que este arquivo inteiro existe para não contar.
      setPersisted(false);
      setError(
        "Este navegador não deixou guardar a gravação, e não consigo enviá-la. Grave de novo por outro navegador."
      );
      return;
    }
    await handOff(meta);
  }

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void begin();
  }, [autoStart, begin]);

  // Nada de microfone aberto sem a fila saber: desmontar esta tela no meio de
  // uma gravação (o botão de voltar, uma navegação) tem de devolver o id, senão
  // a fila continua pulando uma gravação que ninguém mais está escrevendo.
  useEffect(() => () => setCapturing(null), [setCapturing]);

  const showingPhase = busy && uploading === sending && phase !== null;
  /** Do toque em parar até a navegação. A tela não oferece controle nenhum
   *  aqui: o gravador já fechou e o que resta é esperar. */
  const finishing = state === "stopping" || busy;

  // Sem `?auto=1` o efeito acima já está navegando para `/home`, e desenhar o
  // repouso aqui poria na tela, por um quadro, um "Tentar de novo" que não se
  // refere a erro nenhum.
  if (!autoStart) return null;

  return (
    <>
      {/* A tela é UMA cara só, gravando ou em repouso: a onda grande no meio
          de uma coluna centralizada, com a dica embaixo antes do primeiro
          toque. Ela já teve uma segunda cara — encolhia e subia para o topo
          para abrir espaço a uma bancada de três abas ao lado —, e essa
          bancada saiu (ver `RecordingWorkbench`): Notas, Biblo e Bíblia são
          hoje camadas flutuantes, fechadas por padrão, e não sobra mais nada
          disputando espaço com a onda. Quarenta minutos olhando treze
          barrinhas era a tela mais ociosa do produto; a resposta não é mais
          apertar a onda para caber uma bancada, é deixar as três ferramentas
          a um toque de distância sem custar um pixel da tela enquanto
          fechadas. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10">
        {/* A onda e a dica moram no MESMO bloco, e a dica é `absolute` dentro
              dele: a coluna está centralizada (`justify-center`), então qualquer
              coisa que entrasse no fluxo aqui empurraria a onda para cima — e a
              onda é o objeto em volta do qual esta tela foi desenhada. Fora do
              fluxo, ela pendura embaixo sem mover um pixel do que já estava. */}
        <div className="relative flex items-center justify-center">
          <div aria-hidden className="flex h-[168px] items-center justify-center gap-2 sm:gap-2.5">
            {Array.from({ length: WAVE_BARS }, (_, i) => (
              <span
                key={`bar-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: as barras são posições fixas, não dados
                  i
                }`}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className={cn(
                  "w-3.5 rounded-full bg-v2-wave transition-opacity duration-300 sm:w-4",
                  idle && !busy ? "opacity-15" : "opacity-50"
                )}
                style={{ height: "14px" }}
              />
            ))}
          </div>
          {hinting ? (
            /* A promessa que falta na tela mais silenciosa do produto: quem
               chega aqui vê uma onda apagada e um microfone, e nada diz o que
               acontece DEPOIS de parar. É a pergunta que decide se a pessoa
               deixa o aparelho gravando uma hora de pregação.

               Ela some no instante em que a gravação começa (`hinting`), e não
               fica esmaecendo por trás do que a tela tem a dizer: durante a
               pregação o lugar de baixo da onda é dos avisos que importam — o
               saldo que acabou, a cópia que não foi guardada —, e uma dica
               dividindo espaço com um alerta rebaixa o alerta.

               **`w-max` não é enfeite, é o que faz a pastilha ter largura.**
               Um elemento absoluto é medido pelo espaço que sobra no
               contêiner, e com `left-1/2` isso é METADE da fileira de barras —
               a frase quebrava em cinco linhas e a pastilha virava um ovo.
               `w-max` a faz medir pelo texto, e o `max-w` é quem decide onde
               ela quebra; `text-balance` reparte as duas linhas em vez de
               deixar uma palavra sozinha na segunda.

               A âncora é o CENTRO da onda mais 48px, e não a base da caixa
               dela: a caixa tem 168px de altura para as barras crescerem
               durante a pregação, e pendurar a dica lá embaixo a deixava
               flutuando a 84px de qualquer coisa. Ela só aparece com as barras
               em repouso, então não há altura de barra com que se preocupar. */
            <p className="pointer-events-none absolute top-1/2 left-1/2 mt-12 w-max max-w-[min(18rem,80vw)] -translate-x-1/2 text-balance rounded-2xl bg-v2-card px-4 py-2.5 text-center text-xs font-light leading-snug text-v2-ink-mute">
              Ao encerrar, o Scriba transcreve tudo e escreve o resumo para você.
            </p>
          ) : null}
        </div>

        {finishing ? (
          <div className="flex max-w-xs flex-col items-center gap-2 text-center">
            <p role="status" className="text-sm font-light text-v2-ink-soft">
              {showingPhase ? phaseLabel(phase, chunk) : "Guardando a gravação…"}
            </p>
            {/* A frase que tira o medo de fechar o app no meio do envio, e que
                só é honesta porque o áudio já está no disco antes de a primeira
                chamada sair. */}
            <p className="text-xs font-light text-v2-ink-mute">
              Sua gravação já está guardada neste aparelho. Se algo der errado agora, ela aparece na
              Biblioteca e o Scriba tenta de novo sozinho.
            </p>
          </div>
        ) : interrupted ? (
          /* A gravação parou sozinha. Duas frases: o que houve, e o que
             continua valendo. A segunda é a que importa, e ela é verdade porque
             os fragmentos estão no IndexedDB desde o primeiro minuto. Um erro
             de "Retomar" (o microfone que segue tomado) toma o lugar dela: ali
             a garantia já foi lida, e o que falta saber é por que o botão não
             funcionou. */
          <div className="flex max-w-xs flex-col items-center gap-2 text-center">
            <p role="alert" className="text-sm font-light text-v2-ink-soft">
              {INTERRUPTION_TEXT[interruptedBy ?? "recorder"]}
            </p>
            <p className="text-xs font-light text-v2-ink-mute">
              {error ??
                "O que você gravou até aqui está guardado. Retome para continuar na mesma gravação, ou pare para receber o resumo do que já foi dito."}
            </p>
          </div>
        ) : opening ? (
          <p role="status" className="max-w-xs text-center text-sm font-light text-v2-ink-soft">
            Abrindo o microfone…
          </p>
        ) : depleted ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-soft">
            Suas moedas acabaram e a gravação foi pausada. Você ainda pode parar e ficar com o
            resumo do que gravou até aqui.
          </p>
        ) : error ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-mute">
            {error}
          </p>
        ) : !persisted && capturing ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-mute">
            Este navegador não está guardando cópia da gravação. Ela existe só enquanto esta tela
            estiver aberta.
          </p>
        ) : null}
      </div>

      {/* As três ferramentas flutuantes só existem com o microfone aberto.
          Antes de começar, esta tela é um convite, e um convite com um disco
          de notas no canto é uma segunda coisa a decidir antes da única que
          importa. Elas moram FORA da coluna centralizada de propósito — são
          camadas `fixed`, decididamente fora da estrutura principal da tela
          (ver `RecordingWorkbench`). */}
      {capturing ? (
        <RecordingWorkbench sessionId={sessionId} ensureSession={ensureSession} />
      ) : null}

      {/* `pb-16` só GRAVANDO: é a folga que evita o botão de Apagar (à
          direita da fileira) encostar no disco do Biblo, e o de Pausar (à
          esquerda) no disco das Notas — os dois cantos de baixo que as três
          ferramentas flutuantes ocupam enquanto a gravação está aberta. Em
          repouso não há ferramenta nenhuma flutuando, e a folga extra seria
          só espaço morto sob o microfone. */}
      <div
        className={cn("flex flex-col items-center gap-6", (capturing || interrupted) && "pb-16")}
      >
        <div className="flex items-center justify-center gap-6">
          {/* **Não há botão de gravar aqui, e a ausência é o ponto.** Esta tela
              só é alcançável com `?auto=1`, ou seja, sempre a partir de um
              pedido explícito de gravar; sem ele o efeito lá em cima devolve a
              pessoa para a Biblioteca antes de qualquer pixel. O disco de
              microfone que morava no meio era o que transformava uma chegada
              acidental (a notificação que sobrou de uma aba morta, o histórico,
              o app restaurado pelo sistema) numa segunda gravação por cima da
              primeira. Ver o cabeçalho. */}
          {finishing || opening ? null : interrupted ? (
            <>
              <button
                type="button"
                onClick={() => void recover()}
                disabled={depleted}
                aria-label="Retomar a gravação"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute disabled:opacity-40"
              >
                <Play className="size-5 fill-current" strokeWidth={0} />
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                aria-label="Parar e receber o resumo"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Square className="size-8 fill-current" strokeWidth={0} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                aria-label="Apagar"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
              </button>
            </>
          ) : capturing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (state !== "paused") return pause();
                  if (depleted) return;
                  resume();
                }}
                disabled={state === "paused" && depleted}
                aria-label={state === "paused" ? "Retomar" : "Pausar"}
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                {state === "paused" ? (
                  <Play className="size-5 fill-current" strokeWidth={0} />
                ) : (
                  <Pause className="size-5 fill-current" strokeWidth={0} />
                )}
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                aria-label="Parar"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Square className="size-8 fill-current" strokeWidth={0} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                aria-label="Apagar"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
              </button>
            </>
          ) : (
            /* O único repouso que esta tela ainda tem: um start que falhou,
               quase sempre o microfone negado. São DOIS caminhos porque um
               deles pode não resolver: quem negou a permissão no diálogo do
               sistema precisa liberá-la nas configurações antes de "Tentar de
               novo" servir para alguma coisa, e ficar preso numa tela com um
               botão que não funciona é o defeito que esta pasta inteira existe
               para não ter. Eles são pastilhas de texto, e não o disco de 96px:
               aquele desenho é o do gravador, e aqui não há gravação nenhuma
               para comandar. */
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => void begin()}
                className="inline-flex items-center gap-2 rounded-full bg-v2-card px-5 py-2.5 text-sm font-light text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <MicGlyph className="size-4" />
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={() => router.replace("/home")}
                className="rounded-full px-4 py-2 text-xs font-light text-v2-ink-mute transition-colors hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                Voltar para a Biblioteca
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Apagar esta gravação?"
        description="O áudio gravado até aqui é descartado e nada é salvo. Não dá para desfazer."
        confirmLabel="Apagar"
        onConfirm={async () => {
          discard();
          const id = captureIdRef.current;
          // A linha da sessão só existe se alguém perguntou algo ao Biblo
          // durante a pregação (ver `ensureSession`); no caminho comum não há
          // o que apagar, e um DELETE ali seria uma ida ao servidor para
          // descobrir isso. Quando ela existe, apagar o áudio sem apagá-la
          // deixaria no banco uma sessão vazia que nenhuma tela mostra e que
          // ninguém nunca vai encerrar.
          const session = sessionSavedRef.current ? sessionIdRef.current : null;
          captureIdRef.current = null;
          sessionIdRef.current = null;
          sessionSavedRef.current = false;
          setSessionId(null);
          setCapturing(null);
          if (id) await deleteCapture(id);
          if (session) {
            await fetch(`/api/sessions/${session}`, { method: "DELETE" }).catch(() => {});
          }
          router.push("/home");
        }}
      />
    </>
  );
}
