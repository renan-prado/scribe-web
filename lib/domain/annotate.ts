import { BIBLE_PEOPLE, BIBLE_PLACES, CITED_FIGURES } from "@/lib/domain/lexicon";
import { LIVROS_BIBLICOS } from "@/lib/vocabulario";

/**
 * Quebra um parágrafo em pedaços anotados, para o `RichText` desenhar
 * referência bíblica clicável e nome próprio marcado no meio da prosa.
 *
 * Client-safe e SEM IA: é varredura de regex sobre um léxico curado
 * (`lib/domain/lexicon.ts`). Uma etapa de LLM para "marcar as entidades" seria
 * mais uma chamada por sessão, com custo, latência e a chance de o modelo
 * marcar coisa que não está no texto — para um problema que um autômato
 * resolve, com o mesmo resultado toda vez.
 *
 * ## Duas passadas, nesta ordem
 *
 * 1. **Referência bíblica.** Exige NÚMERO de capítulo: "João 3:16" e "Romanos 8"
 *    casam, "João" sozinho não. É o que separa o evangelho do apóstolo — e é
 *    por isso que esta passada vem primeiro: ela consome "João 3:16" inteiro,
 *    e a passada de nomes nunca chega a ver aquele "João".
 * 2. **Nome próprio**, só nos vãos que sobraram da primeira.
 *
 * ## Por que não `\b`
 *
 * O `\b` do JavaScript é ASCII: em "José." a fronteira entre `é` e `.` não
 * existe, porque nenhum dos dois é caractere de palavra para o motor de regex.
 * Um `\bJosé\b` simplesmente não casa no fim de uma frase. A direita é
 * resolvida com lookahead sobre uma classe de letras explícita; a esquerda é
 * conferida no código, olhando o caractere anterior — `lookbehind` resolveria
 * em uma linha, mas construir a RegExp lançaria em navegador antigo, e um
 * throw no import em branco a página inteira.
 */

export type AnnotatedSegment =
  | { kind: "text"; text: string }
  /** Referência com capítulo (e talvez versículo). `reference` é o que vai para o diálogo. */
  | { kind: "scripture"; text: string; reference: string }
  | { kind: "name"; text: string; category: NameCategory };

export type NameCategory = "person" | "place" | "figure";

/** Classe de letra (com acento) usada nas fronteiras de palavra. */
const LETTER = "A-Za-zÀ-ÖØ-öø-ÿ";
const LETTER_RE = new RegExp(`[${LETTER}]`);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mais longo primeiro: "Martinho Lutero" tem de vencer "Lutero", e
 * "Maria Madalena" tem de vencer "Maria". */
function byLengthDesc(a: string, b: string): number {
  return b.length - a.length;
}

// "Salmo 23" no singular é como quase todo mundo escreve; a lista canônica só
// tem "Salmos".
const BOOK_ALTERNATION = [...LIVROS_BIBLICOS, "Salmo"].sort(byLengthDesc).map(escapeRe).join("|");

/**
 * `<livro> <capítulo>[:<versículo>[-<versículo>]]`.
 *
 * O capítulo é obrigatório — ver a nota sobre a ordem das passadas acima. O
 * intervalo aceita hífen e travessão porque o modelo escreve os dois. O ponto
 * como separador de versículo ("João 3.16") ficou de FORA: ele transformaria
 * "Romanos 8. 15 pessoas…" numa referência, e o texto de resumo escreve com
 * dois-pontos.
 */
const SCRIPTURE_RE = new RegExp(
  `(?:${BOOK_ALTERNATION})\\s+\\d{1,3}(?:\\s*:\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)?(?![${LETTER}0-9])`,
  "g"
);

const NAME_ENTRIES: { term: string; category: NameCategory }[] = [
  ...BIBLE_PEOPLE.map((term) => ({ term, category: "person" as const })),
  ...BIBLE_PLACES.map((term) => ({ term, category: "place" as const })),
  ...CITED_FIGURES.map((term) => ({ term, category: "figure" as const })),
];

/** Um termo em duas listas (nome que também é lugar) fica com a primeira. */
const NAME_CATEGORY = new Map<string, NameCategory>();
for (const { term, category } of NAME_ENTRIES) {
  if (!NAME_CATEGORY.has(term)) NAME_CATEGORY.set(term, category);
}

const NAME_RE = new RegExp(
  `(?:${[...NAME_CATEGORY.keys()].sort(byLengthDesc).map(escapeRe).join("|")})(?![${LETTER}])`,
  "g"
);

/** Casou de verdade, ou o padrão pegou o fim de uma palavra maior? */
function startsAtWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  return !LETTER_RE.test(text[index - 1]);
}

type Match = { start: number; end: number; segment: AnnotatedSegment };

function scan(
  text: string,
  re: RegExp,
  toSegment: (matched: string) => AnnotatedSegment | null
): Match[] {
  const out: Match[] = [];
  re.lastIndex = 0;
  let m = re.exec(text);
  while (m) {
    const matched = m[0];
    if (startsAtWordBoundary(text, m.index)) {
      const segment = toSegment(matched);
      if (segment) out.push({ start: m.index, end: m.index + matched.length, segment });
    }
    m = re.exec(text);
  }
  return out;
}

export function annotateText(text: string): AnnotatedSegment[] {
  if (!text) return [];

  const scripture = scan(text, SCRIPTURE_RE, (matched) => ({
    kind: "scripture",
    text: matched,
    // A referência que vai ao diálogo é normalizada: o parser de
    // `parseVerseReference` e a rota /api/verse esperam "Livro 3:16", sem o
    // espaço solto que o modelo às vezes deixa em volta dos dois-pontos.
    reference: matched.replace(/\s*:\s*/, ":").replace(/\s*[-–]\s*/, "-"),
  }));

  const covered = (from: number, to: number) => scripture.some((s) => from < s.end && to > s.start);

  const names = scan(text, NAME_RE, (matched) => {
    const category = NAME_CATEGORY.get(matched);
    return category ? { kind: "name", text: matched, category } : null;
  }).filter((m) => !covered(m.start, m.end));

  const matches = [...scripture, ...names].sort((a, b) => a.start - b.start);

  const segments: AnnotatedSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    // Duas menções de nome podem se sobrepor quando uma contém a outra e a
    // ordenação por comprimento não resolveu (listas diferentes). A primeira
    // vence; a segunda é descartada.
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.start) });
    }
    segments.push(match.segment);
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });

  return segments;
}
