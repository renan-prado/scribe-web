import { z } from "zod";

/**
 * "Releia este texto" — 10 versículos separados junto com o final_summary
 * para serem relidos ao longo do tempo. Sempre que possível reaproveitamos
 * o que já apareceu (citedVerse do feed, relatedVerse do feed, bibleQuote/
 * relatedVerse do summary); a IA só é chamada para completar até 10 quando
 * o pool disponível não cobre todos os slots.
 *
 * Todos os itens são agendados no futuro:
 *   1, 2, 4, 7, 16, 22, 30, 45, 60, 90 dias.
 * A colisão com "praticar" (0, 1, 3, 7, 15) é intencional só nos dias 1 e 7;
 * os demais offsets ficam intercalados para dar variedade ao feed home.
 */

export const REREAD_DAY_OFFSETS = [1, 2, 4, 7, 16, 22, 30, 45, 60, 90] as const;
export type RereadDayOffset = (typeof REREAD_DAY_OFFSETS)[number];

const RereadDayOffsetSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(4),
  z.literal(7),
  z.literal(16),
  z.literal(22),
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
]);

/**
 * Origem do item.
 * - `cited`: o pastor leu na gravação (feed citedVerse) — âncora mais forte.
 * - `related`: sugerido pela IA no live (feed relatedVerse) ou pelo
 *    enrichment do resumo (summary block relatedVerse).
 * - `summary`: apareceu como citação no bloco bibleQuote do resumo.
 * - `ai-fill`: gerado pelo LLM só para completar os 10 quando o pool
 *    reaproveitável não cobria todos os slots.
 */
export const RereadOriginSchema = z.enum(["cited", "related", "summary", "ai-fill"]);
export type RereadOrigin = z.infer<typeof RereadOriginSchema>;

export const RereadItemSchema = z.object({
  dayOffset: RereadDayOffsetSchema,
  reference: z.string(),
  text: z.string().default(""),
  reason: z.string().default(""),
  origin: RereadOriginSchema,
});

export type RereadItem = z.infer<typeof RereadItemSchema>;

export const RereadsPayloadSchema = z.object({
  items: z.array(RereadItemSchema),
});

export type RereadsPayload = z.infer<typeof RereadsPayloadSchema>;

/**
 * Só o que o LLM devolve na chamada de "fill": uma lista de referências com
 * um motivo curto, SEM dayOffset (quem atribui é o assembler em ordem).
 */
export const RereadFillItemSchema = z.object({
  reference: z.string(),
  reason: z.string().default(""),
});

export type RereadFillItem = z.infer<typeof RereadFillItemSchema>;

export function parseRereadsFillFromLLM(content: string): RereadFillItem[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];

  const out: RereadFillItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const parsed = RereadFillItemSchema.safeParse({
      reference: typeof rec.reference === "string" ? rec.reference.trim() : "",
      reason: typeof rec.reason === "string" ? rec.reason.trim() : "",
    });
    if (!parsed.success) continue;
    if (!parsed.data.reference) continue;
    out.push(parsed.data);
  }
  return out;
}

/** True quando o payload cobre exatamente os 10 offsets canônicos. */
export function isCompleteRereadsPayload(payload: RereadsPayload): boolean {
  if (payload.items.length !== REREAD_DAY_OFFSETS.length) return false;
  const seen = new Set(payload.items.map((i) => i.dayOffset));
  return REREAD_DAY_OFFSETS.every((o) => seen.has(o));
}
