import { z } from "zod";

export const VersePayloadSchema = z.object({
  reference: z.string(),
  text: z.string(),
  translation: z.string(),
});

export type VersePayload = z.infer<typeof VersePayloadSchema>;

/**
 * Parse the raw LLM JSON string for a verse response. Falls back to the input
 * reference when the model returns nothing usable, and empties `text`/
 * `translation` rather than surfacing garbage.
 */
export function parseVerseFromLLM(content: string, fallbackReference: string): VersePayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return { reference: fallbackReference, text: "", translation: "" };
  }
  const rec = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  return {
    reference: typeof rec.reference === "string" ? rec.reference.trim() : fallbackReference,
    text: typeof rec.text === "string" ? rec.text.trim() : "",
    translation: typeof rec.translation === "string" ? rec.translation.trim() : "",
  };
}
