import { z } from "zod";

/**
 * "Coloque em prática" — 5 sugestões acionáveis geradas junto com o
 * final_summary. Cada item traz um `dayOffset` que determina quando a UI
 * revela o card no feed pós-sessão. O item de dayOffset=0 aparece ao final
 * do próprio resumo; os demais são liberados nos dias 1, 3, 7 e 15.
 *
 * Na fase atual de validação, a UI mostra todos os 5 simultaneamente.
 */

export const PRACTICE_DAY_OFFSETS = [0, 1, 3, 7, 15] as const;
export type PracticeDayOffset = (typeof PRACTICE_DAY_OFFSETS)[number];

const PracticeDayOffsetSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(3),
  z.literal(7),
  z.literal(15),
]);

export const PracticeItemSchema = z.object({
  dayOffset: PracticeDayOffsetSchema,
  title: z.string(),
  text: z.string(),
  prompt: z.string().optional(),
});

export type PracticeItem = z.infer<typeof PracticeItemSchema>;

export const PracticesPayloadSchema = z.object({
  items: z.array(PracticeItemSchema),
});

export type PracticesPayload = z.infer<typeof PracticesPayloadSchema>;

const emptyPayload = (): PracticesPayload => ({ items: [] });

/**
 * Parse the raw LLM JSON string into a PracticesPayload. Enforces the
 * "5 items, one per offset" contract:
 *   - Drops items with unknown offsets or empty title/text.
 *   - Keeps at most one item per dayOffset (first one wins).
 *   - Returns items sorted by the canonical PRACTICE_DAY_OFFSETS order.
 *   - If fewer than 5 offsets are covered, returns whatever survived —
 *     the caller decides whether an incomplete payload is worth persisting.
 */
export function parsePracticesFromLLM(content: string): PracticesPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyPayload();
  const raw = (obj as { items?: unknown }).items;
  if (!Array.isArray(raw)) return emptyPayload();

  const byOffset = new Map<PracticeDayOffset, PracticeItem>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const parsed = PracticeItemSchema.safeParse({
      dayOffset: rec.dayOffset,
      title: typeof rec.title === "string" ? rec.title.trim() : "",
      text: typeof rec.text === "string" ? rec.text.trim() : "",
      prompt:
        typeof rec.prompt === "string" && rec.prompt.trim().length > 0
          ? rec.prompt.trim()
          : undefined,
    });
    if (!parsed.success) continue;
    if (!parsed.data.title || !parsed.data.text) continue;
    if (byOffset.has(parsed.data.dayOffset)) continue;
    byOffset.set(parsed.data.dayOffset, parsed.data);
  }

  const items = PRACTICE_DAY_OFFSETS.flatMap((offset) => {
    const item = byOffset.get(offset);
    return item ? [item] : [];
  });
  return { items };
}

/**
 * True when the payload covers all 5 canonical offsets. Used by the
 * generator to decide whether to persist — a partial set is worse than
 * nothing on this feature (rare event, cheap to retry).
 */
export function isCompletePracticesPayload(payload: PracticesPayload): boolean {
  if (payload.items.length !== PRACTICE_DAY_OFFSETS.length) return false;
  const seen = new Set(payload.items.map((i) => i.dayOffset));
  return PRACTICE_DAY_OFFSETS.every((o) => seen.has(o));
}
