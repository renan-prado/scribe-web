"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A captação do `/v2/recording`: o microfone, a onda e **um arquivo só**.
 *
 * ## Por que não há chunks
 *
 * O gravador do app atual fatia o áudio em pedaços de 15-20s e transcreve cada
 * um durante a pregação, porque ali o texto precisa aparecer AO VIVO para
 * alimentar o feed. Aqui não existe feed nem transcrição na tela, então fatiar
 * seria pagar o preço (uma chamada de rede por pedaço, uma costura de texto
 * com emendas erradas nas fronteiras, um estado de fila para manter) sem
 * comprar nada.
 *
 * **Pausar também não cria pedaço.** O `MediaRecorder` tem `pause()`/`resume()`
 * nativos: o relógio dele para, e o áudio que volta entra no MESMO arquivo, sem
 * emenda e sem silêncio no meio. É por isso que a pausa aqui é a do gravador, e
 * não "parar e começar outro".
 *
 * ## O que ele entrega no stop
 *
 * Um `Blob` e a duração REAL gravada (sem o tempo pausado). Quem decide o que
 * fazer com isso é a tela (`AudioStudio`): este hook não cria sessão, não
 * chama rota e não sabe que existe transcrição.
 *
 * ## Taxa de bits
 *
 * 24 kbps em opus. O padrão do navegador fica entre 48 e 128, e nenhum desses
 * ajuda: fala em 24 kbps é transcrita igual, e o que muda é o tamanho do POST.
 * `/api/transcribe` recusa acima de 8 MB, que a 24 kbps dá cerca de 44 minutos
 * num arquivo só. Acima disso, o caminho não é subir a conta, é fatiar no
 * servidor, e isso ainda não existe.
 */
export type CaptureState = "idle" | "recording" | "paused" | "stopping";

/** Quantas barras a onda tem. O laço entrega sempre este tanto de níveis. */
export const WAVE_BARS = 13;

/**
 * A onda é ESPELHADA: a barra do meio e as duas pontas são as extremidades da
 * mesma leitura, então só existem 7 faixas para 13 barras.
 *
 * Antes era uma faixa por barra, da esquerda (grave) para a direita (agudo), e
 * o resultado tinha o formato de uma cunha: energia alta nos graves, caindo até
 * uma última barra de 12–24kHz onde voz nenhuma mora. Espelhado, o grave fica
 * no CENTRO e o agudo nas bordas, e a silhueta vira um losango.
 */
const WAVE_BANDS = Math.ceil(WAVE_BARS / 2);

/**
 * A faixa de frequência que a onda escuta, em Hz.
 *
 * Não é o espectro inteiro de propósito. O analyser entrega de 0 a 24kHz, e as
 * duas pontas disso são silêncio em fala: abaixo de ~80Hz é ruído de sala (e o
 * `noiseSuppression` come o que sobra), acima de ~8kHz a voz humana quase não
 * tem energia. Desenhar essas duas pontas é gastar barras para mostrar zero.
 */
const WAVE_HZ_MIN = 80;
const WAVE_HZ_MAX = 8000;

/**
 * O contorno do losango: o quanto a barra encolhe conforme se afasta do centro,
 * de 1 (meio) a 0,4 (ponta), linear.
 *
 * Ele existe porque a forma não pode depender do que está sendo dito: num
 * "chiado" o espectro fica chato e, sem envelope, a onda vira um bloco
 * retangular. Com ele, a onda RESPONDE ao áudio mas mantém a silhueta.
 *
 * É CALCULADO, e não uma tabela: acrescentar barras muda o número de faixas, e
 * uma tabela de tamanho fixo se desalinharia em silêncio na primeira vez que
 * alguém mexesse no `WAVE_BARS`.
 */
const WAVE_EDGE_DROP = 0.6;
const envelopeAt = (distance: number) => 1 - WAVE_EDGE_DROP * (distance / (WAVE_BANDS - 1));

const AUDIO_BITS_PER_SECOND = 24_000;

/** O que o navegador aceita gravar, em ordem de preferência. */
const MIME_CANDIDATES = [
  { mime: "audio/webm;codecs=opus", extension: "webm" },
  { mime: "audio/webm", extension: "webm" },
  // Safari não grava webm. O contêiner dele é mp4/aac, e `/api/transcribe`
  // aceita a extensão.
  { mime: "audio/mp4", extension: "mp4" },
] as const;

function pickMime(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return null;
}

export type Capture = { blob: Blob; extension: string; durationMs: number };

type Options = {
  /** Chamado a cada quadro com um valor de 0 a 1 por barra. */
  onLevels: (levels: Float32Array) => void;
};

