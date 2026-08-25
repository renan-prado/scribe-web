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
  // Infinitivo — "convido a abrir a bíblia", "queria abrir nossa bíblia"
  /\babrir (?:a |as |nossa |nossas |sua |suas |minha |o )?biblias?\b/,
  // Anúncio litúrgico do evangelho — "Evangelho de São Mateus", "Evangelho segundo João"
  /\bevangelho (?:de |segundo )(?:sao |são )?[a-zà-ÿ]+/i,
  // Anúncio litúrgico de leitura — "leitura da carta aos coríntios", "leitura do livro de..."
  /\bleitura d[aoe] (?:primeira |segunda |terceira |i |ii |iii )?(?:carta|epistola|livro|evangelho|profeta|salmo)/i,
  // Marcadores de recitação — "diz assim a palavra do Senhor/de Deus"
  /\bdiz (?:assim )?a? palavra d[eo] (?:deus|senhor)\b/,
];

const PAST_TENSE_WORDS = new Set(["li", "lemos", "leu", "leram", "lida", "lido"]);

const PAST_TENSE_PHRASES: readonly RegExp[] = [
  /\bacabei de ler\b/,
  /\bestava lendo\b/,
  /\bfoi lido\b/,
];

const TRAILING_NUMBER_RE = /^\s*(\d{1,3})(?::(\d{1,3})(?:[- ](\d{1,3}))?)?/;

// Filler comum entre trigger e número: "capítulo de número oito", "versículo nº 5",
// "capítulo número 3". Consumido antes de tentar extrair o número.
const NUMBER_FILLER_RE = /^\s*(?:de\s+(?:numero|no\.?)\s+|numero\s+|no\.?\s+)?/;

// Cardinais 0-100 em pt-BR. Cobrem os números realistas para cap/verso.
const CARDINAL_PT: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
};

/**
 * Tenta ler um número por extenso no início de `input` (já sem acentos).
 * Aceita composições simples com "e" ("vinte e três", "cento e cinco").
 * Retorna { value, consumedLen } contando espaços iniciais, ou null.
 */
function parseWrittenNumberPt(input: string): { value: number; consumedLen: number } | null {
  const leadingWs = input.match(/^\s*/)?.[0].length ?? 0;
  const body = input.slice(leadingWs);
  const first = body.match(/^([a-z]+)/i);
  if (!first) return null;
  const w1 = first[1].toLowerCase();
  const v1 = CARDINAL_PT[w1];
  if (v1 == null) return null;
  const after1 = body.slice(first[1].length);
  const compound = after1.match(/^\s+e\s+([a-z]+)/i);
  if (compound) {
    const w2 = compound[1].toLowerCase();
    const v2 = CARDINAL_PT[w2];
    // Composição válida: dezena+unidade (20+3), centena+unidade (100+5), centena+dezena (100+20)
    if (
      v2 != null &&
      ((v1 >= 20 && v1 < 100 && v2 > 0 && v2 < 10) || (v1 === 100 && v2 > 0 && v2 < 100))
    ) {
      return { value: v1 + v2, consumedLen: leadingWs + first[1].length + compound[0].length };
    }
  }
  return { value: v1, consumedLen: leadingWs + first[1].length };
}

/**
 * Extrai o número que segue um trigger, aceitando dígitos ou extenso, e
 * absorvendo filler comum ("de número", "nº"). Retorna { chapter?, verse?,
 * endVerse? } quando dígito casa o padrão N:M ou N-M; para extenso retorna
 * apenas o primeiro número.
 */
function extractTrailingNumberInfo(tail: string): {
  chapter?: number;
  verse?: number;
  endVerse?: number;
} {
  const fillerMatch = NUMBER_FILLER_RE.exec(tail);
  const stripped = tail.slice(fillerMatch?.[0].length ?? 0);
  const digitMatch = TRAILING_NUMBER_RE.exec(stripped);
  if (digitMatch) {
    const c = Number.parseInt(digitMatch[1], 10);
    const v = digitMatch[2] ? Number.parseInt(digitMatch[2], 10) : undefined;
    const e = digitMatch[3] ? Number.parseInt(digitMatch[3], 10) : undefined;
    return {
      chapter: Number.isFinite(c) ? c : undefined,
      verse: v != null && Number.isFinite(v) ? v : undefined,
      endVerse: e != null && Number.isFinite(e) ? e : undefined,
    };
  }
  const written = parseWrittenNumberPt(stripped);
  if (written) return { chapter: written.value };
  return {};
}

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
    // Janela maior (60) para acomodar filler "de número" + extenso composto.
    const tail = normalized.slice(m.index + matchedLen, m.index + matchedLen + 60);
    const info = extractTrailingNumberInfo(tail);
    let chapter: number | undefined;
    let verse: number | undefined;
    let triggerKind: Candidate["triggerKind"];
    if (m.triggerOnly) {
      // Normaliza plural (capitulos → capitulo, versiculos → versiculo, versos → verso).
      const stem = m.matched.replace(/s$/, "");
      triggerKind = stem === "capitulo" ? "capitulo" : stem === "verso" ? "verso" : "versiculo";
      if (info.chapter != null) {
        if (triggerKind === "capitulo") chapter = info.chapter;
        else verse = info.chapter;
      }
    } else {
      chapter = info.chapter;
      verse = info.verse;
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
