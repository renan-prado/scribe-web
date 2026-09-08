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

/**
 * Iniciais de um nome próprio, para o avatar de fallback: a primeira letra do
 * primeiro nome mais a do último. Nome de uma palavra devolve uma letra só,
 * vazio devolve "?".
 *
 * Serve tanto a pessoa quanto a lugar — "Igreja Batista Central" vira "IC",
 * que é exatamente o tipo de pastilha que se reconhece de relance numa lista.
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
