import type { VerseLine } from "@/lib/domain/verse";
export type ChunkStatus = "uploading" | "ok" | "silence" | "error";

export type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
  startedAtMs: number;
  /** O servidor detectou qualidade ruim neste chunk (assinatura de alucinação
   * ou baixa confiança nos logprobs). O texto já veio limpo e continua no
   * transcript, mas o chunk não alimenta prevText nem os pipelines ao vivo,
   * reutilizá-lo como contexto realimentaria a alucinação. */
  suspect?: boolean;
};

/**
 * Veredito acumulado sobre o áudio da sessão. `poor` acende o aviso na tela;
 * ele NÃO troca de modelo (não existe modelo melhor para escalar, ver
 * `app/api/transcribe/route.ts`).
 */
export type AudioQuality = "ok" | "poor";

export type TranscriptState = "listening" | "transcribing" | "idle";

export type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; verses: VerseLine[] }
  | { status: "error"; message: string };
