import type { BibleChunkMetadata, PreparedChunk } from "./types";

export const CHUNKER_VERSION = "v1";

/**
 * Reverse map: JSON abbrev → pt-BR display name. Kept local to the chunker
 * because it's the only place that produces the metadata.bookDisplay field.
 * Order + spelling deliberately match lib/bibles/books.ts so displays stay
 * consistent with anything the guard emits.
 */
const BOOK_DISPLAY: Record<string, string> = {
  Gn: "Gênesis",
  Êx: "Êxodo",
  Lv: "Levítico",
  Nm: "Números",
  Dt: "Deuteronômio",
  Js: "Josué",
  Jz: "Juízes",
  Rt: "Rute",
  "1Sm": "1 Samuel",
  "2Sm": "2 Samuel",
  "1Rs": "1 Reis",
  "2Rs": "2 Reis",
  "1Cr": "1 Crônicas",
  "2Cr": "2 Crônicas",
  Ed: "Esdras",
  Ne: "Neemias",
  Et: "Ester",
  Jó: "Jó",
  Sl: "Salmos",
  Pv: "Provérbios",
  Ec: "Eclesiastes",
  Ct: "Cânticos",
  Is: "Isaías",
  Jr: "Jeremias",
  Lm: "Lamentações",
  Ez: "Ezequiel",
  Dn: "Daniel",
  Os: "Oseias",
  Jl: "Joel",
  Am: "Amós",
  Ob: "Obadias",
  Jn: "Jonas",
  Mq: "Miqueias",
  Na: "Naum",
  Hc: "Habacuque",
  Sf: "Sofonias",
  Ag: "Ageu",
  Zc: "Zacarias",
  Ml: "Malaquias",
  Mt: "Mateus",
  Mc: "Marcos",
  Lc: "Lucas",
  Jo: "João",
  At: "Atos",
  Rm: "Romanos",
  "1Co": "1 Coríntios",
  "2Co": "2 Coríntios",
  Gl: "Gálatas",
  Ef: "Efésios",
  Fp: "Filipenses",
  Cl: "Colossenses",
  "1Ts": "1 Tessalonicenses",
  "2Ts": "2 Tessalonicenses",
  "1Tm": "1 Timóteo",
  "2Tm": "2 Timóteo",
  Tt: "Tito",
  Fm: "Filemom",
  Hb: "Hebreus",
  Tg: "Tiago",
  "1Pe": "1 Pedro",
  "2Pe": "2 Pedro",
  "1Jo": "1 João",
  "2Jo": "2 João",
  "3Jo": "3 João",
  Jd: "Judas",
  Ap: "Apocalipse",
};

const NT_BOOKS = new Set<string>([
  "Mt",
  "Mc",
  "Lc",
  "Jo",
  "At",
  "Rm",
  "1Co",
  "2Co",
  "Gl",
  "Ef",
  "Fp",
  "Cl",
  "1Ts",
  "2Ts",
  "1Tm",
  "2Tm",
  "Tt",
  "Fm",
  "Hb",
  "Tg",
  "1Pe",
  "2Pe",
  "1Jo",
  "2Jo",
  "3Jo",
  "Jd",
  "Ap",
]);

export function bookDisplayFor(abbrev: string): string {
  return BOOK_DISPLAY[abbrev] ?? abbrev;
}

export type BibleChunkerOpts = {
  /** Number of verses per chunk. Default 8 — small enough to stay focused,
   * big enough to keep argumentative units (a paragraph in Paul, a stanza
   * in a psalm) intact most of the time. */
  verseWindow?: number;
  /** Overlap between chunks so a query landing between windows still hits
   * something. Default 2 verses. */
  overlap?: number;
};

/**
 * Chunk a single chapter of a translation into overlapping verse windows.
 * Returns [] when the chapter has no verses (should not happen in real
 * Bible JSONs but keeps the caller loop trivial).
 *
 * `verses[i]` is the text of verse i+1 (1-indexed in output metadata).
 */
export function chunkBibleChapter(
  translation: string,
  bookAbbrev: string,
  chapter: number,
  verses: string[],
  opts: BibleChunkerOpts = {}
): PreparedChunk[] {
  const window = Math.max(1, opts.verseWindow ?? 8);
  const overlap = Math.max(0, Math.min(opts.overlap ?? 2, window - 1));
  const step = window - overlap;
  const total = verses.length;
  if (total === 0) return [];

  const bookDisplay = bookDisplayFor(bookAbbrev);
  const testament: BibleChunkMetadata["testament"] = NT_BOOKS.has(bookAbbrev) ? "NT" : "OT";
  const out: PreparedChunk[] = [];

  for (let start = 0; start < total; start += step) {
    const end = Math.min(start + window, total);
    const slice = verses.slice(start, end);
    const verseStart = start + 1;
    const verseEnd = end;
    const content = slice
      .map((text, i) => `${verseStart + i} ${text}`.replace(/\s+/g, " ").trim())
      .join(" ");
    const metadata: BibleChunkMetadata = {
      kind: "bible",
      translation,
      book: bookAbbrev,
      bookDisplay,
      chapter,
      verseStart,
      verseEnd,
      testament,
    };
    const section = `${bookDisplay} ${chapter}:${verseStart === verseEnd ? verseStart : `${verseStart}-${verseEnd}`}`;
    out.push({ content, section, metadata });
    if (end >= total) break;
  }

  return out;
}
