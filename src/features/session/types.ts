export type ChunkStatus = "uploading" | "ok" | "silence" | "error";

export type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
  startedAtMs: number;
  /** O servidor detectou assinatura de alucinação neste chunk (eco de prompt,
   * eco de vocabulário ou loop de repetição). O texto já veio limpo e continua
   * no transcript, mas o chunk não alimenta prevText nem os pipelines ao vivo
   * — reutilizá-lo como contexto realimentaria a alucinação. */
  suspect?: boolean;
};

export type TranscriptState = "listening" | "transcribing" | "idle";

export type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; text: string }
  | { status: "error"; message: string };
