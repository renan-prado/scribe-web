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
  // Jó, "jo" after diacritic strip (distinct from "joao")
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
  // João (gospel), "joao" after diacritic strip
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
 * isn't recognized. Client-safe (no fs/network), reads from the generated
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

/**
 * Os 66 livros em ordem canônica, com o nome como se ESCREVE.
 *
 * `BOOK_ABBREVS` acima responde a outra pergunta: ele parte de um nome escrito
 * por um modelo ou por gente ("i corintios", "cantico de salomao", "revelacao")
 * e diz qual livro é. Não dá para inverter esse mapa para montar uma lista:
 * ele tem apelido demais, está sem acento por construção (a normalização come
 * os acentos antes da busca) e a ordem dele é a de escrita, não a da Bíblia.
 *
 * Esta lista existe para OFERECER: é dela que sai o seletor de passagem do
 * editor de `/escrever`. O `name` é a forma canônica — com acento, com o
 * numeral arábico — e é ele que entra na referência gravada no bloco
 * (`"1 Coríntios 13:4-7"`), o que fecha o círculo: `normalizeBookName(name)`
 * cai numa chave de `BOOK_ABBREVS`, e o `abbrev` ao lado é o mesmo que a busca
 * devolveria. Client-safe como o resto do arquivo.
 */
export type CanonBook = {
  name: string;
  abbrev: string;
  testament: "antigo" | "novo";
};

export const BOOK_CANON: CanonBook[] = [
  { name: "Gênesis", abbrev: "Gn", testament: "antigo" },
  { name: "Êxodo", abbrev: "Êx", testament: "antigo" },
  { name: "Levítico", abbrev: "Lv", testament: "antigo" },
  { name: "Números", abbrev: "Nm", testament: "antigo" },
  { name: "Deuteronômio", abbrev: "Dt", testament: "antigo" },
  { name: "Josué", abbrev: "Js", testament: "antigo" },
  { name: "Juízes", abbrev: "Jz", testament: "antigo" },
  { name: "Rute", abbrev: "Rt", testament: "antigo" },
  { name: "1 Samuel", abbrev: "1Sm", testament: "antigo" },
  { name: "2 Samuel", abbrev: "2Sm", testament: "antigo" },
  { name: "1 Reis", abbrev: "1Rs", testament: "antigo" },
  { name: "2 Reis", abbrev: "2Rs", testament: "antigo" },
  { name: "1 Crônicas", abbrev: "1Cr", testament: "antigo" },
  { name: "2 Crônicas", abbrev: "2Cr", testament: "antigo" },
  { name: "Esdras", abbrev: "Ed", testament: "antigo" },
  { name: "Neemias", abbrev: "Ne", testament: "antigo" },
  { name: "Ester", abbrev: "Et", testament: "antigo" },
  { name: "Jó", abbrev: "Jó", testament: "antigo" },
  { name: "Salmos", abbrev: "Sl", testament: "antigo" },
  { name: "Provérbios", abbrev: "Pv", testament: "antigo" },
  { name: "Eclesiastes", abbrev: "Ec", testament: "antigo" },
  { name: "Cânticos", abbrev: "Ct", testament: "antigo" },
  { name: "Isaías", abbrev: "Is", testament: "antigo" },
  { name: "Jeremias", abbrev: "Jr", testament: "antigo" },
  { name: "Lamentações", abbrev: "Lm", testament: "antigo" },
  { name: "Ezequiel", abbrev: "Ez", testament: "antigo" },
  { name: "Daniel", abbrev: "Dn", testament: "antigo" },
  { name: "Oseias", abbrev: "Os", testament: "antigo" },
  { name: "Joel", abbrev: "Jl", testament: "antigo" },
  { name: "Amós", abbrev: "Am", testament: "antigo" },
  { name: "Obadias", abbrev: "Ob", testament: "antigo" },
  { name: "Jonas", abbrev: "Jn", testament: "antigo" },
  { name: "Miqueias", abbrev: "Mq", testament: "antigo" },
  { name: "Naum", abbrev: "Na", testament: "antigo" },
  { name: "Habacuque", abbrev: "Hc", testament: "antigo" },
  { name: "Sofonias", abbrev: "Sf", testament: "antigo" },
  { name: "Ageu", abbrev: "Ag", testament: "antigo" },
  { name: "Zacarias", abbrev: "Zc", testament: "antigo" },
  { name: "Malaquias", abbrev: "Ml", testament: "antigo" },
  { name: "Mateus", abbrev: "Mt", testament: "novo" },
  { name: "Marcos", abbrev: "Mc", testament: "novo" },
  { name: "Lucas", abbrev: "Lc", testament: "novo" },
  { name: "João", abbrev: "Jo", testament: "novo" },
  { name: "Atos", abbrev: "At", testament: "novo" },
  { name: "Romanos", abbrev: "Rm", testament: "novo" },
  { name: "1 Coríntios", abbrev: "1Co", testament: "novo" },
  { name: "2 Coríntios", abbrev: "2Co", testament: "novo" },
  { name: "Gálatas", abbrev: "Gl", testament: "novo" },
  { name: "Efésios", abbrev: "Ef", testament: "novo" },
  { name: "Filipenses", abbrev: "Fp", testament: "novo" },
  { name: "Colossenses", abbrev: "Cl", testament: "novo" },
  { name: "1 Tessalonicenses", abbrev: "1Ts", testament: "novo" },
  { name: "2 Tessalonicenses", abbrev: "2Ts", testament: "novo" },
  { name: "1 Timóteo", abbrev: "1Tm", testament: "novo" },
  { name: "2 Timóteo", abbrev: "2Tm", testament: "novo" },
  { name: "Tito", abbrev: "Tt", testament: "novo" },
  { name: "Filemom", abbrev: "Fm", testament: "novo" },
  { name: "Hebreus", abbrev: "Hb", testament: "novo" },
  { name: "Tiago", abbrev: "Tg", testament: "novo" },
  { name: "1 Pedro", abbrev: "1Pe", testament: "novo" },
  { name: "2 Pedro", abbrev: "2Pe", testament: "novo" },
  { name: "1 João", abbrev: "1Jo", testament: "novo" },
  { name: "2 João", abbrev: "2Jo", testament: "novo" },
  { name: "3 João", abbrev: "3Jo", testament: "novo" },
  { name: "Judas", abbrev: "Jd", testament: "novo" },
  { name: "Apocalipse", abbrev: "Ap", testament: "novo" },
];

