"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
} from "@/features/session/config";
import type { ChunkEvent, Recorder, RecorderErrorEvent } from "@/lib/domain/recorder";
import { createRecorder } from "@/lib/recorder";

/**
 * A captação do `/v2/recording`: o microfone, a onda e **pedaços de 15-20s**.
 *
 * ## Por que existem chunks agora
 *
 * Este hook substitui um que gravava A SESSÃO INTEIRA num arquivo só. O
 * argumento de lá era bom no papel — sem feed ao vivo, fatiar seria pagar rede
 * e costura de texto sem comprar nada — e estava errado em três frentes, todas
 * descobertas do jeito caro:
 *
 * 1. **Um arquivo só tem teto.** `/api/transcribe` recusa acima de 8 MB, o que
 *    a 24 kbps dá ~44 minutos. Passou disso, o POST voltava 413 e a gravação
 *    não tinha como ser transcrita. Uma palestra de quase uma hora bateu nisso.
 * 2. **Um arquivo só não existe antes do fim.** Enquanto o `MediaRecorder`
 *    está gravando, o áudio está DENTRO dele: não há o que guardar no aparelho,
 *    então a aba morrer aos 40 minutos custava os 40 minutos. Um chunk, ao
 *    contrário, vira arquivo a cada 20 segundos, e o que vira arquivo vira
 *    registro no IndexedDB (ver `useTranscribeQueue`).
 * 3. **Um arquivo só sobe uma vez.** Sem rede no fim da pregação, aquele POST
 *    único falhava e não havia fila para retomá-lo. Em pedaços, a rede pode
 *    cair e voltar no meio que a fila reenvia sozinha o que ficou.
 *
 * O preço que o argumento antigo temia (a costura de texto com emendas erradas
 * nas fronteiras) é real e já estava pago: é o mesmo `createRecorder` que o app
 * de hoje usa em três telas, e ele corta no SILÊNCIO entre `MIN` e `MAX`
 * justamente para as emendas caírem onde ninguém está falando.
 *
 * ## Pausar PARA o gravador, não o suspende
 *
 * A versão anterior usava `pause()`/`resume()` do `MediaRecorder`, que mantêm
 * um arquivo contínuo. Com chunks o modelo é o do app de hoje: pausar encerra o
 * gravador (fechando o último pedaço) e retomar cria outro, continuando a
 * numeração de onde parou (`startingIndex`). O microfone é devolvido e pedido
 * de novo, sem novo diálogo de permissão, porque ela já foi concedida.
 *
 * ## A onda toma emprestado o analyser do VAD
 *
 * Ela NÃO abre um `AudioContext` próprio. O `createRecorder` já mantém um para
 * decidir onde cortar o chunk, e contexto de áudio é recurso de hardware, com
 * limite baixo em celular: o segundo existiria só para ler um sinal que o
 * primeiro já tem. As duas leituras convivem no mesmo nó (ver `getAnalyser`).
 *
 * Como o gravador morre e renasce na pausa, o analyser também: quem desenha
 * precisa buscá-lo de novo a cada `start`/`resume`, e é o que `runLoop` faz.
 *
 * ## O relógio
 *
 * `startedAtRef` é ANCORADO, não é o instante do start: ao retomar ele volta
 * para `agora - tempo já gravado`, então `performance.now() - startedAtRef` é
 * sempre o tempo ATIVO de gravação, sem o que passou pausado. É essa duração
 * que vai para a sessão e para a conta de uso.
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
 * duas pontas disso são silêncio em fala: abaixo de ~80Hz é ruído de sala,
 * acima de ~8kHz a voz humana quase não tem energia. Desenhar essas duas pontas
 * é gastar barras para mostrar zero.
 *
 * Com o `noiseSuppression` DESLIGADO (ver `AUDIO_CONSTRAINTS` em
 * `lib/recorder.ts`, e o porquê medido lá), este corte passou a ser a única
 * coisa entre o ar-condicionado da sala e a onda na tela — é ele que segura o
 * grave de máquina, e é por isso que o piso de 80Hz não é decoração.
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

type Options = {
  /** Chamado a cada quadro com um valor de 0 a 1 por barra. */
  onLevels: (levels: Float32Array) => void;
  /** Um pedaço fechado de áudio, pronto para subir. */
  onChunk: (ev: ChunkEvent) => void;
  /** Falha do microfone, do `MediaRecorder` ou do VAD. */
  onRecorderError: (ev: RecorderErrorEvent) => void;
};

