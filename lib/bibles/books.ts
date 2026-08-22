/**
 * Maps normalized Portuguese book names → JSON abbreviations used in the
 * Bible files (lib/bibles/*.json). Normalization strips diacritics, lowercases,
 * and collapses whitespace so "2 Timóteo" → "2 timoteo" → "2Tm".
 *
 * Covers the primary extract-model output (full names with Arabic numeral
 * prefixes) plus common spoken variants (Roman numerals, ordinal words).
 */

import { CHAPTER_VERSE_COUNTS } from "./chapter-lengths";

export const BOOK_ABBREVS: Record<string, string> = {
  // ── Old Testament ─────────────────────────────────────────────────────────
  genesis: "Gn",
  genese: "Gn",
  exodo: "Êx",
  exodus: "Êx",
  levitico: "Lv",
  numeros: "Nm",
  deuteronomio: "Dt",
  josue: "Js",
  juizes: "Jz",
  rute: "Rt",
  // 1 Samuel
  "1 samuel": "1Sm",
  "i samuel": "1Sm",
  "primeiro samuel": "1Sm",
  // 2 Samuel
  "2 samuel": "2Sm",
  "ii samuel": "2Sm",
  "segundo samuel": "2Sm",
  // 1 Reis
  "1 reis": "1Rs",
  "i reis": "1Rs",
  "primeiro reis": "1Rs",
  // 2 Reis
  "2 reis": "2Rs",
  "ii reis": "2Rs",
  "segundo reis": "2Rs",
  // 1 Crônicas
  "1 cronicas": "1Cr",
  "i cronicas": "1Cr",
  "primeiro cronicas": "1Cr",
  "1 cronicas do reino": "1Cr",
  // 2 Crônicas
  "2 cronicas": "2Cr",
  "ii cronicas": "2Cr",
  "segundo cronicas": "2Cr",
  "2 cronicas do reino": "2Cr",
  esdras: "Ed",
  neemias: "Ne",
  ester: "Et",
  // Jó — "jo" after diacritic strip (distinct from "joao")
  jo: "Jó",
  job: "Jó",
  salmo: "Sl",
  salmos: "Sl",
  proverbios: "Pv",
  proverbio: "Pv",
  eclesiastes: "Ec",
  canticos: "Ct",
  cantares: "Ct",
  "cantico dos canticos": "Ct",
  "cantico de salomao": "Ct",
  isaias: "Is",
  jeremias: "Jr",
  lamentacoes: "Lm",
  lamentacao: "Lm",
  ezequiel: "Ez",
  daniel: "Dn",
  oseias: "Os",
  joel: "Jl",
  amos: "Am",
  obadias: "Ob",
  jonas: "Jn",
  miqueias: "Mq",
  naum: "Na",
  habacuque: "Hc",
  sofonias: "Sf",
  ageu: "Ag",
  zacarias: "Zc",
  malaquias: "Ml",

  // ── New Testament ─────────────────────────────────────────────────────────
  mateus: "Mt",
  marcos: "Mc",
  lucas: "Lc",
  // João (gospel) — "joao" after diacritic strip
  joao: "Jo",
  atos: "At",
  "atos dos apostolos": "At",
  "atos dos apostolos de jesus cristo": "At",
  romanos: "Rm",
  // 1 Coríntios
  "1 corintios": "1Co",
  "i corintios": "1Co",
  "primeiro corintios": "1Co",
  // 2 Coríntios
  "2 corintios": "2Co",
  "ii corintios": "2Co",
  "segundo corintios": "2Co",
  galatas: "Gl",
  efesios: "Ef",
  filipenses: "Fp",
  colossenses: "Cl",
  // 1 Tessalonicenses
  "1 tessalonicenses": "1Ts",
  "i tessalonicenses": "1Ts",
  "primeiro tessalonicenses": "1Ts",
  "1 tessalonicenses a": "1Ts",
  // 2 Tessalonicenses
  "2 tessalonicenses": "2Ts",
  "ii tessalonicenses": "2Ts",
  "segundo tessalonicenses": "2Ts",
  "2 tessalonicenses a": "2Ts",
  // 1 Timóteo
  "1 timoteo": "1Tm",
  "i timoteo": "1Tm",
  "primeiro timoteo": "1Tm",
  // 2 Timóteo
  "2 timoteo": "2Tm",
  "ii timoteo": "2Tm",
  "segundo timoteo": "2Tm",
  tito: "Tt",
  filemom: "Fm",
  filemao: "Fm",
  hebreus: "Hb",
  tiago: "Tg",
  // 1 Pedro
  "1 pedro": "1Pe",
  "i pedro": "1Pe",
  "primeiro pedro": "1Pe",
  // 2 Pedro
  "2 pedro": "2Pe",
  "ii pedro": "2Pe",
  "segundo pedro": "2Pe",
  // 1 João
  "1 joao": "1Jo",
  "i joao": "1Jo",
  "primeiro joao": "1Jo",
  // 2 João
  "2 joao": "2Jo",
  "ii joao": "2Jo",
  "segundo joao": "2Jo",
  // 3 João
  "3 joao": "3Jo",
  "iii joao": "3Jo",
  "terceiro joao": "3Jo",
  judas: "Jd",
  apocalipse: "Ap",
  revelacao: "Ap",
};

/** Normalize a book name for lookup: lowercase, strip diacritics, collapse spaces, strip punctuation. */
export function normalizeBookName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Return the JSON abbrev for a full Portuguese book name, or null if not recognized. */
export function abbrevFor(fullName: string): string | null {
  return BOOK_ABBREVS[normalizeBookName(fullName)] ?? null;
}

/**
 * Number of verses in a given chapter of a book, or null when the book/chapter
 * isn't recognized. Client-safe (no fs/network) — reads from the generated
 * chapter-lengths.ts metadata. Used by ReadingPassage to cap lookahead prefetch
 * so we don't burn /api/verse calls on verses that don't exist (e.g. Matthew 3
 * only has 17 verses, prefetching v18-v23 is pure waste).
 */
export function chapterVerseCount(bookFullName: string, chapter: number): number | null {
  const abbrev = abbrevFor(bookFullName);
  if (!abbrev) return null;
  const chapters = CHAPTER_VERSE_COUNTS[abbrev];
  if (!chapters) return null;
  return chapters[chapter - 1] ?? null;
}
