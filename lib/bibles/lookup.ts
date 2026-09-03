import type { VerseLine } from "@/lib/domain/verse";
import { abbrevFor } from "./books";
import type { Bible } from "./loader";

export type VerseLookup = { text: string; truncated: boolean };

/**
 * Look up a verse or range in a loaded Bible. Concatenates verses with a
 * single space. Returns empty text (never throws) for out-of-range inputs.
 * `truncated` is true when the range extends past the end of the chapter.
 */
export function lookupVerse(
  bible: Bible,
  bookFullName: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): VerseLookup {
  const abbrev = abbrevFor(bookFullName);
  if (!abbrev) return { text: "", truncated: false };

  const book = bible.find((b) => b.abbrev === abbrev);
  if (!book) return { text: "", truncated: false };

  const chapterArr = book.chapters[chapter - 1];
  if (!chapterArr) return { text: "", truncated: false };

  const parts: string[] = [];
  let truncated = false;
  for (let v = startVerse; v <= endVerse; v++) {
    const verseText = chapterArr[v - 1];
    if (!verseText) {
      truncated = true;
      break;
    }
    parts.push(verseText);
  }
  return { text: parts.join(" ").trim(), truncated };
}

/**
 * A mesma busca, mas versículo a versículo. É o que a UI precisa: ela numera
 * cada linha, e um texto concatenado obrigaria o cliente a resegmentar — que
 * não tem como dar certo, porque o ponto final não delimita versículo.
 *
 * Devolve SÓ os que existem. Pedir 1:11-17 num capítulo de 15 versículos
 * devolve cinco linhas, e não sete com duas vazias — que era exatamente o que
 * a tela mostrava quando cada versículo era uma requisição própria.
 */
export function lookupPassage(
  bible: Bible,
  bookFullName: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): VerseLine[] {
  const abbrev = abbrevFor(bookFullName);
  if (!abbrev) return [];

  const book = bible.find((b) => b.abbrev === abbrev);
  if (!book) return [];

  const chapterArr = book.chapters[chapter - 1];
  if (!chapterArr) return [];

  const out: VerseLine[] = [];
  for (let v = Math.max(1, startVerse); v <= endVerse; v++) {
    const text = chapterArr[v - 1];
    // O primeiro buraco encerra: capítulos não têm versículos faltando no
    // meio, então um índice vazio significa que a faixa passou do fim.
    if (!text) break;
    out.push({ verse: v, text: text.trim() });
  }
  return out;
}
