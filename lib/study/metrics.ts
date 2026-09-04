/**
 * As métricas de um estudo pronto, contra o contrato que o prompt do redator
 * declara.
 *
 * Client-safe de propósito: quem lê estes números é o painel, e ele é a única
 * forma de responder "o estudo piorou?" sem reler os dois textos inteiros.
 *
 * **Por que estas métricas e não o tamanho.** Uma contagem de palavras sozinha
 * mente nos dois sentidos. Ela infla quando o modelo empilha versículos — o
 * texto de `bibleQuote` vem da NVI, não do redator, e por isso NÃO entra em
 * `authoredWords`. E ela esconde o modo de falha real, que é o modelo subir de
 * 5 para 7 seções mantendo os mesmos 18 parágrafos: mais título, menos corpo,
 * mesmo total. É `paragraphsPerSection` que enxerga isso, e foi ele que
 * revelou que o contrato antigo era aritmeticamente impossível — 5×4×120 dá um
 * piso de 2.400 palavras, e a linha seguinte do prompt anunciava 1.800 a 3.000.
 *
 * ⚠️ **`STUDY_CONTRACT` ESPELHA `lib/prompts/study-write.ts`.** Os números não
 * são interpolados no prompt: aquele texto é lido e ajustado por gente, e
 * costurar variáveis nele o tornaria ilegível — que é a única qualidade que
 * um prompt não pode perder. Mesma convenção de `lib/coins/pricing.ts` com a
 * migração SQL: dois lugares, um commit. Ao mexer num, mexa no outro.
 */

import type { StudyBlock, StudyBlockType, StudyPayload } from "@/lib/domain/study";

export type ContractRange = { min: number; max: number };

export const STUDY_CONTRACT = {
  /** O número soberano do prompt. Só palavra ESCRITA pelo redator. */
  authoredWords: { min: 3000, max: 4000 },
  sections: { min: 6, max: 7 },
  paragraphsPerSection: { min: 4, max: 5 },
  wordsPerParagraph: { min: 140, max: 190 },
  /**
   * Passagens ancoradas usadas. Tem piso porque a lista que chega ao redator
   * já foi conferida contra a NVI no passo 3: usá-la é de graça, e é o único
   * caminho de Escritura para dentro do texto. Um redator que ignora a lista
   * desperdiça a etapa que garante a procedência — medido, foi o que aconteceu
   * ao baixar o modelo do redator (16 → 6).
   */
  bibleQuotes: { min: 10, max: 16 },
} as const satisfies Record<string, ContractRange>;

export type ContractKey = keyof typeof STUDY_CONTRACT;

/** Onde um valor caiu em relação à faixa. `null` quando não há o que medir. */
export type ContractVerdict = "below" | "ok" | "above" | null;

export function judge(value: number | null, range: ContractRange): ContractVerdict {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < range.min) return "below";
  if (value > range.max) return "above";
  return "ok";
}

export type StudyMetrics = {
  totalBlocks: number;
  blocksByType: Partial<Record<StudyBlockType, number>>;
  /** Palavras escritas pelo redator. Exclui o texto de `bibleQuote` (NVI). */
  authoredWords: number;
  /** Palavras de Escritura, mostradas à parte para o total não enganar. */
  scriptureWords: number;
  sections: number;
  paragraphs: number;
  /** `null` quando não há seção — divisão por zero não é zero. */
  paragraphsPerSection: number | null;
  wordsPerParagraph: number | null;
  bibleQuotes: number;
  /**
   * Blocos que não são corpo corrido: distinção, objeção, exemplo, destaque,
   * leitura, citação, pergunta. É o proxy de RIQUEZA — um artigo só de
   * "paragraph" desperdiçou o material que veio das notas.
   */
  structuredBlocks: number;
};

const BODY_TYPES = new Set<StudyBlockType>(["h1", "h2", "paragraph", "conclusion"]);

function words(text: string | undefined): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Todo texto autoral de um bloco — alguns têm mais de um campo de prosa. */
function authoredWordsOf(block: StudyBlock): number {
  switch (block.type) {
    case "bibleQuote":
      return 0; // vem da NVI
    case "objection":
      return words(block.text) + words(block.response);
    case "distinction":
      return words(block.a) + words(block.b) + words(block.text);
    case "reading":
      return words(block.note);
    case "quote":
      return words(block.text);
    default:
      return words(block.text);
  }
}

export function computeStudyMetrics(payload: Pick<StudyPayload, "blocks">): StudyMetrics {
  const blocks = payload.blocks ?? [];
  const blocksByType: Partial<Record<StudyBlockType, number>> = {};
  for (const b of blocks) blocksByType[b.type] = (blocksByType[b.type] ?? 0) + 1;

  const paragraphs = blocks.filter((b) => b.type === "paragraph");
  const sections = blocksByType.h1 ?? 0;
  const paragraphWords = paragraphs.reduce((n, b) => n + words(b.text), 0);

  return {
    totalBlocks: blocks.length,
    blocksByType,
    authoredWords: blocks.reduce((n, b) => n + authoredWordsOf(b), 0),
    scriptureWords: blocks.reduce((n, b) => n + (b.type === "bibleQuote" ? words(b.text) : 0), 0),
    sections,
    paragraphs: paragraphs.length,
    paragraphsPerSection: sections > 0 ? paragraphs.length / sections : null,
    wordsPerParagraph: paragraphs.length > 0 ? paragraphWords / paragraphs.length : null,
    bibleQuotes: blocksByType.bibleQuote ?? 0,
    structuredBlocks: blocks.filter((b) => !BODY_TYPES.has(b.type)).length,
  };
}
