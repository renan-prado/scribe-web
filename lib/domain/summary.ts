import { z } from "zod";

/**
 * Os blocos do sermão organizado. TODOS carregam a voz do pregador, editada
 * para leitura, nunca a voz da IA.
 *
 * Houve uma segunda camada aqui, os "comentários do Scriba": `contextCard`
 * (nota histórica, exegética ou doutrinária) e `relatedVerse` ("leia também"),
 * emitidos por uma SEGUNDA chamada de LLM depois do resumo e desenhados num
 * balão que abria ao clique. Saíram inteiros, da geração e da tela. Resumos
 * ANTIGOS no banco continuam com esses blocos no `final_summary`; nada os
 * apaga, e `BlockRenderer` cai no `default: return null` para tipo que não
 * conhece, então eles simplesmente não desenham. Não reintroduza os tipos só
 * para renderizar o passado.
 */
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
