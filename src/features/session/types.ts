export type ChunkStatus = "uploading" | "ok" | "silence" | "error";

export type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
  startedAtMs: number;
};

export type TranscriptState = "listening" | "transcribing" | "idle";

export type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; text: string; translation: string }
  | { status: "error"; message: string };
