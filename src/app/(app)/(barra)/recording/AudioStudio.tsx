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
import { pickMime } from "@/lib/audio-constraints";
import { cn } from "@/lib/utils";
import { useClockScope } from "./ClockScope";
import { RecordingWorkbench } from "./RecordingWorkbench";
import { useRecordingNotes } from "./recording-notes";
import { useAudioCapture, WAVE_BARS } from "./useAudioCapture";
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
 * ## O que ainda NÃO faz
 *
 * Começar sem internet. A gravação em si não depende de rede, mas a sessão
 * nasce de um `POST` no stop; sem ele o áudio fica guardado e esperando, que
 * hoje é uma espera com cartão, aviso e retentativa, mas ainda não é o mesmo
 * que funcionar offline.
 */
const PHASE_LABEL = {
  creating: "Guardando a gravação…",
  transcribing: "Transcrevendo o áudio…",
  summarizing: "Montando o resumo…",
} as const;

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
   * A ref é a verdade (ela é lida por callbacks que não repintam), e o estado
   * existe só para a bancada saber que ela chegou. São DOIS porque a linha
   * nasce no meio de uma gravação que já está correndo: um estado sozinho não
   * serviria ao `ensureSession`, que precisa responder na hora se já existe.
   */
  const sessionIdRef = useRef<string | null>(null);
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

  /** A gravação que ESTA tela entregou à fila e está acompanhando. Enquanto
   *  ela existe, a tela mostra o passo do envio em vez dos controles. */
  const [sending, setSending] = useState<string | null>(null);

  /**
   * A geometria da onda, numa REF e não numa prop.
   *
   * A onda tem dois tamanhos: a grande da tela em repouso, que é o objeto em
   * volta do qual esta tela foi desenhada, e a fina de quando a bancada está
   * aberta embaixo dela — ali a onda vira a confirmação de que o microfone
   * está vivo, e 168px dela seriam metade da tela do celular gastos num
   * indicador. A ref existe porque `paintLevels` roda a 60 quadros por
   * segundo: recriá-la a cada troca de tamanho recriaria o callback, e com ele
   * o `useAudioCapture` inteiro.
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

  const { state, error, setError, start, pause, resume, stop, discard } = useAudioCapture({
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
          // existem para o caso em que o `stop()` NUNCA acontece: o pulso diz à
          // fila que esta gravação ainda está viva (e que ela não deve subi-la
          // de outra aba), e a duração é o que sobra para a tela mostrar se a
          // aba morrer no meio. Um `stop()` normal reescreve os dois com o
          // valor exato dois minutos depois, no máximo.
          const elapsed = startedAtRef.current > 0 ? performance.now() - startedAtRef.current : 0;
          await patchCaptureMeta(id, {
            heartbeatAt: Date.now(),
            durationMs: Math.max(0, Math.round(elapsed)),
            parts: part + 1,
            // As notas vão junto do pulso, e por isso a cada 2 minutos: é o que
            // sobra delas se a aba morrer no meio da pregação. `getState()` e
            // não um seletor — assinar o texto aqui repintaria o gravador a
            // cada tecla (ver `recording-notes.ts`).
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
  /**
   * A dica embaixo da onda só aparece na tela EM REPOUSO, antes do primeiro
   * toque. Ela responde "e depois, o que acontece?", e essa pergunta tem hora:
   * depois que a gravação começa, a resposta virou passado, e o lugar embaixo da
   * onda passa a ser dos avisos (saldo no fim, cópia local que falhou). Por isso
   * ela também cede a `error`: uma dica e um alerta empilhados rebaixam o
   * alerta.
   */
  const hinting = idle && !busy && !depleted && !error;

  useUnloadGuard(capturing || busy);

  // Gravando, a onda encolhe para dar a tela à bancada. Ver `waveRef`.
  useEffect(() => {
    waveRef.current = capturing ? { base: 8, span: 56 } : { base: 14, span: 154 };
    for (const bar of barsRef.current) {
      if (bar) bar.style.height = `${waveRef.current.base}px`;
    }
  }, [capturing]);

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
    active: capturing,
    paused: state === "paused",
    onPause: pause,
    onResume: () => {
      if (!depleted) resume();
    },
    onStop: () => void finish(),
  });

  // O relógio corre gravando, congela na pausa e some ao voltar ao repouso.
  useEffect(() => {
    setRunning(state === "recording");
    if (capturing) setVisible(true);
    else if (idle && !busy) setVisible(false);
  }, [state, capturing, idle, busy, setRunning, setVisible]);

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
   * Cria a linha da sessão, se ela ainda não existe, e devolve o id.
   *
   * **Ela é criada DURANTE a gravação, e não no stop como sempre foi.** O que
   * mudou foi o Biblo entrar nesta tela: uma conversa precisa de uma sessão a
   * que se ancorar, e não há como perguntar sobre a pregação que está
   * acontecendo sem ela. O id é gravado na linha da gravação no mesmo gesto,
   * então o `uploadCapture` a REUSA no fim em vez de criar uma segunda — é o
   * mesmo campo que já existia para a retentativa não espalhar sessões vazias
   * pelo banco.
   *
   * **Gravar continua sem depender de rede.** Esta chamada é disparada sem
   * `await` e falha em silêncio: sem ela a aba de conversa diz que está sem
   * internet, e o resto da tela não sabe que ela existiu.
   */
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "audio" }),
      });
      if (!res.ok) return null;
      const raw = (await res.json()) as { id?: string };
      if (!raw?.id) return null;
      sessionIdRef.current = raw.id;
      setSessionId(raw.id);
      const captureId = captureIdRef.current;
      if (captureId) await patchCaptureMeta(captureId, { sessionId: raw.id });
      return raw.id;
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
    sessionIdRef.current = null;
    setSessionId(null);
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
      sessionId: null,
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
      setCapturing(null);
      // Microfone negado não é gravação nenhuma: a linha que acabou de nascer
      // não tem um único byte atrás dela, e deixá-la viva encheria a Biblioteca
      // de cartões de zero segundo a cada permissão recusada.
      await deleteCapture(id);
      return;
    }
    // A sessão da conversa, atrás. Sem `await`: a pregação já começou, e a
    // tela não espera o servidor para desenhar a onda.
    void ensureSession();
  }, [start, setError, setCapturing, ensureSession]);

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
      setSending(null);
      router.replace("/home");
    },
    [router, track, run]
  );

  async function finish() {
    const id = captureIdRef.current;
    const result = await stop();
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

  return (
    <>
      {/* A tela tem DUAS caras.

          Em repouso ela é o que sempre foi: a onda grande no meio de uma
          coluna centralizada, com a dica embaixo. Gravando, ela vira uma
          BANCADA — a onda encolhe e sobe para o topo, e embaixo dela entram as
          três ferramentas que correm ao lado da pregação (ver
          `RecordingWorkbench`). Quarenta minutos olhando treze barrinhas era
          a tela mais ociosa do produto justamente na hora em que a pessoa mais
          tem o que anotar e o que perguntar.

          No celular a onda fica GRUDADA no topo (`sticky`), que é o que
          permite rolar a conversa ou o capítulo sem perder de vista a
          confirmação de que o microfone continua aberto. No desktop não há por
          que grudar nada: a tela é larga, e as duas coisas ficam lado a lado,
          a onda à esquerda e a bancada à direita. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          capturing ? "gap-4 lg:flex-row lg:items-stretch lg:gap-8" : "gap-10"
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-10",
            capturing
              ? "sticky top-0 z-10 shrink-0 gap-4 bg-v2-bg py-2 lg:static lg:w-[22rem] lg:justify-center lg:py-0"
              : "flex-1"
          )}
        >
          {/* A onda e a dica moram no MESMO bloco, e a dica é `absolute` dentro
              dele: a coluna está centralizada (`justify-center`), então qualquer
              coisa que entrasse no fluxo aqui empurraria a onda para cima — e a
              onda é o objeto em volta do qual esta tela foi desenhada. Fora do
              fluxo, ela pendura embaixo sem mover um pixel do que já estava. */}
          <div className="relative flex items-center justify-center">
            <div
              aria-hidden
              className={cn(
                "flex items-center justify-center gap-2 sm:gap-2.5",
                capturing ? "h-[64px]" : "h-[168px]"
              )}
            >
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

          {busy ? (
            <div className="flex max-w-xs flex-col items-center gap-2 text-center">
              <p role="status" className="text-sm font-light text-v2-ink-soft">
                {showingPhase ? PHASE_LABEL[phase] : "Guardando a gravação…"}
              </p>
              {/* A frase que tira o medo de fechar o app no meio do envio, e que
                só é honesta porque o áudio já está no disco antes de a primeira
                chamada sair. */}
              <p className="text-xs font-light text-v2-ink-mute">
                Sua gravação já está guardada neste aparelho. Se algo der errado agora, ela aparece
                na Biblioteca e o Scriba tenta de novo sozinho.
              </p>
            </div>
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

        {/* A bancada só existe com o microfone aberto. Antes de começar, esta
            tela é um convite, e um bloco de notas ao lado de um convite é uma
            segunda coisa a decidir antes da única que importa. */}
        {capturing ? (
          <RecordingWorkbench sessionId={sessionId} ensureSession={ensureSession} />
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-6">
          {busy ? null : idle ? (
            <button
              type="button"
              onClick={() => void begin()}
              aria-label="Começar a gravar"
              data-tour="record-button"
              className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
            >
              <MicGlyph className="size-9" />
            </button>
          ) : (
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
          const session = sessionIdRef.current;
          captureIdRef.current = null;
          sessionIdRef.current = null;
          setSessionId(null);
          setCapturing(null);
          if (id) await deleteCapture(id);
          // A linha da sessão nasce durante a gravação, para a conversa ter
          // onde se ancorar (ver `ensureSession`). Apagar o áudio sem apagá-la
          // deixaria no banco uma sessão vazia que nenhuma tela mostra e que
          // ninguém nunca vai encerrar.
          if (session) {
            await fetch(`/api/sessions/${session}`, { method: "DELETE" }).catch(() => {});
          }
          router.push("/home");
        }}
      />
    </>
  );
}
