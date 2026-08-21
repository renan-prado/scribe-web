import { LIVROS_BIBLICOS } from "@/lib/vocabulario";

/**
 * Gate barato de "aqui há menção bíblica" para decidir se vale acordar o LLM
 * do fluxo /api/bible. Roda no cliente antes de cada disparo.
 *
 * Casa:
 *  - Nome de livro (acentos opcionais, ordinais em número/romano/extenso):
 *      "João", "joao", "1 Coríntios", "primeiro corintios", "II Reis"
 *  - Gatilhos de leitura mesmo sem nome de livro no chunk atual (o pastor
 *    entra em leitura anunciando só o capítulo/versículo, ex.: "vamos ao
 *    capítulo 3", "leia o versículo 5"):
 *      "capítulo", "capitulo", "versículo", "versiculo", "verso"
 *  - Padrões `<livro> <cap>[:<verso>[-<verso>]]` quando aparecem juntos.
 *
 * Retorna a lista de matches para uso em logs/diagnóstico. O chamador só
 * precisa saber se `.length > 0`. Não valida referência de fato — isso é
 * responsabilidade do LLM.
 */

export type BibleMention = {
  /** Trecho literal casado (livro ou gatilho), útil pra logging. */
  matched: string;
  /** Posição inicial no texto normalizado. */
  index: number;
  /** true quando o match foi por um gatilho de leitura sem nome de livro. */
  triggerOnly: boolean;
};

const READING_TRIGGERS = ["capitulo", "versiculo", "verso"];

/** Remove acentos para tolerar transcrições sem diacríticos. */
function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Livro normalizado (sem acentos, minúsculas), com o "1/2/3" já removido.
 * Ex.: "1 Coríntios" -> "corintios". O prefixo ordinal é tratado em separado
 * no regex para aceitar "primeiro", "I", "1" etc.
 */
function bookStem(book: string): string {
  const stripped = stripAccents(book).toLowerCase().trim();
  return stripped.replace(/^(?:[123]|i{1,3})\s+/, "");
}

const ORDINAL_PREFIX = "(?:1|2|3|i{1,3}|primeiro|segundo|terceiro)\\s+";

const BOOK_STEMS = Array.from(new Set(LIVROS_BIBLICOS.map(bookStem)))
  // Ordem descendente por tamanho evita que "joao" case dentro de "1 joao".
  .sort((a, b) => b.length - a.length);

// "Salmo" no singular é comum na fala ("Salmo 23"); a lista canônica só tem
// "Salmos". Aceitamos os dois.
const SPECIAL_VARIANTS: Record<string, string[]> = {
  salmos: ["salmos", "salmo"],
};

function bookAlternation(): string {
  const alternatives: string[] = [];
  for (const stem of BOOK_STEMS) {
    const variants = SPECIAL_VARIANTS[stem] ?? [stem];
    for (const v of variants) alternatives.push(escapeRe(v));
  }
  return alternatives.join("|");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BOOK_RE_SOURCE = `\\b(?:${ORDINAL_PREFIX})?(?:${bookAlternation()})\\b`;
const TRIGGER_RE_SOURCE = `\\b(?:${READING_TRIGGERS.map(escapeRe).join("|")})\\b`;

const DETECTOR_RE = new RegExp(`${BOOK_RE_SOURCE}|${TRIGGER_RE_SOURCE}`, "gi");
const BOOK_ONLY_RE = new RegExp(BOOK_RE_SOURCE, "i");

export function detectBibleMentions(text: string): BibleMention[] {
  if (!text) return [];
  const normalized = stripAccents(text).toLowerCase();
  const out: BibleMention[] = [];
  DETECTOR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (true) {
    m = DETECTOR_RE.exec(normalized);
    if (!m) break;
    const matched = m[0];
    const triggerOnly = !BOOK_ONLY_RE.test(matched);
    out.push({ matched, index: m.index, triggerOnly });
  }
  return out;
}

export function hasBibleMention(text: string): boolean {
  if (!text) return false;
  DETECTOR_RE.lastIndex = 0;
  return DETECTOR_RE.test(stripAccents(text).toLowerCase());
}
