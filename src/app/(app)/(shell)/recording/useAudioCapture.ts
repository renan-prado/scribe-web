"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_CONSTRAINTS, pickMime, reportTrackSettings } from "@/lib/audio-constraints";
import { createLogger } from "@/lib/log";

const log = createLogger("recording");

/**
 * A captação do `/recording`: um arquivo, transcrito de uma vez só no fim.
 *
 * O gravador do app de hoje fatia em pedaços de 15-20s e transcreve CADA UM
 * durante a pregação, porque o feed ao vivo precisa do texto na hora. Aqui não
 * há feed, e fazer o mesmo custaria ~206 chamadas de transcrição por hora de
 * sermão para entregar exatamente o mesmo resumo.
 *
 * Então: um `MediaRecorder` só, e o fatiamento existe apenas para não PERDER o
 * áudio. Dois cortes diferentes, com propósitos diferentes:
 *
 * **Fragmento (30s): para não perder, e para PROVAR que ainda grava.**
 * `MediaRecorder.start(timeslice)` entrega um pedaço a cada 30 segundos, que
 * vai direto para o IndexedDB. O primeiro traz o cabeçalho e os seguintes são
 * continuação, então concatená-los em ordem devolve o arquivo original —
 * verificado: o concatenado decodifica inteiro, e um fragmento do meio sozinho
 * não decodifica.
 *
 * **Parte (~7 MB): para caber no POST.** `/api/transcribe` recusa acima de
 * 8 MB, o que a 24 kbps dá uns 46 minutos. Ao encostar no teto, o gravador é
 * ENCERRADO e outro começa — um gravador novo emite cabeçalho novo, e é isso
 * que faz a parte seguinte ser um arquivo válido por si. Uma pregação de 40
 * minutos é UMA parte e UMA chamada; uma de 60 minutos são duas.
 *
 * A troca de parte espera um silêncio (com teto de 30s), para a emenda entre
 * duas transcrições não cair no meio de uma palavra.
 *
 * 24 kbps em opus: o padrão do navegador fica entre 48 e 128, e fala em 24 kbps
 * é transcrita igual — o que muda é o tamanho do upload de quem está no dado
 * móvel da igreja.
 *
 * ## A gravação pode PARAR sem ninguém mandar, e este hook precisa saber disso
 *
 * Esta é a correção central do arquivo, e ela nasceu de relatos de quem
 * minimizou o app: "a tela continua na gravação, mas não gravou nada". O
 * relógio da tela é `performance.now() - startedAt`, ou seja, tempo de PAREDE:
 * ele sobe igual com o microfone aberto, com o microfone tomado por outro app
 * e com o `MediaRecorder` morto. A tela afirmava, o tempo todo, uma coisa que
 * ela não tinha como saber.
 *
 * Num celular o microfone é tirado o tempo todo: uma ligação, um áudio do
 * WhatsApp, o assistente de voz, um fone bluetooth que conecta ou cai, e o
 * sistema matando a aba em segundo plano. Nenhuma dessas coisas é um erro do
 * app, e todas elas terminam a gravação.
 *
 * São três sensores, e eles se cobrem porque nenhum sozinho pega tudo:
 *
 * 1. **`MediaRecorder.onerror`**, quando o próprio gravador desiste.
 * 2. **`track.onended` / `track.onmute`**, quando o SISTEMA tira o microfone.
 *    `ended` é definitivo; `mute` é a interrupção que normalmente volta (a
 *    ligação que terminou), e por isso `unmute` é ouvido também: voltando
 *    sozinho antes de o watchdog reparar, ninguém precisa saber que houve.
 * 3. **O WATCHDOG do fragmento**, que é o que pega o que os dois de cima não
 *    reportam. O `ondataavailable` é o único sinal de vida que sobrevive à aba
 *    escondida (é evento do `MediaRecorder`, não um temporizador), então
 *    "quando chegou o último fragmento" é a ÚNICA prova de gravação que este
 *    arquivo tem. Passou de `FRAGMENT_STALL_MS` sem fragmento, a gravação
 *    parou, qualquer que tenha sido o motivo.
 *
 * É por isso que o fragmento caiu de 2 minutos para 30 segundos. O tamanho
 * total do áudio não muda (são os mesmos bytes em mais linhas do IndexedDB), e
 * compram-se duas coisas com isso: a prova de vida passa a valer para a tela, e
 * a janela de perda de uma aba morta cai de 2 minutos para 30 segundos.
 *
 * O estado resultante é `interrupted`, e ele NÃO é um erro terminal: o áudio
 * gravado até ali está no disco, `stop()` continua devolvendo tudo, e
 * `recover()` reabre o microfone numa PARTE nova (cabeçalho próprio, arquivo
 * válido por si — a mesma mecânica de `rotatePart`).
 */
