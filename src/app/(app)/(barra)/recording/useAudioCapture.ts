"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_CONSTRAINTS, pickMime, reportTrackSettings } from "@/lib/audio-constraints";

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
 * **Fragmento (2 min): para não perder.** `MediaRecorder.start(timeslice)`
 * entrega um pedaço a cada 2 minutos, que vai direto para o IndexedDB. O
 * primeiro traz o cabeçalho e os seguintes são continuação, então concatená-los
 * em ordem devolve o arquivo original — verificado: o concatenado decodifica
 * inteiro, e um fragmento do meio sozinho não decodifica. A aba morrer custa,
 * no pior caso, os 2 minutos do fragmento aberto.
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
 */
export type CaptureState = "idle" | "recording" | "paused" | "stopping";

export const WAVE_BARS = 13;
const WAVE_BANDS = Math.ceil(WAVE_BARS / 2);
const WAVE_HZ_MIN = 80;
const WAVE_HZ_MAX = 8000;
const WAVE_EDGE_DROP = 0.6;
const envelopeAt = (d: number) => 1 - WAVE_EDGE_DROP * (d / (WAVE_BANDS - 1));

const AUDIO_BITS_PER_SECOND = 24_000;
/** Um fragmento a cada 2 minutos. É a janela de perda, não a de transcrição. */
const FRAGMENT_MS = 120_000;
/** Teto por parte, com folga sobre os 8 MB de `/api/transcribe`. */
const PART_MAX_BYTES = 7 * 1024 * 1024;
/** Depois do teto, quanto esperamos por um silêncio antes de cortar à força. */
const PART_SILENCE_GRACE_MS = 30_000;
const SILENCE_RMS = 0.01;

type Options = {
  onLevels: (levels: Float32Array) => void;
  /** Um fragmento fechado, pronto para guardar. Chamado a cada ~2 min. */
  onFragment: (f: { part: number; seq: number; blob: Blob }) => void;
  /**
   * A origem do relógio, ANCORADA: `agora - startedAtRef` é sempre o tempo
   * ativo de gravação, já sem o que passou pausado. Quem é dono dela é o
   * CHAMADOR, porque o relógio da tela mora na `TopBar`, fora deste hook (ver
   * `ClockScope`).
   */
  startedAtRef: React.RefObject<number>;
};

export function useAudioCapture({ onLevels, onFragment, startedAtRef }: Options) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);

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

  /** Tempo ativo acumulado até a última pausa. Enquanto grava, o tempo real é
   * `agora - startedAtRef`; pausado, é este valor. */
  const accumulatedRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const releaseAll = useCallback(() => {
    stopLoop();
    recorderRef.current = null;
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    analyserRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    rotateSinceRef.current = null;
    rotatingRef.current = false;
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
  }, [stopLoop, startedAtRef]);

  useEffect(() => releaseAll, [releaseAll]);

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
      partBytesRef.current += event.data.size;
      onFragmentRef.current({ part, seq: seqRef.current, blob: event.data });
      seqRef.current += 1;
      if (partBytesRef.current >= PART_MAX_BYTES && rotateSinceRef.current === null) {
        rotateSinceRef.current = performance.now();
      }
    };
    rec.start(FRAGMENT_MS);
    recorderRef.current = rec;
  }, []);

  /**
   * Fecha a parte atual e abre a próxima. O `stop()` faz o gravador emitir o
   * resto do buffer como último fragmento desta parte; o gravador novo nasce
   * com cabeçalho próprio, e é isso que torna a parte seguinte um arquivo
   * válido sozinho.
   */
  const rotatePart = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rotatingRef.current) return;
    rotatingRef.current = true;
    rec.onstop = () => {
      partRef.current += 1;
      seqRef.current = 0;
      partBytesRef.current = 0;
      rotateSinceRef.current = null;
      rotatingRef.current = false;
      spawnRecorder();
    };
    rec.stop();
  }, [spawnRecorder]);

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

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    const picked = pickMime();
    if (!picked) {
      setError("Este navegador não grava áudio. Tente pelo Chrome, Safari ou Edge.");
      return false;
    }
    mimeRef.current = picked;
    try {
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

      partRef.current = 0;
      seqRef.current = 0;
      partBytesRef.current = 0;
      rotateSinceRef.current = null;
      rotatingRef.current = false;
      spawnRecorder();

      accumulatedRef.current = 0;
      startedAtRef.current = performance.now();
      setState("recording");
      runLoop();
      return true;
    } catch (err) {
      releaseAll();
      setState("idle");
      setError(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Sem permissão para usar o microfone. Libere o acesso no navegador e tente de novo."
          : "Não consegui abrir o microfone neste aparelho."
      );
      return false;
    }
  }, [releaseAll, runLoop, spawnRecorder, startedAtRef]);

  const pause = useCallback(() => {
    stopLoop();
    recorderRef.current?.pause();
    // A trilha continua VIVA, só muda: desligá-la devolveria o microfone ao
    // sistema, e retomar pediria a permissão de novo.
    for (const t of streamRef.current?.getAudioTracks() ?? []) t.enabled = false;
    accumulatedRef.current = performance.now() - startedAtRef.current;
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
    const rec = recorderRef.current;
    const picked = mimeRef.current;
    if (!rec || !picked) return null;
    setState("stopping");
    stopLoop();

    const durationMs =
      rec.state === "recording" ? performance.now() - startedAtRef.current : accumulatedRef.current;

    // Espera o `onstop`: é ele que entrega o resto do buffer como último
    // fragmento. Seguir antes deixaria o fim da pregação fora do arquivo.
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });

    const parts = partRef.current + 1;
    releaseAll();
    setState("idle");
    return {
      durationMs: Math.round(durationMs),
      parts,
      mimeType: picked.mime,
      extension: picked.extension,
    };
  }, [releaseAll, stopLoop, startedAtRef]);

  /** Joga fora: o microfone fecha e nada do que ficou vira arquivo. */
  const discard = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.stop();
    }
    releaseAll();
    setState("idle");
  }, [releaseAll]);

  return { state, error, setError, start, pause, resume, stop, discard };
}
