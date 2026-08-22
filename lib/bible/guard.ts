import { detectBibleMentions } from "@/lib/bible/detect";
import { parseVerseReference } from "@/lib/domain/feed";

/**
 * Bible guard — camada 2 do gate de `/api/bible`.
 *
 * A camada 1 (regex barato em `hasBibleMention`) filtra chunks sem qualquer
 * sinal de menção bíblica. Quando ela passa, chamamos este guard para decidir
 * se vale mesmo acordar o LLM. Em vez de bool, retornamos uma soma de sinais
 * ponderados — assim os pesos podem ser calibrados via telemetria sem
 * reescrever a lógica.
 *
 * Sinais positivos (indicam anúncio ou continuação real de leitura):
 *   +4  bookWithNumber        "João 3:16", "Salmo 23"
 *   +3  readingVerbNear       verbo de leitura numa janela de N palavras
 *   +3  continuationHit       trigger + currentReading ainda fresco
 *   +3  congregationalCue     "leiam comigo", "abram as bíblias"
 *   +2  triggerWithNumber     "versículo 10", "capítulo 3"
 *   +2  verseProgression      número próximo do currentReading.verse (+1..+5)
 *
 * Sinais negativos (indicam discussão, não leitura):
 *   -5  duplicateEmit         mesma referência do lastEmit dentro do cooldown
 *   -4  demonstrativeAnaphora "nesse salmo", "esse mesmo versículo"
 *   -3  bookRepeatNoNumber    mesmo livro do currentReading, sem número
 *   -2  pastTenseNear         "li", "lemos", "acabei de ler" perto do match
 *
 * Cada sinal contribui no máximo uma vez por chamada — se o mesmo livro é
 * mencionado 3x, `bookWithNumber` soma +4, não +12.
 */

export type GuardCurrentReading = {
  /** Stem canônico do livro (sem acentos, lowercase, sem ordinal). */
  book: string;
  /** Forma exibível preservada para logs/UI. */
  bookDisplay: string;
  chapter: number;
  verse?: number;
  updatedAtMs: number;
};

export type GuardLastEmit = {
  reference: string;
  atMs: number;
};

export type GuardContext = {
  currentReading: GuardCurrentReading | null;
  lastEmit: GuardLastEmit | null;
  nowMs: number;
  /** Frescor do currentReading para habilitar continuationHit. */
  currentReadingTtlMs: number;
  /** Janela em que duplicateEmit ainda vale. */
  cooldownMs: number;
  /** Palavras ao redor do match consideradas em readingVerbNear/pastTenseNear. */
  verbWindowWords: number;
};

export type GuardSignalName =
  | "bookWithNumber"
  | "readingVerbNear"
  | "continuationHit"
  | "congregationalCue"
  | "triggerWithNumber"
  | "verseProgression"
  | "duplicateEmit"
  | "demonstrativeAnaphora"
  | "bookRepeatNoNumber"
  | "pastTenseNear";

export type GuardSignal = {
  name: GuardSignalName;
  weight: number;
  matched: string;
};

export type GuardResult = {
  score: number;
  threshold: number;
  signals: GuardSignal[];
  decision: "fire" | "skip";
};

const SIGNAL_WEIGHTS: Record<GuardSignalName, number> = {
  bookWithNumber: 4,
  readingVerbNear: 3,
  continuationHit: 3,
  congregationalCue: 3,
  triggerWithNumber: 2,
  verseProgression: 2,
  duplicateEmit: -5,
  demonstrativeAnaphora: -4,
  bookRepeatNoNumber: -3,
  pastTenseNear: -2,
};

const ORDINAL_PREFIX_RE = /^(?:[123]|iii|ii|i|primeiro|segundo|terceiro)\s+/;

const DEMONSTRATIVES = new Set([
  "nesse",
  "neste",
  "desse",
  "deste",
  "naquele",
  "daquele",
  "nele",
  "esse",
  "este",
  "essa",
  "esta",
  "aquele",
  "aquela",
  "mesmo",
  "mesma",
  "tal",
]);

const READING_VERB_WORDS = new Set([
  "leia",
  "leiam",
  "leamos",
  "leiamos",
  "ler",
  "abra",
  "abram",
  "abrir",
  "olhe",
  "olhem",
  "olha",
  "acompanhe",
  "acompanhem",
  "conforme",
  "segundo",
]);

