/**
 * Referência bíblica em texto ("João 3:16", "Romanos 8", "Tiago 1:1-4"),
 * decomposta em partes comparáveis.
 *
 * Client-safe: a tela do resumo usa isto para transformar uma referência escrita
 * no meio de um parágrafo num link que abre a passagem (ver `BlockRenderer`), e
 * o servidor usa o mesmo parser em `/api/verse`, no ancoramento do estudo e na
 * busca por referência. Um segundo parser em qualquer uma dessas pontas faria
 * a tela e o banco discordarem sobre o que "Romanos 8" significa.
 *
 * Este arquivo é o que sobrou de `lib/domain/feed.ts`, que também carregava o
 * schema e os parsers dos cards do feed ao vivo. Os cards morreram com os três
 * modos de captura; o entendimento de referência bíblica não tinha nada a ver
 * com eles e sobreviveu.
 */
export type ParsedVerseReference = {
  /** Nome do livro normalizado para comparação: minúsculo, sem pontuação. */
  book: string;
  /** Nome do livro na caixa original, para remontar a referência na tela. */
  bookDisplay: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
};

const VERSE_REFERENCE_RE = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/;

export function parseVerseReference(ref: string): ParsedVerseReference | null {
  const m = VERSE_REFERENCE_RE.exec(ref.trim());
  if (!m) return null;
  const [, bookRaw, chapterStr, startStr, endStr] = m;
  const chapter = Number.parseInt(chapterStr, 10);
  if (!Number.isFinite(chapter)) return null;
  const startVerse = startStr ? Number.parseInt(startStr, 10) : undefined;
  const endVerse = endStr ? Number.parseInt(endStr, 10) : startVerse;
  const bookDisplay = bookRaw.trim().replace(/\s+/g, " ").replace(/[.,]/g, "");
  return {
    book: bookDisplay.toLowerCase(),
    bookDisplay,
    chapter,
    startVerse,
    endVerse,
  };
}

/**
 * A referência normalizada de uma FAIXA de versículos — "Jonas 1:1-3", ou
 * "Jonas 1:3" quando a faixa tem um só.
 *
 * Ela é a CHAVE do cache de passagens (`["passage", reference]`), e é por isso
 * que mora aqui e não no componente que a desenha: quem a monta na tela
 * (`PassageVerses`) e quem a pré-resolve no servidor (`session/server/passages.ts`)
 * precisam produzir byte a byte a mesma string. Uma diferença de um espaço faria
 * o servidor semear uma entrada que o cliente nunca lê — e o sintoma não seria
 * um erro, seria o esqueleto piscando de novo em toda passagem.
 */
export function formatPassageRange(
  bookDisplay: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): string {
  return endVerse > startVerse
    ? `${bookDisplay} ${chapter}:${startVerse}-${endVerse}`
    : `${bookDisplay} ${chapter}:${startVerse}`;
}
