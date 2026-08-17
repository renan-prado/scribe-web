export type ChunkEvent = {
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  startedAt: number;
  durationMs: number;
};

export type RecorderErrorSource = "stream" | "chunk" | "full";

export type RecorderErrorEvent = {
  source: RecorderErrorSource;
  message: string;
};

export type FinalAudioEvent = {
  blob: Blob;
  mimeType: string;
  extension: string;
};

export type RecorderOptions = {
  chunkMs?: number;
};

export type Recorder = {
  start(): Promise<{ mimeType: string; extension: string }>;
  stop(): Promise<void>;
  onChunk(cb: (ev: ChunkEvent) => void): void;
  onError(cb: (ev: RecorderErrorEvent) => void): void;
  onFinalAudio(cb: (ev: FinalAudioEvent) => void): void;
};

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
  const chunkMs = opts.chunkMs ?? 30_000;

  let stream: MediaStream | null = null;
  let chunkRecorder: MediaRecorder | null = null;
  let fullRecorder: MediaRecorder | null = null;
  let chunkParts: BlobPart[] = [];
  let fullParts: BlobPart[] = [];
  let chunkIndex = 0;
  let chunkStartedAt = 0;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let picked: MimeCandidate | null = null;

  let chunkCb: ((ev: ChunkEvent) => void) | null = null;
  let errorCb: ((ev: RecorderErrorEvent) => void) | null = null;
  let finalCb: ((ev: FinalAudioEvent) => void) | null = null;

  const emitError = (source: RecorderErrorSource, message: string) => {
    if (errorCb) errorCb({ source, message });
  };

  const scheduleRestart = () => {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!running || !chunkRecorder) return;
      try {
        if (chunkRecorder.state === "recording") {
          chunkRecorder.stop();
        }
      } catch (err) {
        emitError("chunk", (err as Error).message ?? "chunk stop failed");
      }
    }, chunkMs);
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
    rec.onerror = (e: Event) => {
      const err = (e as unknown as { error?: DOMException }).error;
      emitError("chunk", err?.message ?? "MediaRecorder error");
    };
    rec.onstop = () => {
      if (!picked) return;
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
      scheduleRestart();
    } catch (err) {
      emitError("chunk", (err as Error).message ?? "chunk start failed");
    }
  };

  const startFullRecorder = () => {
    if (!stream || !picked) return;
    fullParts = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: picked.mimeType });
    } catch (err) {
      emitError("full", (err as Error).message ?? "MediaRecorder ctor failed");
      return;
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) fullParts.push(e.data);
    };
    rec.onerror = (e: Event) => {
      const err = (e as unknown as { error?: DOMException }).error;
      emitError("full", err?.message ?? "MediaRecorder error");
    };
    rec.onstop = () => {
      if (!picked) return;
      const blob = new Blob(fullParts, { type: picked.mimeType });
      if (finalCb) {
        finalCb({ blob, mimeType: picked.mimeType, extension: picked.extension });
      }
    };
    fullRecorder = rec;
    try {
      // timeslice keeps the internal buffer flushing into fullParts so 50 min
      // recordings do not sit entirely inside the recorder until stop().
      rec.start(1000);
    } catch (err) {
      emitError("full", (err as Error).message ?? "full start failed");
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
      chunkIndex = 0;
      running = true;
      startFullRecorder();
      startChunkRecorder();
      return { mimeType: picked.mimeType, extension: picked.extension };
    },
    async stop() {
      if (!running) return;
      running = false;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      try {
        if (chunkRecorder && chunkRecorder.state === "recording") chunkRecorder.stop();
      } catch (err) {
        emitError("chunk", (err as Error).message ?? "chunk final stop failed");
      }
      try {
        if (fullRecorder && fullRecorder.state === "recording") fullRecorder.stop();
      } catch (err) {
        emitError("full", (err as Error).message ?? "full final stop failed");
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
    onFinalAudio(cb) {
      finalCb = cb;
    },
  };
}
