import type {
  ChunkEvent,
  Recorder,
  RecorderErrorEvent,
  RecorderErrorSource,
  RecorderOptions,
} from "@/lib/domain/recorder";
import { createLogger } from "@/lib/log";

const log = createLogger("recorder");

type MimeCandidate = { mimeType: string; extension: string };

const MIME_CANDIDATES: MimeCandidate[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/aac", extension: "aac" },
];

/**
 * O que pedimos ao microfone, e as três coisas que pedimos para ele NÃO fazer.
 *
 * Era `{ audio: true }`, e `true` não é neutro: o Chrome liga por padrão
 * `echoCancellation`, `noiseSuppression` e `autoGainControl`, o pacote do
 * WebRTC afinado para CHAMADA DE VOZ, uma boca a vinte centímetros do
 * aparelho, num quarto, e tudo o mais é inimigo. Um salão de igreja é o caso
 * oposto: a voz chega refletida, de longe, e o "ruído" que a supressão ataca é
 * a mesma cauda reverberante que carrega a fala.
 *
 * Medido: rodar um denoiser espectral (`afftdn`) sobre o áudio de referência
 * antes de transcrever levou o WER de 11,8% para 21,2%. Compressão e
 * equalização também pioraram; só normalização de volume ficou neutra. O
 * modelo de transcrição foi treinado em áudio sujo e usa o que a limpeza
 * remove, o melhor pré-processamento é nenhum.
 *
 * As outras duas seguem a mesma lógica: `autoGainControl` bombeia o ganho
 * entre a fala e o silêncio (e o modelo transcreve áudio baixo sem perder
 * nada, 12,9% de WER a 18% do volume original), e `echoCancellation` sem
 * sinal de referência não tem eco a cancelar, mas em celular costuma arrastar
 * a captação para o caminho de "voice communication", que é justamente o
 * processado.
 *
 * **Isto ainda não foi confirmado em campo.** A medição acima é um proxy
 * offline: o denoiser do ffmpeg não é o do WebRTC. Por isso `reportTrackSettings`
 * loga o que o navegador REALMENTE aplicou, uma gravação real de verdade
 * responde se o pedido foi aceito. Se um dia isto precisar voltar atrás, é
 * este objeto, e nada mais.
 *
 * **É EXPORTADO porque precisa ser um só.** O gravador do v2 abria o microfone
 * por conta própria e pedia os três LIGADOS, para a onda na tela não dançar com
 * o ar-condicionado da sala — uma decisão cosmética tomada sobre o mesmo
 * `MediaStream` que alimenta o `MediaRecorder`, ou seja, pagando a qualidade da
 * transcrição pela estética da animação, sem que nada no código dissesse que
 * havia uma troca ali. Quem abre microfone neste repositório usa ESTE objeto.
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/**
 * Constraint é PEDIDO, não garantia: o navegador pode ignorar qualquer uma
 * sem avisar, e aí a gravação sai processada enquanto o código acredita que
 * não. `getSettings()` é a única fonte do que valeu de fato.
 */
function reportTrackSettings(stream: MediaStream) {
  try {
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const s = track.getSettings();
    log.info("mic", {
      echoCancellation: s.echoCancellation ?? null,
      noiseSuppression: s.noiseSuppression ?? null,
      autoGainControl: s.autoGainControl ?? null,
      sampleRate: s.sampleRate ?? null,
      channelCount: s.channelCount ?? null,
    });
  } catch {
    // getSettings não é universal; a ausência do log não pode custar a gravação.
  }
}

function pickMime(): MimeCandidate | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      // some UAs throw on unknown mime; keep trying
    }
  }
  return null;
}

