import type { VerseLine } from "@/lib/domain/verse";
export type ChunkStatus = "uploading" | "ok" | "silence" | "error";

export type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
  startedAtMs: number;
  /** O servidor detectou qualidade ruim neste chunk (assinatura de alucinação
   * ou baixa confiança nos logprobs). O texto já veio limpo e continua no
   * transcript, mas o chunk não alimenta prevText nem os pipelines ao vivo
   * — reutilizá-lo como contexto realimentaria a alucinação. */
  suspect?: boolean;
  /** O servidor precisou re-transcrever este chunk no modelo escalado (o
   * resultado do modelo padrão saiu ruim). Conta como sinal de áudio ruim na
   * janela que decide a promoção da sessão, mesmo quando o texto final ficou
   * limpo. */
  escalated?: boolean;
};

export type TranscribeTier = "standard" | "escalated";

export type TranscriptState = "listening" | "transcribing" | "idle";

export type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; verses: VerseLine[] }
  | { status: "error"; message: string };
