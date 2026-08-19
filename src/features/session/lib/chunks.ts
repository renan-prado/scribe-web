import type { ChunkRow } from "@/features/session/types";

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