export function useAudioCapture({ onLevels }: Options) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const extensionRef = useRef("webm");
  const partsRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const levelsRef = useRef(new Float32Array(WAVE_BARS));
  const onLevelsRef = useRef(onLevels);
  onLevelsRef.current = onLevels;

  // Duração REAL: o relógio corre enquanto grava e congela na pausa. Sem isso,
  // uma pausa de dez minutos viraria dez minutos de áudio que ninguém gravou,
  // e é essa duração que vai para a sessão e para a conta de uso.
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const releaseAll = useCallback(() => {
    stopLoop();
    recorderRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    analyserRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    partsRef.current = [];
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    // Zera a onda ao sair: sem isso as barras congelam na última altura, e uma
    // onda parada no meio do movimento parece gravação travada, não parada.
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
  }, [stopLoop]);

  // Desmontou no meio da gravação (trocou de rota, fechou a aba): o microfone
  // precisa ser devolvido, senão a luzinha do aparelho fica acesa.
  useEffect(() => releaseAll, [releaseAll]);

  const runLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);

    // Os limites de cada faixa, em índice de bin, calculados UMA vez: eles só
    // dependem da taxa de amostragem do aparelho, que não muda no meio da
    // gravação. Espaçamento logarítmico, porque o ouvido é logarítmico, 80 a
    // 800Hz é a mesma distância percebida que 800 a 8000.
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
        // `** 0.7` levanta o sinal fraco: falar num tom normal a um metro do
        // aparelho dá 10% da escala, e sem a compressão a onda mal sairia do
        // repouso.
        band[b] = (sum / (to - from) / 255) ** 0.7 * envelopeAt(b);
      }
      const levels = levelsRef.current;
      for (let i = 0; i < WAVE_BARS; i++) {
        // A distância até o centro é o índice da faixa: a barra do meio é o
        // grave, as duas pontas são o agudo, e os pares no caminho são a mesma
        // faixa dos dois lados. É daqui que vem o formato de losango.
        const target = band[Math.round(Math.abs(i - center))];
        // Suavização exponencial por cima da que o próprio analyser já faz: a
        // subida é rápida (0.55) e a descida lenta (0.18), que é o que dá o
        // movimento "respirando" em vez do tremor de osciloscópio.
        const prev = levels[i];
        levels[i] = prev + (target - prev) * (target > prev ? 0.55 : 0.18);
      }
      onLevelsRef.current(levels);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const picked = pickMime();
    if (!picked) {
      setError("Este navegador não grava áudio. Tente pelo Chrome, Safari ou Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // O trio que todo navegador implementa. Sem `echoCancellation` a onda
        // reage ao próprio alto-falante do aparelho; sem `noiseSuppression`
        // ela dança sozinha com o ar-condicionado da sala.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      // Chegando pelo `?auto=1` não há um clique NESTA página, e o Safari
      // entrega o contexto suspenso quando ele nasce fora de um gesto. Sem o
      // `resume`, a onda ficaria parada em silêncio com o microfone aberto,
      // que é o pior dos dois mundos.
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      // 1024 bins dá resolução de sobra para treze barras e custa pouco; o
      // `smoothingTimeConstant` alto é a primeira camada de suavização.
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      // NÃO conectar ao `destination`: ligar a entrada do microfone na saída
      // do alto-falante é microfonia, e num celular com o volume alto é um
      // apito na cara de quem testou.
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: picked.mime,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      extensionRef.current = picked.extension;
      partsRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) partsRef.current.push(event.data);
      };
      // SEM `timeslice`: o gravador acumula tudo e entrega no `stop()`. É o que
      // faz o arquivo ser um só.
      recorder.start();
      recorderRef.current = recorder;

      accumulatedRef.current = 0;
      startedAtRef.current = performance.now();
      setState("recording");
      runLoop();
    } catch (err) {
      releaseAll();
      setState("idle");
      setError(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Sem permissão para usar o microfone. Libere o acesso no navegador e tente de novo."
          : "Não consegui abrir o microfone neste aparelho."
      );
    }
  }, [releaseAll, runLoop]);

  const pause = useCallback(() => {
    stopLoop();
    recorderRef.current?.pause();
    // A trilha CONTINUA viva, só muda. Desligar a trilha devolveria o
    // microfone ao sistema, e retomar pediria a permissão de novo, com o
    // diálogo do navegador no meio de uma pausa.
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = false;
    accumulatedRef.current += performance.now() - startedAtRef.current;
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
    setState("paused");
  }, [stopLoop]);

  const resume = useCallback(() => {
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = true;
    recorderRef.current?.resume();
    startedAtRef.current = performance.now();
    setState("recording");
    runLoop();
  }, [runLoop]);

  /**
   * Encerra e devolve o arquivo. `null` quando não há gravador vivo ou quando
   * o navegador não entregou byte nenhum (gravação de menos de um segundo).
   */
  const stop = useCallback(async (): Promise<Capture | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    setState("stopping");
    stopLoop();

    const durationMs =
      accumulatedRef.current +
      (recorder.state === "recording" ? performance.now() - startedAtRef.current : 0);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(partsRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    const extension = extensionRef.current;
    releaseAll();
    setState("idle");
    return blob.size > 0 ? { blob, extension, durationMs } : null;
  }, [releaseAll, stopLoop]);

  /** Joga fora: o microfone fecha e o áudio morre na memória, sem virar nada. */
  const discard = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    releaseAll();
    setState("idle");
  }, [releaseAll]);

  return { state, error, setError, start, pause, resume, stop, discard };
}
