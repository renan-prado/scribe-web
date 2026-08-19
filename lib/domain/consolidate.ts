import { z } from "zod";
import type { SummaryBlock } from "./summary";

export const MergeProposalSchema = z.object({
  action: z.literal("merge"),
  targetIndices: z.array(z.number().int()),
  newText: z.string(),
});
export type MergeProposal = z.infer<typeof MergeProposalSchema>;

export const RefineProposalSchema = z.object({
  action: z.literal("refine"),
  targetIndex: z.number().int(),
  newText: z.string(),
});
export type RefineProposal = z.infer<typeof RefineProposalSchema>;

export const InsertHeadingProposalSchema = z.object({
  action: z.literal("insertHeading"),
  afterIndex: z.number().int(),
  level: z.literal("h2"),
  text: z.string(),
});
export type InsertHeadingProposal = z.infer<typeof InsertHeadingProposalSchema>;

export const ProposalSchema = z.discriminatedUnion("action", [
  MergeProposalSchema,
  RefineProposalSchema,
  InsertHeadingProposalSchema,
]);
export type Proposal = z.infer<typeof ProposalSchema>;

export type ConsolidatePayload = { proposals: Proposal[] };

const MERGE_MIN_WORD_RATIO = 0.85;
const REFINE_MAX_WORD_DRIFT = 0.2;
const MAX_PROPOSALS = 2;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Parse the raw LLM JSON string and guard proposals against structural rules
 * that must hold regardless of what the model produced (paragraph-only merges,
 * consecutive indices, drift bounds, no duplicated indices, single heading,
 * capped total). Behavior-identical to the previous inline normalizeAndGuard.
 */
export function parseProposalsFromLLM(content: string, blocks: SummaryBlock[]): Proposal[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const rawList = (obj as { proposals?: unknown }).proposals;
  if (!Array.isArray(rawList)) return [];

  const seenIndices = new Set<number>();
  let headingCount = 0;
  const out: Proposal[] = [];

  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const action = typeof rec.action === "string" ? rec.action : "";

    if (action === "merge") {
      const newText = typeof rec.newText === "string" ? rec.newText.trim() : "";
      if (!newText) continue;
      const rawIndices = Array.isArray(rec.targetIndices) ? rec.targetIndices : [];
      const indices = rawIndices
        .filter((n): n is number => typeof n === "number" && Number.isInteger(n))
        .filter((n) => n >= 0 && n < blocks.length);
      if (indices.length < 2 || indices.length > 3) continue;
      const sorted = [...indices].sort((a, b) => a - b);
      const consecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
      if (!consecutive) continue;
      if (sorted.some((i) => seenIndices.has(i))) continue;
      const targetBlocks = sorted.map((i) => blocks[i]);
      if (!targetBlocks.every((b) => b.type === "paragraph")) continue;
      const originalWords = targetBlocks
        .map((b) => wordCount((b as { text: string }).text))
        .reduce((a, b) => a + b, 0);
      const newWords = wordCount(newText);
      if (newWords < originalWords * MERGE_MIN_WORD_RATIO) continue;
      out.push({ action: "merge", targetIndices: sorted, newText });
      for (const i of sorted) seenIndices.add(i);
      continue;
    }

    if (action === "refine") {
      const newText = typeof rec.newText === "string" ? rec.newText.trim() : "";
      if (!newText) continue;
      const idx = typeof rec.targetIndex === "number" ? rec.targetIndex : -1;
      if (idx < 0 || idx >= blocks.length) continue;
      if (seenIndices.has(idx)) continue;
      const target = blocks[idx];
      if (target.type !== "paragraph") continue;
      const originalWords = wordCount(target.text);
      const newWords = wordCount(newText);
      const drift = Math.abs(newWords - originalWords) / Math.max(1, originalWords);
      if (drift > REFINE_MAX_WORD_DRIFT) continue;
      out.push({ action: "refine", targetIndex: idx, newText });
      seenIndices.add(idx);
      continue;
    }

    if (action === "insertHeading") {
      if (headingCount >= 1) continue;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      if (!text || text.length > 60) continue;
      const level = typeof rec.level === "string" ? rec.level : "";
      if (level !== "h2") continue;
      const afterIndex = typeof rec.afterIndex === "number" ? rec.afterIndex : -1;
      if (afterIndex < 0 || afterIndex >= blocks.length - 1) continue;
      const nextBlock = blocks[afterIndex + 1];
      if (nextBlock.type === "h1" || nextBlock.type === "h2") continue;
      const remaining = blocks.length - (afterIndex + 1);
      if (remaining < 2) continue;
      if (seenIndices.has(afterIndex) || seenIndices.has(afterIndex + 1)) continue;
      out.push({ action: "insertHeading", afterIndex, level: "h2", text });
      seenIndices.add(afterIndex + 1);
      headingCount += 1;
    }
  }

  return out.slice(0, MAX_PROPOSALS);
}
