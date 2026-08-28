import type { FeedItem } from "@/lib/domain/feed";
import {
  computeHighlightDayOffsets,
  HIGHLIGHT_MAX_ITEMS,
  type HighlightItem,
  type HighlightSource,
  type HighlightsPayload,
} from "@/lib/domain/highlights";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * Reciclagem SEM IA das frases marcantes do sermão para o feed agendado.
 * Coleta candidatos de duas fontes:
 *   1. feedItems ao vivo: `speakerCitation`, `speakerHighlight`, `speakerEcho`.
 *   2. summary final: blocks com `type: "quote"`.
 *
 * Prioridade quando há mais candidatos que HIGHLIGHT_MAX_ITEMS:
 *   speakerCitation > summaryQuote > speakerHighlight > speakerEcho
 * (citações com autor têm o material mais "cardable"; echoes são o refrão,
 * frequentemente redundantes com highlights).
 *
 * Dedup por texto normalizado — a mesma frase às vezes vira highlight E
 * echo, e não queremos dois cards iguais espaçados no tempo.
 *
 * Textos curtíssimos (<20 chars) são descartados — não fazem sentido como
 * "card marcante" (ex: "Amém!").
 */

const MIN_TEXT_LENGTH = 20;

type Candidate = {
  text: string;
  author?: string;
  source: HighlightSource;
  /** Menor é melhor. Usado para tie-break quando há mais que o cap. */
  priority: number;
  /** Ordem de aparição na fonte, para preservar a sequência do sermão. */
  order: number;
};

const PRIORITY: Record<HighlightSource, number> = {
  speakerCitation: 0,
  summaryQuote: 1,
  speakerHighlight: 2,
  speakerEcho: 3,
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function extractHighlights(input: {
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
}): HighlightsPayload {
  const candidates: Candidate[] = [];
  let order = 0;

  for (const item of input.feedItems) {
    if (item.kind === "speakerCitation") {
      const text = item.text.trim();
      if (text.length < MIN_TEXT_LENGTH) continue;
      candidates.push({
        text,
        author: item.author.trim() || undefined,
        source: "speakerCitation",
        priority: PRIORITY.speakerCitation,
        order: order++,
      });
    } else if (item.kind === "speakerHighlight") {
      const text = item.text.trim();
      if (text.length < MIN_TEXT_LENGTH) continue;
      candidates.push({
        text,
        source: "speakerHighlight",
        priority: PRIORITY.speakerHighlight,
        order: order++,
      });
    } else if (item.kind === "speakerEcho") {
      const text = item.text.trim();
      if (text.length < MIN_TEXT_LENGTH) continue;
      candidates.push({
        text,
        source: "speakerEcho",
        priority: PRIORITY.speakerEcho,
        order: order++,
      });
    }
  }

  for (const block of input.finalSummary.blocks ?? []) {
    if (block.type !== "quote") continue;
    const text = block.text.trim();
    if (text.length < MIN_TEXT_LENGTH) continue;
    candidates.push({
      text,
      author: block.author?.trim() || undefined,
      source: "summaryQuote",
      priority: PRIORITY.summaryQuote,
      order: order++,
    });
  }

  // Dedup: se a mesma frase aparece em fontes diferentes, mantém a de maior
  // prioridade (menor `priority`); se empatam, a que apareceu primeiro.
  const byKey = new Map<string, Candidate>();
  for (const cand of candidates) {
    const key = normalize(cand.text);
    const prev = byKey.get(key);
    if (
      !prev ||
      cand.priority < prev.priority ||
      (cand.priority === prev.priority && cand.order < prev.order)
    ) {
      byKey.set(key, cand);
    }
  }

  // Se estamos acima do cap, mantém as HIGHLIGHT_MAX_ITEMS de maior prioridade.
  // Depois RE-ordena pela ordem de aparição no sermão, para que o feed conte a
  // história do primeiro ao último dia na mesma sequência da pregação.
  let picked = Array.from(byKey.values());
  if (picked.length > HIGHLIGHT_MAX_ITEMS) {
    picked.sort((a, b) => a.priority - b.priority || a.order - b.order);
    picked = picked.slice(0, HIGHLIGHT_MAX_ITEMS);
  }
  picked.sort((a, b) => a.order - b.order);

  const offsets = computeHighlightDayOffsets(picked.length);
  const items: HighlightItem[] = picked.map((cand, i) => ({
    dayOffset: offsets[i],
    text: cand.text,
    ...(cand.author ? { author: cand.author } : {}),
    source: cand.source,
  }));

  return { items };
}
