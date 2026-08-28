import { z } from "zod";

/**
 * "Lembra disso?" — 10 mini-callbacks para uma sessão, agendados no futuro
 * para o usuário revisitar sub-ideias específicas do sermão. Não é a tese
 * central (isso já vai no resumo) — são pontos LATERAIS marcantes: uma frase
 * de efeito, uma citação, um exemplo, um pequeno insight teológico.
 *
 * Cadência: 2, 5, 18, 33, 47, 62, 82, 120, 180, 260 dias. O tail longo até
 * 260 dias serve como gancho para o usuário voltar meses depois.
 *
 * Cada item tem uma "origin" que rastreia se o conteúdo é reciclagem ou
 * autoria da IA:
 * - `verbatim`: cita literalmente uma frase que o pastor falou (via
 *   speakerHighlight/speakerEcho/speakerCitation do feed).
 * - `paraphrase`: reformula uma ideia que apareceu no feed ou no resumo
 *   (highlight/contextCard/example blocks) com voz autoral.
 * - `generated`: sub-ideia extraída pela IA direto do transcript, quando as
 *   fontes acima não davam material para os 10 slots.
 */

export const REMINDER_DAY_OFFSETS = [2, 5, 18, 33, 47, 62, 82, 120, 180, 260] as const;
export type ReminderDayOffset = (typeof REMINDER_DAY_OFFSETS)[number];

const ReminderDayOffsetSchema = z.union([
  z.literal(2),
  z.literal(5),
  z.literal(18),
  z.literal(33),
  z.literal(47),
  z.literal(62),
  z.literal(82),
  z.literal(120),
  z.literal(180),
  z.literal(260),
]);

export const ReminderOriginSchema = z.enum(["verbatim", "paraphrase", "generated"]);
export type ReminderOrigin = z.infer<typeof ReminderOriginSchema>;

export const ReminderItemSchema = z.object({
  dayOffset: ReminderDayOffsetSchema,
  title: z.string(),
  text: z.string(),
  quote: z.string().optional(),
  origin: ReminderOriginSchema,
});

export type ReminderItem = z.infer<typeof ReminderItemSchema>;

export const RemindersPayloadSchema = z.object({
  items: z.array(ReminderItemSchema),
});

export type RemindersPayload = z.infer<typeof RemindersPayloadSchema>;

const emptyPayload = (): RemindersPayload => ({ items: [] });

/**
 * Parseia a saída do LLM. Contrato: 10 itens cobrindo cada offset canônico
 * uma única vez. Drops silenciosos:
 *   - offset desconhecido / repetido (fica o primeiro).
 *   - title ou text vazio.
 *   - origin inválido.
 * O caller decide se um payload parcial vale ser persistido (aqui devolvemos
 * o que sobreviveu; `isCompleteRemindersPayload` checa cobertura total).
 */
export function parseRemindersFromLLM(content: string): RemindersPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyPayload();
  const raw = (obj as { items?: unknown }).items;
  if (!Array.isArray(raw)) return emptyPayload();

  const byOffset = new Map<ReminderDayOffset, ReminderItem>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const parsed = ReminderItemSchema.safeParse({
      dayOffset: rec.dayOffset,
      title: typeof rec.title === "string" ? rec.title.trim() : "",
      text: typeof rec.text === "string" ? rec.text.trim() : "",
      quote:
        typeof rec.quote === "string" && rec.quote.trim().length > 0 ? rec.quote.trim() : undefined,
      origin: rec.origin,
    });
    if (!parsed.success) continue;
    if (!parsed.data.title || !parsed.data.text) continue;
    if (byOffset.has(parsed.data.dayOffset)) continue;
    byOffset.set(parsed.data.dayOffset, parsed.data);
  }

  const items = REMINDER_DAY_OFFSETS.flatMap((offset) => {
    const item = byOffset.get(offset);
    return item ? [item] : [];
  });
  return { items };
}

export function isCompleteRemindersPayload(payload: RemindersPayload): boolean {
  if (payload.items.length !== REMINDER_DAY_OFFSETS.length) return false;
  const seen = new Set(payload.items.map((i) => i.dayOffset));
  return REMINDER_DAY_OFFSETS.every((o) => seen.has(o));
}
