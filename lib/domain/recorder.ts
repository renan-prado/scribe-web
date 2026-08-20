export type ChunkEvent = {
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  startedAt: number;
  durationMs: number;
};

export type RecorderErrorSource = "stream" | "chunk" | "full" | "vad";

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
  minChunkMs?: number;
  maxChunkMs?: number;
  silenceThreshold?: number;
  silenceHoldMs?: number;
};

export type ChunkTiming = {
  minChunkMs?: number;
  maxChunkMs?: number;
};

export type Recorder = {
  start(): Promise<{ mimeType: string; extension: string }>;
  stop(): Promise<void>;
  onChunk(cb: (ev: ChunkEvent) => void): void;
  onError(cb: (ev: RecorderErrorEvent) => void): void;
  onFinalAudio(cb: (ev: FinalAudioEvent) => void): void;
  setChunkTiming(next: ChunkTiming): void;
};