export function useChunkedCapture({ onLevels, onChunk, onRecorderError }: Options) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<Recorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelsRef = useRef(new Float32Array(WAVE_BARS));

  const onLevelsRef = useRef(onLevels);
  onLevelsRef.current = onLevels;
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;
  const onRecorderErrorRef = useRef(onRecorderError);
  onRecorderErrorRef.current = onRecorderError;

  // Ver "O relógio" no cabeçalho.
  const startedAtRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  /** Próximo índice de chunk. Sai dos eventos REAIS, e não da contagem de
   * chunks transcritos com sucesso: um pedaço que falhou no upload continua
   * ocupando o índice dele, e reaproveitá-lo faria dois áudios diferentes
   * disputarem a mesma posição na transcrição. */
  const nextIndexRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const restLevels = useCallback(() => {
    // Zera a onda ao parar: sem isso as barras congelam na última altura, e uma
    // onda parada no meio do movimento parece gravação travada, não parada.
    levelsRef.current.fill(0);
    onLevelsRef.current(levelsRef.current);
  }, []);

  const runLoop = useCallback(() => {
    const analyser = recorderRef.current?.getAnalyser();
    if (!analyser) return;
    // O VAD lê o domínio do TEMPO, que este valor não afeta; ele é a primeira
    // camada de suavização da leitura de frequência, que é só nossa.
    analyser.smoothingTimeConstant = 0.75;
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

  /** Cria e abre um gravador continuando a numeração em `startingIndex`. */
  const spawn = useCallback(async (startingIndex: number): Promise<boolean> => {
    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
      startingIndex,
    });
    rec.onChunk((ev) => {
      nextIndexRef.current = Math.max(nextIndexRef.current, ev.index + 1);
      onChunkRef.current(ev);
    });
    rec.onError((ev) => onRecorderErrorRef.current(ev));
    try {
      await rec.start();
    } catch (err) {
      setError(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Sem permissão para usar o microfone. Libere o acesso no navegador e tente de novo."
          : "Não consegui abrir o microfone neste aparelho."
      );
      return false;
    }
    recorderRef.current = rec;
    return true;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current) return false;
    setError(null);
    nextIndexRef.current = 0;
    pausedElapsedRef.current = 0;
    if (!(await spawn(0))) {
      setState("idle");
      return false;
    }
    startedAtRef.current = performance.now();
    setState("recording");
    runLoop();
    return true;
  }, [spawn, runLoop]);

  const pause = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    pausedElapsedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    recorderRef.current = null;
    setState("paused");
    stopLoop();
    restLevels();
    // Fecha o pedaço em andamento: o `stop()` do gravador dispara o último
    // `onChunk` antes de resolver, então nada do que já foi falado se perde na
    // pausa.
    await rec.stop();
  }, [stopLoop, restLevels]);

  const resume = useCallback(async () => {
    if (recorderRef.current) return;
    if (!(await spawn(nextIndexRef.current))) return;
    startedAtRef.current = performance.now() - pausedElapsedRef.current;
    setState("recording");
    runLoop();
  }, [spawn, runLoop]);

  /** Encerra e devolve a duração ATIVA gravada, em ms. */
  const stop = useCallback(async (): Promise<number> => {
    const rec = recorderRef.current;
    const durationMs = rec
      ? Math.max(0, performance.now() - startedAtRef.current)
      : pausedElapsedRef.current;
    recorderRef.current = null;
    setState("stopping");
    stopLoop();
    restLevels();
    if (rec) await rec.stop();
    setState("idle");
    return Math.round(durationMs);
  }, [stopLoop, restLevels]);

  // Desmontou no meio da gravação (trocou de rota, fechou a aba): o microfone
  // precisa ser devolvido, senão a luzinha do aparelho fica acesa. O último
  // chunk ainda é emitido pelo `stop()` do gravador, e a fila já o persistiu.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const rec = recorderRef.current;
      recorderRef.current = null;
      void rec?.stop();
    };
  }, []);

  return { state, error, setError, start, pause, resume, stop };
}
