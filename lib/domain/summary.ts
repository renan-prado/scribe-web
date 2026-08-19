import { z } from "zod";

export const SummaryBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h1"), text: z.string() }),
  z.object({ type: z.literal("h2"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bibleQuote"), reference: z.string(), text: z.string() }),
  z.object({ type: z.literal("highlight"), text: z.string() }),
  z.object({ type: z.literal("example"), text: z.string() }),
  z.object({ type: z.literal("quote"), text: z.string(), author: z.string().optional() }),
  z.object({ type: z.literal("conclusion"), text: z.string() }),
]);

export type SummaryBlock = z.infer<typeof SummaryBlockSchema>;

export const SummaryPayloadSchema = z.object({
  thinking: z.string().default(""),
  title: z.string().default(""),
  shortSummary: z.string().default(""),
  blocks: z.array(SummaryBlockSchema).default([]),
});

export type SummaryPayload = z.infer<typeof SummaryPayloadSchema>;

export type SummaryPhase = "intro" | "developing" | "mature" | "final";

const emptyPayload = (): SummaryPayload => ({
  thinking: "",
  title: "",
  shortSummary: "",
  blocks: [],
});

/**
 * Parse the raw LLM JSON string and apply phase-based filtering to blocks.
 * Blocks whose type is not permitted in the current phase are dropped; blocks
 * with empty text are dropped. Kept behavior-identical to the previous inline
 * normalizePayload in app/api/summarize/route.ts.
 */
export function parseSummaryFromLLM(content: string, phase: SummaryPhase): SummaryPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyPayload();

  const src = obj as Record<string, unknown>;
  const thinking = typeof src.thinking === "string" ? src.thinking.trim() : "";
  const title = typeof src.title === "string" ? src.title.trim() : "";
  const shortSummary = typeof src.shortSummary === "string" ? src.shortSummary.trim() : "";
  const rawBlocks = Array.isArray(src.blocks) ? src.blocks : [];
  const blocks: SummaryBlock[] = [];

  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";

    switch (type) {
      case "h1": {
        if (phase === "intro" || phase === "developing") break;
        if (text) blocks.push({ type: "h1", text });
        break;
      }
      case "h2":
      case "paragraph":
      case "highlight":
      case "example": {
        if (phase === "intro") break;
        if (text) blocks.push({ type, text });
        break;
      }
      case "bibleQuote": {
        const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
        if (reference) blocks.push({ type: "bibleQuote", reference, text });
        break;
      }
      case "quote": {
        if (phase === "intro") break;
        if (!text) break;
        const author = typeof rec.author === "string" ? rec.author.trim() : "";
        blocks.push(author ? { type: "quote", text, author } : { type: "quote", text });
        break;
      }
      case "conclusion": {
        if (phase !== "final") break;
        if (text) blocks.push({ type: "conclusion", text });
        break;
      }
      default:
        break;
    }
  }

  return { thinking, title, shortSummary, blocks };
}

/**
 * Prepares the previous summary so the LLM sees only the fields that matter
 * for continuation. The transient "thinking" field never round-trips.
 * Returns null when there is no meaningful content to send.
 */
export function normalizePreviousForPrompt(
  prev: SummaryPayload | undefined
): SummaryPayload | null {
  if (!prev || typeof prev !== "object") return null;
  const title = typeof prev.title === "string" ? prev.title : "";
  const shortSummary = typeof prev.shortSummary === "string" ? prev.shortSummary : "";
  const blocks = Array.isArray(prev.blocks) ? prev.blocks : [];
  const hasContent = title || shortSummary || blocks.length > 0;
  if (!hasContent) return null;
  return { thinking: "", title, shortSummary, blocks };
}
