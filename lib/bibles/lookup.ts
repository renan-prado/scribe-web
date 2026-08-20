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