export function createRecorder(opts: RecorderOptions = {}): Recorder {
  let minChunkMs = opts.minChunkMs ?? 20_000;
  let maxChunkMs = opts.maxChunkMs ?? 45_000;
  const silenceThreshold = opts.silenceThreshold ?? 0.01;
  const silenceHoldMs = opts.silenceHoldMs ?? 400;

  let stream: MediaStream | null = null;
  let chunkRecorder: MediaRecorder | null = null;
  let chunkParts: BlobPart[] = [];
  let chunkIndex = opts.startingIndex ?? 0;
  let chunkStartedAt = 0;
  let running = false;
  let picked: MimeCandidate | null = null;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let vadTimer: ReturnType<typeof setInterval> | null = null;
  let chunkHardCutTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Resolve quando o ÚLTIMO chunk foi emitido, e existe só entre o `stop()` e o
   * `onstop` do gravador.
   *
   * Sem ele o `stop()` era uma promessa mentirosa: `MediaRecorder.stop()`
   * retorna na hora e o `onstop`, que é quem fecha o último pedaço e o entrega
   * ao `onChunk`, só roda um turno depois. Quem chamava `await rec.stop()` e
   * logo em seguida montava a transcrição podia montá-la SEM os últimos 15-20
   * segundos — o fim da pregação, justamente a parte que costuma ser a
   * conclusão. Nada na tela indicaria a falta.
   *
   * Na prática o `await audioContext.close()` logo abaixo costumava dar tempo
   * ao `onstop` de rodar antes, e é por isso que isto quase nunca apareceu.
   * "Quase nunca" num caminho que decide se o fim do sermão entra no resumo não
   * é garantia nenhuma.
   */
  let finalChunkResolve: (() => void) | null = null;
  let silenceSince: number | null = null;
  let visibilityListener: (() => void) | null = null;

  let chunkCb: ((ev: ChunkEvent) => void) | null = null;
  let errorCb: ((ev: RecorderErrorEvent) => void) | null = null;

  const emitError = (source: RecorderErrorSource, message: string) => {
    if (errorCb) errorCb({ source, message });
  };

  const stopVadTimer = () => {
    if (vadTimer) {
      clearInterval(vadTimer);
      vadTimer = null;
    }
  };

  const stopHardCutTimer = () => {
    if (chunkHardCutTimer) {
      clearTimeout(chunkHardCutTimer);
      chunkHardCutTimer = null;
    }
  };

  const requestChunkCut = () => {
    if (chunkRecorder?.state !== "recording") return;
    try {
      chunkRecorder.stop();
    } catch (err) {
      emitError("chunk", (err as Error).message ?? "chunk stop failed");
    }
  };

  const startVadMonitor = () => {
    stopVadTimer();
    if (!analyser) return;
    silenceSince = null;
    const buffer = new Uint8Array(analyser.fftSize);
    vadTimer = setInterval(() => {
      if (!running || !chunkRecorder || chunkRecorder.state !== "recording") return;
      if (!analyser) return;
      const elapsed = performance.now() - chunkStartedAt;

      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const now = performance.now();
      if (rms < silenceThreshold) {
        if (silenceSince == null) silenceSince = now;
      } else {
        silenceSince = null;
      }
      const silenceHeldMs = silenceSince != null ? now - silenceSince : 0;
      const cutAtSilence = elapsed >= minChunkMs && silenceHeldMs >= silenceHoldMs;
      const forceCut = elapsed >= maxChunkMs;
      if (cutAtSilence || forceCut) {
        requestChunkCut();
      }
    }, 50);
  };

  const startChunkRecorder = () => {
    if (!stream || !picked) return;
    chunkParts = [];
    chunkStartedAt = performance.now();

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: picked.mimeType });
    } catch (err) {
      emitError("chunk", (err as Error).message ?? "MediaRecorder ctor failed");
      return;
    }

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunkParts.push(e.data);
    };
    rec.onerror = (e: ErrorEvent) => {
      const err = e.error as DOMException | undefined;
      emitError("chunk", err?.message ?? "MediaRecorder error");
    };
    rec.onstop = () => {
      if (!picked) return;
      stopHardCutTimer();
      const durationMs = performance.now() - chunkStartedAt;
      const blob = new Blob(chunkParts, { type: picked.mimeType });
      const ev: ChunkEvent = {
        index: chunkIndex,
        blob,
        mimeType: picked.mimeType,
        extension: picked.extension,
        startedAt: chunkStartedAt,
        durationMs,
      };
      chunkIndex += 1;
      if (chunkCb) chunkCb(ev);
      if (running) {
        startChunkRecorder();
        return;
      }
      // Parando: este era o último pedaço, o `stop()` pode seguir.
      finalChunkResolve?.();
      finalChunkResolve = null;
    };

    chunkRecorder = rec;
    try {
      rec.start();
      startVadMonitor();
      // Absolute fallback: if the VAD setInterval or AudioContext get frozen
      // by background throttling, this setTimeout is our last line of defense
      // guaranteeing a chunk cut. Sized slightly above maxChunkMs so the VAD
      // still has priority under normal conditions.
      stopHardCutTimer();
      chunkHardCutTimer = setTimeout(() => {
        chunkHardCutTimer = null;
        if (!running) return;
        requestChunkCut();
      }, maxChunkMs + 2_000);
    } catch (err) {
      emitError("chunk", (err as Error).message ?? "chunk start failed");
    }
  };

  const setupVad = () => {
    if (!stream) return;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error("AudioContext unavailable");
      audioContext = new AC();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      // O contexto pode NASCER suspenso: o Safari entrega assim todo contexto
      // criado fora de um gesto do usuário, e no v2 a gravação começa depois de
      // um `POST /api/sessions`, ou seja, sempre fora do gesto. Suspenso, o
      // analyser devolve silêncio puro — o VAD nunca vê fala, nunca corta no
      // silêncio, e o corte passa a depender só do timer de emergência: chunks
      // de 22s cortados no meio de uma palavra, sem nenhum erro na tela. O
      // `resume()` num contexto que já está rodando não faz nada, então isto é
      // seguro em todo navegador.
      void audioContext.resume().catch(() => {
        // Sem gesto nenhum o navegador pode recusar; o `visibilitychange`
        // abaixo tenta de novo, e o timer de emergência segura enquanto isso.
      });

      // Some browsers auto-suspend AudioContexts when the tab goes into the
      // background, that would silently break VAD chunk cutting. Resume as
      // soon as we're visible again (and speculatively on every visibility
      // event, since resume() on a running context is a no-op).
      visibilityListener = () => {
        if (audioContext && audioContext.state === "suspended") {
          audioContext.resume().catch(() => {
            // ignore, will retry on next visibility change
          });
        }
      };
      document.addEventListener("visibilitychange", visibilityListener);
    } catch (err) {
      emitError("vad", (err as Error).message ?? "vad setup failed");
    }
  };

  return {
    async start() {
      if (running) throw new Error("already running");
      picked = pickMime();
      if (!picked) throw new Error("no supported MediaRecorder mimeType");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      } catch (err) {
        // Algumas WebViews recusam o objeto de constraints inteiro em vez de
        // ignorar o que não conhecem. Perder a gravação por causa de um ajuste
        // de qualidade seria a troca errada: tenta de novo no modo simples.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          emitError("stream", (err as Error).message ?? "getUserMedia failed");
          throw err;
        }
      }
      reportTrackSettings(stream);
      running = true;
      setupVad();
      startChunkRecorder();
      return { mimeType: picked.mimeType, extension: picked.extension };
    },
    async stop() {
      if (!running) return;
      running = false;
      stopVadTimer();
      stopHardCutTimer();
      // A promessa é armada ANTES do `stop()` porque o `onstop` pode disparar
      // já no turno seguinte, e armá-la depois perderia a corrida.
      const lastChunk =
        chunkRecorder && chunkRecorder.state === "recording"
          ? new Promise<void>((resolve) => {
              finalChunkResolve = resolve;
            })
          : null;
      try {
        if (chunkRecorder && chunkRecorder.state === "recording") chunkRecorder.stop();
      } catch (err) {
        emitError("chunk", (err as Error).message ?? "chunk final stop failed");
        finalChunkResolve = null;
      }
      if (lastChunk && finalChunkResolve) {
        // O teto existe porque um `onstop` que nunca chega (WebView exótica,
        // aba em segundo plano congelada) travaria o encerramento para sempre,
        // e quem aperta "parar" precisa que parar termine. Três segundos é
        // muito mais do que o evento leva quando ele vem.
        await Promise.race([lastChunk, new Promise<void>((resolve) => setTimeout(resolve, 3_000))]);
        finalChunkResolve = null;
      }
      if (visibilityListener) {
        document.removeEventListener("visibilitychange", visibilityListener);
        visibilityListener = null;
      }
      if (audioContext) {
        try {
          await audioContext.close();
        } catch {
          // ignore
        }
        audioContext = null;
        analyser = null;
      }
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
        stream = null;
      }
    },
    onChunk(cb) {
      chunkCb = cb;
    },
    onError(cb) {
      errorCb = cb;
    },
    setChunkTiming(next) {
      if (typeof next.minChunkMs === "number" && next.minChunkMs > 0) {
        minChunkMs = next.minChunkMs;
      }
      if (typeof next.maxChunkMs === "number" && next.maxChunkMs > 0) {
        maxChunkMs = next.maxChunkMs;
      }
    },
  };
}