/** Quantos capítulos o livro tem. `0` quando o livro não é reconhecido. */
export function chapterCountFor(bookFullName: string): number {
  const abbrev = abbrevFor(bookFullName);
  if (!abbrev) return 0;
  return CHAPTER_VERSE_COUNTS[abbrev]?.length ?? 0;
}

/**
 * Um capítulo QUALQUER da Bíblia, sorteado: "Gênesis 5", "Tiago 2".
 *
 * ## Para que ele existe
 *
 * Para o chip de abertura do Biblo na folha em branco. Ele era uma string fixa
 * — "Vamos falar sobre João 1?" — e uma sugestão fixa envelhece na segunda vez
 * que alguém a vê: ela deixa de ser um convite e vira parte da moldura, como um
 * rótulo. Sorteando, a mesma pastilha propõe uma porta diferente a cada
 * conversa, e a Bíblia inteira passa a caber num botão só.
 *
 * ## O sorteio é sobre CAPÍTULOS, não sobre livros
 *
 * Um índice uniforme entre os 66 livros faria Obadias (1 capítulo) aparecer
 * tanto quanto Salmos (150), o que não é "um capítulo qualquer da Bíblia": é
 * "um livro qualquer, e depois um pedaço dele". Aqui o sorteio corre sobre os
 * 1.189 capítulos do cânone, então cada um tem exatamente a mesma chance — que
 * é o que a frase promete.
 *
 * `random` é injetável para o teste poder fixar o resultado; em produção
 * ninguém passa nada.
 */
export function randomChapterReference(random: () => number = Math.random): string {
  let total = 0;
  for (const book of BOOK_CANON) total += CHAPTER_VERSE_COUNTS[book.abbrev]?.length ?? 0;
  if (total === 0) return "João 1";

  let target = Math.floor(random() * total);
  for (const book of BOOK_CANON) {
    const chapters = CHAPTER_VERSE_COUNTS[book.abbrev]?.length ?? 0;
    if (target < chapters) return `${book.name} ${target + 1}`;
    target -= chapters;
  }
  // Inalcançável: a soma acima é a mesma que a varredura consome. A saída
  // existe porque um `random()` que devolvesse exatamente 1 cairia aqui, e um
  // `undefined` no chip é pior que o primeiro capítulo do primeiro livro.
  return `${BOOK_CANON[0].name} 1`;
}
