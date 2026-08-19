/**
 * Return the last `maxChars` characters of `full`, snapping the cut to a word
 * boundary so we don't hand the model a fragment like "…nseguind" that used
 * to be mid-token.
 */
export function tailTranscript(full: string, maxChars: number): string {
  if (full.length <= maxChars) return full;
  const tail = full.slice(-maxChars);
  const spaceIdx = tail.indexOf(" ");
  return spaceIdx > 0 ? tail.slice(spaceIdx + 1) : tail;
}

/**
 * Grab the last N sentence-like fragments from `text`. Falls back to the tail
 * 400 chars when the text has no sentence punctuation at all (fresh transcript
 * of an unbroken monologue).
 */
export function tailSentences(text: string, count: number): string {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [];
  if (parts.length === 0) return text.slice(-400);
  return parts.slice(-count).join(" ").trim();
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
