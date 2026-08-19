import type { Proposal } from "@/lib/domain/consolidate";
import type { Insight } from "@/lib/domain/insights";
import type { SummaryBlock, SummaryPayload } from "@/lib/domain/summary";

/**
 * Collect every block index a proposal set touches, so the UI can pulse those
 * blocks during the consolidate delay.
 */
export function collectAffectedIndices(proposals: Proposal[]): number[] {
  const set = new Set<number>();
  for (const p of proposals) {
    if (p.action === "merge") for (const i of p.targetIndices) set.add(i);
    else if (p.action === "refine") set.add(p.targetIndex);
    else if (p.action === "insertHeading") set.add(p.afterIndex + 1);
  }
  return Array.from(set);
}

/**
 * Add only insights whose target block isn't already annotated. The insights
 * endpoint enforces this too, but doing it here keeps the client honest against
 * race conditions between concurrent fetches.
 */
export function mergeInsights(prev: Insight[], incoming: Insight[]): Insight[] {
  const taken = new Set(prev.map((i) => i.targetBlockIndex));
  const additions = incoming.filter((i) => !taken.has(i.targetBlockIndex));
  if (additions.length === 0) return prev;
  return [...prev, ...additions];
}

/**
 * Apply consolidate proposals to a summary payload:
 *  - `refine`: swap a paragraph's text in place.
 *  - `merge`: replace a consecutive run of paragraphs with one merged paragraph.
 *  - `insertHeading`: splice an h2 between `afterIndex` and `afterIndex + 1`.
 * Structural changes are applied back-to-front so earlier indices stay valid.
 */
export function applyProposalsToPayload(
  payload: SummaryPayload,
  proposals: Proposal[]
): SummaryPayload {
  const refines = proposals.filter(
    (p): p is Extract<Proposal, { action: "refine" }> => p.action === "refine"
  );
  const structural = proposals.filter(
    (p): p is Extract<Proposal, { action: "merge" | "insertHeading" }> =>
      p.action === "merge" || p.action === "insertHeading"
  );
  let blocks: SummaryBlock[] = payload.blocks.map((b, i) => {
    const r = refines.find((x) => x.targetIndex === i);
    if (r && b.type === "paragraph") return { type: "paragraph", text: r.newText };
    return b;
  });
  const anchor = (p: Extract<Proposal, { action: "merge" | "insertHeading" }>): number =>
    p.action === "merge" ? Math.min(...p.targetIndices) : p.afterIndex + 1;
  const sortedStructural = [...structural].sort((a, b) => anchor(b) - anchor(a));
  for (const p of sortedStructural) {
    if (p.action === "merge") {
      const sorted = [...p.targetIndices].sort((a, b) => a - b);
      const start = sorted[0];
      const removeCount = sorted.length;
      blocks = [
        ...blocks.slice(0, start),
        { type: "paragraph", text: p.newText },
        ...blocks.slice(start + removeCount),
      ];
    } else {
      const insertAt = p.afterIndex + 1;
      blocks = [
        ...blocks.slice(0, insertAt),
        { type: "h2", text: p.text },
        ...blocks.slice(insertAt),
      ];
    }
  }
  return { ...payload, blocks };
}

/**
 * Shift/drop insight anchor indices to match the block indices after structural
 * proposals were applied. Insights anchored to a paragraph that got merged into
 * a neighbour are dropped; anything after an insertion or merge shifts.
 */
export function remapInsightsForProposals(insights: Insight[], proposals: Proposal[]): Insight[] {
  const structural = proposals.filter(
    (p): p is Extract<Proposal, { action: "merge" | "insertHeading" }> =>
      p.action === "merge" || p.action === "insertHeading"
  );
  if (structural.length === 0) return insights;
  const anchor = (p: Extract<Proposal, { action: "merge" | "insertHeading" }>): number =>
    p.action === "merge" ? Math.min(...p.targetIndices) : p.afterIndex + 1;
  const sortedStructural = [...structural].sort((a, b) => anchor(b) - anchor(a));
  const out: Insight[] = [];
  for (const ins of insights) {
    let idx = ins.targetBlockIndex;
    let drop = false;
    for (const p of sortedStructural) {
      if (p.action === "merge") {
        const sorted = [...p.targetIndices].sort((a, b) => a - b);
        const start = sorted[0];
        const end = sorted[sorted.length - 1];
        if (idx > start && idx <= end) {
          drop = true;
          break;
        }
        if (idx > end) idx -= sorted.length - 1;
      } else {
        const insertAt = p.afterIndex + 1;
        if (idx >= insertAt) idx += 1;
      }
    }
    if (!drop) out.push({ ...ins, targetBlockIndex: idx });
  }
  return out;
}
