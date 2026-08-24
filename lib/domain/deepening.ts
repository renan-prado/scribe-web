import {
  type SummaryBlock,
  SummaryBlockSchema,
  type SummaryPayload,
  SummaryPayloadSchema,
} from "./summary";

/**
 * A "deepening" (aprofundamento) is a denser, more theological pass over a
 * session. It reuses the exact SummaryPayload shape so BlockRenderer/SummaryView
 * render it with zero branching — the difference lives entirely in the prompt
 * (deeper exegesis, more cross-references, richer historical/doctrinal context).
 */
export type DeepeningPayload = SummaryPayload;
export const DeepeningPayloadSchema = SummaryPayloadSchema;
export type DeepeningBlock = SummaryBlock;
export const DeepeningBlockSchema = SummaryBlockSchema;

const emptyPayload = (): DeepeningPayload => ({
  thinking: "",
  title: "",
  shortSummary: "",
  blocks: [],
});

/**
 * Parse the raw LLM JSON string into a DeepeningPayload. Same rules as the
 * final summary, but without phase filtering — a deepening is always "final".
 */
export function parseDeepeningFromLLM(content: string): DeepeningPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyPayload();

  const src = obj as Record<string, unknown>;
  const title = typeof src.title === "string" ? src.title.trim() : "";
  const shortSummary = typeof src.shortSummary === "string" ? src.shortSummary.trim() : "";
  const rawBlocks = Array.isArray(src.blocks) ? src.blocks : [];
  const blocks: DeepeningBlock[] = [];

  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";

    switch (type) {
      case "h1":
      case "h2":
      case "paragraph":
      case "highlight":
      case "example": {
        if (text) blocks.push({ type, text });
        break;
      }
      case "bibleQuote": {
        const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
        if (reference) blocks.push({ type: "bibleQuote", reference, text });
        break;
      }
      case "quote": {
        if (!text) break;
        const author = typeof rec.author === "string" ? rec.author.trim() : "";
        blocks.push(author ? { type: "quote", text, author } : { type: "quote", text });
        break;
      }
      case "conclusion": {
        if (text) blocks.push({ type: "conclusion", text });
        break;
      }
      default:
        break;
    }
  }

  return { thinking: "", title, shortSummary, blocks };
}