export type CaptureState = "idle" | "recording" | "paused" | "interrupted" | "stopping";

/** Por que a gravação parou sozinha. É o que decide a frase da tela. */
export type InterruptReason = "device" | "recorder" | "stalled";

export const WAVE_BARS = 13;
const WAVE_BANDS = Math.ceil(WAVE_BARS / 2);
const WAVE_HZ_MIN = 80;
const WAVE_HZ_MAX = 8000;
const WAVE_EDGE_DROP = 0.6;
const envelopeAt = (d: number) => 1 - WAVE_EDGE_DROP * (d / (WAVE_BANDS - 1));

const AUDIO_BITS_PER_SECOND = 24_000;
/**
 * Um fragmento a cada 30 segundos. É a janela de perda E a batida do coração.
 *
 * Eram 2 minutos, quando o fragmento servia só para não perder áudio. Ele
 * passou a ser também a única prova de que a gravação está viva (ver o
 * cabeçalho), e 2 minutos é grosso demais para isso: a tela ficaria afirmando
 * uma gravação morta por até quatro minutos antes de o watchdog reparar.
 */
const FRAGMENT_MS = 30_000;
/**
 * Sem fragmento por tanto tempo, a gravação parou.
 *
 * Três vezes a cadência, mais uma folga. Três porque um fragmento pode atrasar
 * numa troca de parte ou num aparelho ocupado, e a folga porque o navegador
 * estrangula temporizador de aba escondida — o watchdog acorda tarde lá, e a
 * conta não pode ser apertada a ponto de o atraso do próprio relógio virar o
 * diagnóstico.
 */
const FRAGMENT_STALL_MS = FRAGMENT_MS * 3 + 15_000;
/** De quanto em quanto o watchdog acorda. Uma comparação de números. */
const STALL_CHECK_MS = 10_000;
/** Teto por parte, com folga sobre os 8 MB de `/api/transcribe`. */
const PART_MAX_BYTES = 7 * 1024 * 1024;
/**
 * O teto que não espera silêncio nenhum.
 *
 * O corte educado depende do `runLoop`, e o `runLoop` é um
 * `requestAnimationFrame` — que o navegador PARA quando a aba vai para segundo
 * plano, que é exatamente o que quem apoia o celular no banco faz durante a
 * pregação. Sem este segundo teto, a parte crescia sem limite pela hora inteira
 * e só era recusada no fim, na transcrição. Aqui o `ondataavailable` corta
 * sozinho: ele é um evento do `MediaRecorder`, e continua chegando com a aba
 * escondida.
 */
const PART_HARD_MAX_BYTES = 7.5 * 1024 * 1024;
/** Depois do teto, quanto esperamos por um silêncio antes de cortar à força. */
const PART_SILENCE_GRACE_MS = 30_000;
const SILENCE_RMS = 0.01;

