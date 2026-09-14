import type { VerseLine } from "@/lib/domain/verse";

/**
 * O que a busca de uma passagem devolve enquanto ela acontece.
 *
 * Único tipo que sobrou deste arquivo. Os outros (`ChunkRow`, `AudioQuality`,
 * `TranscriptState`) descreviam a fila de chunks e o veredito de áudio dos três
 * modos de captura antigos, que transcreviam DURANTE a pregação. O gravador de
 * hoje manda o áudio inteiro de uma vez, no stop, e não tem fila para desenhar.
 */
export type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; verses: VerseLine[] }
  | { status: "error"; message: string };