const READING_VERB_PHRASES: readonly RegExp[] = [
  /\bvamos a(?:brir)?\b/,
  /\bvamos ler\b/,
  /\bvamos ao\b/,
  /\bvamos para o?\b/,
  /\best[ao] escrito\b/,
  /\bdiz o (?:texto|verso|versiculo|senhor)\b/,
];

const CONGREGATIONAL_CUES: readonly RegExp[] = [
  /\bleiam? comigo\b/,
  /\bvamos abrir juntos\b/,
  /\babra(?:m)? (?:as )?biblias?\b/,
  /\bacompanhe(?:m)? (?:comigo|na biblia|na sua biblia)\b/,
];

const PAST_TENSE_WORDS = new Set(["li", "lemos", "leu", "leram", "lida", "lido"]);

const PAST_TENSE_PHRASES: readonly RegExp[] = [
  /\bacabei de ler\b/,
  /\bestava lendo\b/,
  /\bfoi lido\b/,
];

const TRAILING_NUMBER_RE = /^\s*(\d{1,3})(?::(\d{1,3})(?:[- ](\d{1,3}))?)?/;

/**
 * Stem canônico de livro. Aceita entrada acentuada ou já normalizada; devolve
 * a mesma chave estável usada tanto no candidato do texto quanto no
 * `currentReading.book`. "Salmo" e "Salmos" colapsam pra "salmos" pra bater
 * com o resto do sistema (`LIVROS_BIBLICOS` só tem a forma plural).
 */
export function canonicalBookStem(input: string): string {
  const normalized = stripAccents(input).toLowerCase().trim();
  const noOrdinal = normalized.replace(ORDINAL_PREFIX_RE, "");
  if (noOrdinal === "salmo") return "salmos";
  return noOrdinal;
}

function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type Candidate = {
  matched: string;
  matchedLen: number;
  index: number;
  triggerOnly: boolean;
  triggerKind?: "capitulo" | "versiculo" | "verso";
  bookStem?: string;
  chapter?: number;
  verse?: number;
};

function extractCandidates(text: string, normalized: string): Candidate[] {
  const mentions = detectBibleMentions(text);
  const out: Candidate[] = [];
  for (const m of mentions) {
    const matchedLen = m.matched.length;
    const tail = normalized.slice(m.index + matchedLen, m.index + matchedLen + 30);
    const numMatch = TRAILING_NUMBER_RE.exec(tail);
    let chapter: number | undefined;
    let verse: number | undefined;
    let triggerKind: Candidate["triggerKind"];
    if (m.triggerOnly) {
      triggerKind =
        m.matched === "capitulo" ? "capitulo" : m.matched === "verso" ? "verso" : "versiculo";
      if (numMatch) {
        const n = Number.parseInt(numMatch[1], 10);
        if (Number.isFinite(n)) {
          if (triggerKind === "capitulo") chapter = n;
          else verse = n;
        }
      }
    } else if (numMatch) {
      const c = Number.parseInt(numMatch[1], 10);
      if (Number.isFinite(c)) chapter = c;
      if (numMatch[2]) {
        const v = Number.parseInt(numMatch[2], 10);
        if (Number.isFinite(v)) verse = v;
      }
    }
    out.push({
      matched: m.matched,
      matchedLen,
      index: m.index,
      triggerOnly: m.triggerOnly,
      triggerKind,
      bookStem: m.triggerOnly ? undefined : canonicalBookStem(m.matched),
      chapter,
      verse,
    });
  }
  return out;
}

function wordsAround(
  normalized: string,
  index: number,
  matchedLen: number,
  windowWords: number
): string[] {
  const before = normalized
    .slice(Math.max(0, index - 200), index)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-windowWords);
  const after = normalized
    .slice(index + matchedLen, index + matchedLen + 200)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, windowWords);
  return [...before, ...after];
}

function precededByDemonstrative(normalized: string, index: number): boolean {
  const before = normalized
    .slice(Math.max(0, index - 60), index)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-3);
  return before.some((w) => DEMONSTRATIVES.has(stripAlpha(w)));
}

function stripAlpha(word: string): string {
  return word.replace(/[^a-z]/g, "");
}

function hasReadingVerbNear(
  normalized: string,
  index: number,
  matchedLen: number,
  windowWords: number
): boolean {
  const words = wordsAround(normalized, index, matchedLen, windowWords);
  if (words.some((w) => READING_VERB_WORDS.has(stripAlpha(w)))) return true;
  const chunk = normalized.slice(
    Math.max(0, index - 60),
    Math.min(normalized.length, index + matchedLen + 60)
  );
  return READING_VERB_PHRASES.some((re) => re.test(chunk));
}