type Options = {
  onLevels: (levels: Float32Array) => void;
  /** Um fragmento fechado, pronto para guardar. Chamado a cada ~30s. */
  onFragment: (f: { part: number; seq: number; blob: Blob }) => void;
  /**
   * A origem do relógio, ANCORADA: `agora - startedAtRef` é sempre o tempo
   * ativo de gravação, já sem o que passou pausado. Quem é dono dela é o
   * CHAMADOR, porque o relógio da tela mora na `TopBar`, fora deste hook (ver
   * `ClockScope`).
   */
  startedAtRef: React.RefObject<number>;
};

/** A frase de uma falha ao abrir o microfone. Vale para o start e para o
 *  `recover()`, que pedem o mesmo dispositivo pelo mesmo caminho. */
function micErrorMessage(err: unknown): string {
  return err instanceof DOMException &&
    (err.name === "NotAllowedError" || err.name === "SecurityError")
    ? "Sem permissão para usar o microfone. Libere o acesso no navegador e tente de novo."
    : "Não consegui abrir o microfone neste aparelho.";
}

export function useAudioCapture({ onLevels, onFragment, startedAtRef }: Options) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Por que parou sozinha. `null` fora do estado `interrupted`. */
  const [interruptedBy, setInterruptedBy] = useState<InterruptReason | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeRef = useRef<{ mime: string; extension: string } | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelsRef = useRef(new Float32Array(WAVE_BARS));

  const onLevelsRef = useRef(onLevels);
  onLevelsRef.current = onLevels;
  const onFragmentRef = useRef(onFragment);
  onFragmentRef.current = onFragment;

  const partRef = useRef(0);
  const seqRef = useRef(0);
  const partBytesRef = useRef(0);
  /** Quando passamos do teto e começamos a procurar um silêncio para cortar. */
  const rotateSinceRef = useRef<number | null>(null);
  const rotatingRef = useRef(false);
  /** A troca de parte em andamento. O `stop()` espera por ela antes de encerrar
   *  o gravador: parar no meio de uma rotação era o caminho para uma `Promise`
   *  que nunca resolvia e um botão de parar sem efeito. Ver `stop()`. */
  const rotationRef = useRef<Promise<void> | null>(null);
  /** O `stop()` começou. É o que impede a rotação de abrir uma parte nova que
   *  nasceria vazia e ainda assim seria contada. */
  const stoppingRef = useRef(false);
  /** `rotatePart` nasce depois de `spawnRecorder` e chama de volta para ele.
   *  A ref é o que quebra o ciclo sem duplicar a função. */
  const rotatePartRef = useRef<() => void>(() => {});

  /** Hora do último fragmento, em tempo de parede. A prova de vida. */
  const lastFragmentAtRef = useRef(0);
  /** A gravação parou sozinha. Ref porque callbacks fora do React a leem. */
  const interruptedRef = useRef(false);
  /** O relógio está parado? (pausa ou interrupção). Ver `stop()`. */
  const frozenRef = useRef(false);
  /** `interrupt` é chamado de dentro do `spawnRecorder` e do `runLoop`, que
   *  nascem antes dele. Mesma técnica do `rotatePartRef`. */
  const interruptRef = useRef<(reason: InterruptReason) => void>(() => {});

  /** Tempo ativo acumulado até a última pausa. Enquanto grava, o tempo real é
   * `agora - startedAtRef`; pausado, é este valor. */
  const accumulatedRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  /** Fecha o microfone e a análise, sem tocar no relógio. É o pedaço que a
   *  interrupção reaproveita: lá o tempo gravado até ali ainda importa. */
  const closeMic = useCallback(() => {
    stopLoop();
    for (const t of streamRef.current?.getTracks() ?? []) {
      t.onended = null;
      t.onmute = null;
      t.onunmute = null;
      t.stop();
    }
    streamRef.current = null;
    analyserRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
  }, [stopLoop]);

  const releaseAll = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) {
      rec.ondataavailable = null;
      rec.onerror = null;
      rec.onstop = null;
    }
    recorderRef.current = null;
    closeMic();
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    rotateSinceRef.current = null;
    rotatingRef.current = false;
    rotationRef.current = null;
    stoppingRef.current = false;
    interruptedRef.current = false;
    frozenRef.current = false;
    lastFragmentAtRef.current = 0;
  }, [closeMic, startedAtRef]);

  useEffect(() => releaseAll, [releaseAll]);

  /**
   * A gravação parou sozinha.
   *
   * Ela CONGELA em vez de encerrar: os fragmentos já estão no IndexedDB, e o
   * `stop()` continua devolvendo tudo o que foi gravado até aqui. O microfone é
   * fechado de verdade porque, nos três motivos, ele já não está entregando
   * áudio — e um `MediaStream` morto segurado por uma ref é o que impediria o
   * `recover()` de pedir um novo.
   */
  const interrupt = useCallback(
    (reason: InterruptReason) => {
      if (interruptedRef.current || stoppingRef.current) return;
      interruptedRef.current = true;
      if (!frozenRef.current && startedAtRef.current > 0) {
        accumulatedRef.current = Math.max(0, performance.now() - startedAtRef.current);
      }
      frozenRef.current = true;

      const rec = recorderRef.current;
      if (rec) {
        rec.onerror = null;
        // O `stop()` do gravador emite o resto do buffer como último fragmento
        // antes do `onstop`, então este pedido resgata os segundos que ainda
        // não tinham virado fragmento. O `onstop` é desligado porque não há
        // parte nova para abrir.
        rec.onstop = null;
        if (rec.state !== "inactive") {
          try {
            rec.stop();
          } catch {
            // Gravador que já tinha morrido por conta própria: não há o que
            // resgatar, e o que já virou fragmento continua no disco.
          }
        }
      }
      recorderRef.current = null;
      closeMic();
      setInterruptedBy(reason);
      setState("interrupted");
      log.warn("gravação interrompida", {
        reason,
        elapsedMs: Math.round(accumulatedRef.current),
        parts: partRef.current + 1,
      });
    },
    [closeMic, startedAtRef]
  );
  interruptRef.current = interrupt;

  /** Liga um `MediaRecorder` na parte atual. */
  const spawnRecorder = useCallback(() => {
    const stream = streamRef.current;
    const picked = mimeRef.current;
    if (!stream || !picked) return;
    const rec = new MediaRecorder(stream, {
      mimeType: picked.mime,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    const part = partRef.current;
    rec.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      // A prova de vida, e ela é atualizada ANTES de qualquer outra coisa: é o
      // único sinal que sobrevive à aba escondida. Ver o cabeçalho.
      lastFragmentAtRef.current = Date.now();
      partBytesRef.current += event.data.size;
      onFragmentRef.current({ part, seq: seqRef.current, blob: event.data });
      seqRef.current += 1;
      if (partBytesRef.current >= PART_HARD_MAX_BYTES) {
        // Segundo plano: o `runLoop` está parado e ninguém vai procurar o
        // silêncio. Corta aqui mesmo. Ver `PART_HARD_MAX_BYTES`.
        rotatePartRef.current();
      } else if (partBytesRef.current >= PART_MAX_BYTES && rotateSinceRef.current === null) {
        rotateSinceRef.current = performance.now();
      }
    };
    // O gravador desistindo é o sensor mais direto dos três, e era o que não
    // existia: sem ele, a tela seguia com o relógio correndo sobre um
    // `MediaRecorder` morto.
    rec.onerror = () => interruptRef.current("recorder");
    rec.start(FRAGMENT_MS);
    recorderRef.current = rec;
  }, []);

  /**
   * Fecha a parte atual e abre a próxima. O `stop()` faz o gravador emitir o
   * resto do buffer como último fragmento desta parte; o gravador novo nasce
   * com cabeçalho próprio, e é isso que torna a parte seguinte um arquivo
   * válido sozinho.
   *
   * A `Promise` guardada em `rotationRef` existe para o `stop()`: sem ela,
   * apertar parar no instante da troca pegava um gravador já inativo, o
   * `rec.stop()` lançava `InvalidStateError` de dentro de uma `Promise` que
   * ninguém rejeitava, e o botão de parar simplesmente não fazia nada.
   */
  const rotatePart = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rotatingRef.current || rec.state === "inactive") return;
    rotatingRef.current = true;
    let settle = () => {};
    rotationRef.current = new Promise<void>((resolve) => {
      settle = resolve;
    });
    rec.onstop = () => {
      rotatingRef.current = false;
      // Parar no meio de uma troca não abre parte nova: ela nasceria sem um
      // único fragmento dentro e ainda assim entraria na contagem de `parts`.
      if (stoppingRef.current || interruptedRef.current) {
        settle();
        return;
      }
      partRef.current += 1;
      seqRef.current = 0;
      partBytesRef.current = 0;
      rotateSinceRef.current = null;
      lastFragmentAtRef.current = Date.now();
      spawnRecorder();
      settle();
    };
    try {
      rec.stop();
    } catch {
      rotatingRef.current = false;
      settle();
    }
  }, [spawnRecorder]);
  rotatePartRef.current = rotatePart;

  const runLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
    const edges: number[] = [];
    for (let b = 0; b <= WAVE_BANDS; b++) {
      const hz = WAVE_HZ_MIN * (WAVE_HZ_MAX / WAVE_HZ_MIN) ** (b / WAVE_BANDS);
      edges.push(Math.min(bins.length - 1, Math.round(hz / hzPerBin)));
    }
    const band = new Float32Array(WAVE_BANDS);
    const center = (WAVE_BARS - 1) / 2;

    const frame = () => {
      analyser.getByteFrequencyData(bins);
      for (let b = 0; b < WAVE_BANDS; b++) {
        const from = edges[b];
        const to = Math.max(from + 1, edges[b + 1]);
        let sum = 0;
        for (let j = from; j < to; j++) sum += bins[j];
        band[b] = (sum / (to - from) / 255) ** 0.7 * envelopeAt(b);
      }
      const levels = levelsRef.current;
      for (let i = 0; i < WAVE_BARS; i++) {
        const target = band[Math.round(Math.abs(i - center))];
        const prev = levels[i];
        levels[i] = prev + (target - prev) * (target > prev ? 0.55 : 0.18);
      }
      onLevelsRef.current(levels);

      // Passou do teto da parte: corta no primeiro silêncio, ou na força
      // depois da carência. O mesmo analyser da onda responde isso de graça.
      const since = rotateSinceRef.current;
      if (since !== null && !rotatingRef.current) {
        analyser.getByteTimeDomainData(time);
        let sq = 0;
        for (let i = 0; i < time.length; i++) {
          const v = (time[i] - 128) / 128;
          sq += v * v;
        }
        const rms = Math.sqrt(sq / time.length);
        if (rms < SILENCE_RMS || performance.now() - since > PART_SILENCE_GRACE_MS) {
          rotatePart();
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [rotatePart]);

  /**
   * Abre o microfone e a análise. Chamado pelo `start()` e pelo `recover()`,
   * que pedem exatamente o mesmo dispositivo — o segundo depois de o sistema
   * ter tirado o primeiro.
   *
   * Os três ouvintes da trilha são o sensor que o `MediaRecorder` não tem: ele
   * não é avisado quando o SISTEMA leva o microfone embora, ele simplesmente
   * passa a gravar silêncio ou nada.
   */
  const openMic = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
      // Algumas WebViews recusam o objeto de constraints inteiro em vez de
      // ignorar o que não conhecem.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw err;
      }
    }
    streamRef.current = stream;
    // Constraint é PEDIDO, não garantia: sem este log, uma gravação sai
    // processada e nada no código diz que saiu. Ver `lib/audio-constraints.ts`.
    reportTrackSettings(stream);

    for (const track of stream.getAudioTracks()) {
      // `ended` é definitivo: o dispositivo sumiu (o fone bluetooth caiu, outro
      // app tomou o microfone para si).
      track.onended = () => interruptRef.current("device");
      // `mute` costuma ser temporário — a ligação que entrou. Não derrubamos a
      // gravação na hora: `unmute` a devolve sem ninguém ficar sabendo, e se
      // ela não voltar é o watchdog do fragmento que repara.
      track.onmute = () => log.warn("microfone silenciado pelo sistema");
      track.onunmute = () => log.info("microfone devolvido pelo sistema");
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    // NÃO conectar ao destination: microfone na saída do alto-falante é
    // microfonia.
    source.connect(analyser);
    analyserRef.current = analyser;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    setInterruptedBy(null);
    const picked = pickMime();
    if (!picked) {
      setError("Este navegador não grava áudio. Tente pelo Chrome, Safari ou Edge.");
      log.warn("navegador sem contêiner de áudio suportado");
      return false;
    }
    mimeRef.current = picked;
    try {
      await openMic();

      partRef.current = 0;
      seqRef.current = 0;
      partBytesRef.current = 0;
      rotateSinceRef.current = null;
      rotatingRef.current = false;
      rotationRef.current = null;
      stoppingRef.current = false;
      interruptedRef.current = false;
      frozenRef.current = false;
      lastFragmentAtRef.current = Date.now();
      spawnRecorder();

      accumulatedRef.current = 0;
      startedAtRef.current = performance.now();
      setState("recording");
      runLoop();
      log.info("gravação iniciada", { mimeType: picked.mime });
      return true;
    } catch (err) {
      releaseAll();
      setState("idle");
      setError(micErrorMessage(err));
      log.warn("falha ao abrir o microfone", { error: String(err) });
      return false;
    }
  }, [openMic, releaseAll, runLoop, spawnRecorder, startedAtRef]);

  /**
   * Reabre o microfone depois de uma interrupção, numa PARTE nova.
   *
   * Parte nova e não continuação: o gravador anterior morreu e o stream dele
   * também, então o que vem agora precisa do próprio cabeçalho de contêiner
   * para ser um arquivo válido sozinho. É a mesma mecânica de `rotatePart`, com
   * a diferença de que aqui o corte não foi escolhido por nós.
   *
   * O relógio continua de onde parou: o tempo ativo até a interrupção foi
   * guardado em `accumulatedRef`, e a origem recua por ele.
   */
  const recover = useCallback(async (): Promise<boolean> => {
    if (!interruptedRef.current || !mimeRef.current) return false;
    setError(null);
    try {
      await openMic();
    } catch (err) {
      setError(micErrorMessage(err));
      log.warn("falha ao retomar depois da interrupção", { error: String(err) });
      return false;
    }
    partRef.current += 1;
    seqRef.current = 0;
    partBytesRef.current = 0;
    rotateSinceRef.current = null;
    rotatingRef.current = false;
    rotationRef.current = null;
    interruptedRef.current = false;
    frozenRef.current = false;
    lastFragmentAtRef.current = Date.now();
    spawnRecorder();
    startedAtRef.current = performance.now() - accumulatedRef.current;
    setInterruptedBy(null);
    setState("recording");
    runLoop();
    log.info("gravação retomada depois da interrupção", { part: partRef.current });
    return true;
  }, [openMic, runLoop, spawnRecorder, startedAtRef]);

  /**
   * O watchdog do fragmento: o sensor que pega o que os outros dois não
   * reportam (a aba congelada, o gravador que ficou vivo sem entregar áudio).
   *
   * Ele só existe GRAVANDO — pausado não chegam fragmentos, e o relógio de
   * parede acusaria uma pausa longa como gravação morta. O `visibilitychange`
   * está aqui porque o navegador estrangula temporizador de aba escondida: o
   * intervalo acorda tarde lá, e a volta para o app é o instante em que a
   * resposta mais importa.
   */
  useEffect(() => {
    if (state !== "recording") return;
    const check = () => {
      const last = lastFragmentAtRef.current;
      if (last > 0 && Date.now() - last > FRAGMENT_STALL_MS) {
        interruptRef.current("stalled");
      }
    };
    const timer = window.setInterval(check, STALL_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  const pause = useCallback(() => {
    stopLoop();
    recorderRef.current?.pause();
    // A trilha continua VIVA, só muda: desligá-la devolveria o microfone ao
    // sistema, e retomar pediria a permissão de novo.
    for (const t of streamRef.current?.getAudioTracks() ?? []) t.enabled = false;
    accumulatedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    frozenRef.current = true;
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
    setState("paused");
  }, [stopLoop, startedAtRef]);

  const resume = useCallback(() => {
    for (const t of streamRef.current?.getAudioTracks() ?? []) t.enabled = true;
    recorderRef.current?.resume();
    // Recua a origem pelo que já foi gravado: assim o relógio continua de onde
    // parou em vez de voltar para zero.
    startedAtRef.current = performance.now() - accumulatedRef.current;
    frozenRef.current = false;
    // Pausado não chegam fragmentos, e a espera da pausa não é sinal de nada:
    // sem este acerto, retomar depois de cinco minutos parados acusaria a
    // gravação como morta no primeiro giro do watchdog.
    lastFragmentAtRef.current = Date.now();
    setState("recording");
    runLoop();
  }, [runLoop, startedAtRef]);

  /** Encerra e devolve duração ativa, número de partes e o contêiner usado. */
  const stop = useCallback(async (): Promise<{
    durationMs: number;
    parts: number;
    mimeType: string;
    extension: string;
  } | null> => {
    const picked = mimeRef.current;
    // Sem contêiner escolhido, nem o `start()` chegou a acontecer.
    if (!picked) return null;
    stoppingRef.current = true;
    setState("stopping");
    stopLoop();

    // O relógio parado (pausa ou interrupção) já tem o tempo ativo guardado;
    // correndo, ele é a distância até a origem. Ler `recorder.state` aqui, como
    // se fazia, dava a resposta errada no meio de uma troca de parte, quando o
    // gravador está inativo por um instante e a gravação não parou.
    const durationMs = frozenRef.current
      ? accumulatedRef.current
      : startedAtRef.current > 0
        ? performance.now() - startedAtRef.current
        : accumulatedRef.current;

    // Uma troca de parte em curso precisa terminar antes: ela é quem sabe se o
    // gravador atual ainda é o que estava gravando. Ver `rotatePart`.
    await rotationRef.current?.catch(() => {});

    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      // Espera o `onstop`: é ele que entrega o resto do buffer como último
      // fragmento. Seguir antes deixaria o fim da pregação fora do arquivo.
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
    }

    const parts = partRef.current + 1;
    releaseAll();
    setState("idle");
    setInterruptedBy(null);
    const result = {
      durationMs: Math.round(Math.max(0, durationMs)),
      parts,
      mimeType: picked.mime,
      extension: picked.extension,
    };
    log.info("gravação encerrada", result);
    return result;
  }, [releaseAll, stopLoop, startedAtRef]);

  /** Joga fora: o microfone fecha e nada do que ficou vira arquivo. */
  const discard = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onerror = null;
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        // já tinha morrido
      }
    }
    releaseAll();
    setState("idle");
    setInterruptedBy(null);
    setError(null);
  }, [releaseAll]);

  return {
    state,
    error,
    setError,
    interruptedBy,
    start,
    pause,
    resume,
    recover,
    stop,
    discard,
  };
}
