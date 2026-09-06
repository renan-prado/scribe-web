import type {
  ChunkEvent,
  Recorder,
  RecorderErrorEvent,
  RecorderErrorSource,
  RecorderOptions,
} from "@/lib/domain/recorder";

type MimeCandidate = { mimeType: string; extension: string };

const MIME_CANDIDATES: MimeCandidate[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/aac", extension: "aac" },
];

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
      if (running) startChunkRecorder();
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

      // Some browsers auto-suspend AudioContexts when the tab goes into the
      // background — that would silently break VAD chunk cutting. Resume as
      // soon as we're visible again (and speculatively on every visibility
      // event, since resume() on a running context is a no-op).
      visibilityListener = () => {
        if (audioContext && audioContext.state === "suspended") {
          audioContext.resume().catch(() => {
            // ignore — will retry on next visibility change
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
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        emitError("stream", (err as Error).message ?? "getUserMedia failed");
        throw err;
      }
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
      try {
        if (chunkRecorder && chunkRecorder.state === "recording") chunkRecorder.stop();
      } catch (err) {
        emitError("chunk", (err as Error).message ?? "chunk final stop failed");
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