function hasPastTenseNear(
  normalized: string,
  index: number,
  matchedLen: number,
  windowWords: number
): boolean {
  const words = wordsAround(normalized, index, matchedLen, windowWords);
  if (words.some((w) => PAST_TENSE_WORDS.has(stripAlpha(w)))) return true;
  const chunk = normalized.slice(
    Math.max(0, index - 60),
    Math.min(normalized.length, index + matchedLen + 60)
  );
  return PAST_TENSE_PHRASES.some((re) => re.test(chunk));
}

function hasCongregationalCue(normalized: string): boolean {
  return CONGREGATIONAL_CUES.some((re) => re.test(normalized));
}

function currentReadingFresh(ctx: GuardContext): boolean {
  if (!ctx.currentReading) return false;
  return ctx.nowMs - ctx.currentReading.updatedAtMs <= ctx.currentReadingTtlMs;
}

/**
 * True se o candidato aponta pra mesma passagem que `lastRef`. Se o candidato
 * não tem verso, basta livro+capítulo baterem (a discussão da mesma passagem
 * ainda é duplicata do ponto de vista do card).
 */
function candidateMatchesRef(
  cand: Candidate,
  lastRef: { book: string; chapter: number; startVerse?: number; endVerse?: number }
): boolean {
  const lastStem = canonicalBookStem(lastRef.book);
  if (cand.bookStem !== lastStem) return false;
  if (cand.chapter != null && cand.chapter !== lastRef.chapter) return false;
  if (cand.verse != null && lastRef.startVerse != null) {
    return (
      cand.verse >= lastRef.startVerse && cand.verse <= (lastRef.endVerse ?? lastRef.startVerse)
    );
  }
  return true;
}

/**
 * Executa a análise ponderada. Sempre roda depois de `hasBibleMention` ter
 * passado — nunca antes.
 */
export function scoreBibleGuard(text: string, ctx: GuardContext, threshold: number): GuardResult {
  const normalized = stripAccents(text).toLowerCase();
  const candidates = extractCandidates(text, normalized);
  const seen = new Set<GuardSignalName>();
  const signals: GuardSignal[] = [];

  const push = (name: GuardSignalName, matched: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    signals.push({ name, weight: SIGNAL_WEIGHTS[name], matched });
  };

  const fresh = currentReadingFresh(ctx);
  const lastRef = ctx.lastEmit ? parseVerseReference(ctx.lastEmit.reference) : null;
  const cooldownActive = ctx.lastEmit != null && ctx.nowMs - ctx.lastEmit.atMs < ctx.cooldownMs;

  for (const cand of candidates) {
    const hasNumber = cand.chapter != null || cand.verse != null;

    if (cand.triggerOnly) {
      if (hasNumber) push("triggerWithNumber", cand.matched);
      if (fresh) push("continuationHit", cand.matched);
    } else {
      if (cand.chapter != null) {
        push("bookWithNumber", cand.matched);
      } else if (
        ctx.currentReading &&
        cand.bookStem != null &&
        cand.bookStem === ctx.currentReading.book
      ) {
        push("bookRepeatNoNumber", cand.matched);
      }
    }

    if (!hasNumber && precededByDemonstrative(normalized, cand.index)) {
      push("demonstrativeAnaphora", cand.matched);
    }

    if (hasReadingVerbNear(normalized, cand.index, cand.matchedLen, ctx.verbWindowWords)) {
      push("readingVerbNear", cand.matched);
    }

    if (hasPastTenseNear(normalized, cand.index, cand.matchedLen, ctx.verbWindowWords)) {
      push("pastTenseNear", cand.matched);
    }

    if (cand.verse != null && ctx.currentReading?.verse != null) {
      const diff = cand.verse - ctx.currentReading.verse;
      if (diff >= 1 && diff <= 5) push("verseProgression", `+${diff}`);
    }

    if (cooldownActive && lastRef && candidateMatchesRef(cand, lastRef)) {
      push("duplicateEmit", ctx.lastEmit?.reference ?? "");
    }
  }

  if (hasCongregationalCue(normalized)) {
    push("congregationalCue", "cue");
  }

  const score = signals.reduce((sum, s) => sum + s.weight, 0);
  return {
    score,
    threshold,
    signals,
    decision: score >= threshold ? "fire" : "skip",
  };
}
