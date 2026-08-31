import type { ChunkRow } from "@/features/session/types";

/**
 * Join transcribed ("ok") chunks into one normalized transcript string, in
 * index order. With `excludeSuspect`, chunks the server flagged as carrying a
 * hallucination signature are left out — the live pipelines and the prevText
 * hint use this so a bad chunk can't contaminate context. The transcript view
 * and the final summary keep suspect chunks (their text already came cleaned).
 */
/**
 * Decide se a sessão deve ser promovida ao modelo de transcrição escalado:
 * entre os últimos `window` chunks OK, `minBad`+ saíram ruins — suspeitos
 * (assinatura de alucinação / baixa confiança) ou re-transcritos pelo
 * servidor no modelo escalado. Janela parcial conta: 3 chunks, todos ruins,
 * já promovem.
 */
export function shouldEscalateTranscription(
  chunks: Record<number, ChunkRow>,
  window: number,
  minBad: number
): boolean {
  const recent = Object.values(chunks)
    .filter((r) => r.status === "ok")
    .sort((a, b) => a.index - b.index)
    .slice(-window);
  const bad = recent.filter((r) => r.suspect || r.escalated).length;
  return bad >= minBad;
}

export function joinOkChunks(
  chunks: Record<number, ChunkRow>,
  opts?: { excludeSuspect?: boolean }
): { transcript: string; okChunkCount: number } {
  const ok = Object.values(chunks)
    .filter((r) => r.status === "ok" && !(opts?.excludeSuspect && r.suspect))
    .sort((a, b) => a.index - b.index);
  const transcript = ok
    .map((r) => r.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { transcript, okChunkCount: ok.length };
}

/**
 * Group transcribed chunks into minute-level bands for the transcript view.
 * Chunks with empty text (silence, errors, still uploading) are ignored.
 */
export function groupChunksByMinute(rows: ChunkRow[]): { startedAtMs: number; text: string }[] {
  const ok = rows.filter((r) => r.status === "ok" && r.text.trim().length > 0);
  if (ok.length === 0) return [];
  const groups: { startedAtMs: number; text: string }[] = [];
  let currentMinute = -1;
  for (const r of ok) {
    const minute = Math.floor(r.startedAtMs / 60_000);
    if (minute !== currentMinute) {
      currentMinute = minute;
      groups.push({ startedAtMs: minute * 60_000, text: r.text.trim() });
    } else {
      const last = groups[groups.length - 1];
      last.text = `${last.text} ${r.text.trim()}`.replace(/\s+/g, " ").trim();
    }
  }
  return groups;
}
