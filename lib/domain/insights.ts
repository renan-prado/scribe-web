import { z } from "zod";
import type { SummaryBlock } from "./summary";

export const InsightBibleReferenceSchema = z.object({
  type: z.literal("bibleReference"),
  targetBlockIndex: z.number().int(),
  references: z.array(z.string()),
});
export type InsightBibleReference = z.infer<typeof InsightBibleReferenceSchema>;

export const InsightSupportingContentSchema = z.object({
  type: z.literal("supportingContent"),
  targetBlockIndex: z.number().int(),
  label: z.string(),
  text: z.string(),
  source: z.string().optional(),
});
export type InsightSupportingContent = z.infer<typeof InsightSupportingContentSchema>;

export const InsightSchema = z.discriminatedUnion("type", [
  InsightBibleReferenceSchema,
  InsightSupportingContentSchema,
]);
export type Insight = z.infer<typeof InsightSchema>;

export type InsightsPayload = { insights: Insight[] };

const MAX_REFERENCES_PER_INSIGHT = 3;

function normalizeRef(ref: string): string {
  return ref.toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

function collectCitedReferences(blocks: SummaryBlock[]): Set<string> {
  const set = new Set<string>();
  for (const b of blocks) {
    if (b.type === "bibleQuote" && b.reference) set.add(normalizeRef(b.reference));
  }
  return set;
}

/**
 * Parse the raw LLM JSON string and guard insights against structural rules:
 * valid target index, no anchoring on conclusion blocks, no re-anchoring on
 * blocks that already carry an insight, no duplicate bible references that
 * were already cited. Behavior-identical to the previous inline normalizeInsights.
 */
export function parseInsightsFromLLM(
  content: string,
  blocks: SummaryBlock[],
  existingIndices: number[]
): Insight[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const rawList = (obj as { insights?: unknown }).insights;
  if (!Array.isArray(rawList)) return [];

  const takenBlocks = new Set<number>(existingIndices);
  const out: Insight[] = [];

  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const idx = typeof rec.targetBlockIndex === "number" ? rec.targetBlockIndex : -1;
    if (idx < 0 || idx >= blocks.length) continue;
    if (blocks[idx].type === "conclusion") continue;
    if (takenBlocks.has(idx)) continue;

    if (type === "bibleReference") {
      const rawRefs = Array.isArray(rec.references) ? rec.references : [];
      const references = rawRefs
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, MAX_REFERENCES_PER_INSIGHT);
      if (references.length === 0) continue;
      const alreadyCited = collectCitedReferences(blocks);
      const fresh = references.filter((r) => !alreadyCited.has(normalizeRef(r)));
      if (fresh.length === 0) continue;
      out.push({ type: "bibleReference", targetBlockIndex: idx, references: fresh });
      takenBlocks.add(idx);
      continue;
    }

    if (type === "supportingContent") {
      const label = typeof rec.label === "string" ? rec.label.trim() : "";
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      if (!label || !text) continue;
      const source = typeof rec.source === "string" ? rec.source.trim() : "";
      out.push({
        type: "supportingContent",
        targetBlockIndex: idx,
        label,
        text,
        ...(source ? { source } : {}),
      });
      takenBlocks.add(idx);
    }
  }

  return out;
}
