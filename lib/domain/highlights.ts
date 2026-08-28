import { z } from "zod";

/**
 * Highlights — frases marcantes do sermão recicladas SEM IA para o feed
 * agendado. Fonte: os itens de fala já capturados durante o ao vivo
 * (`speakerCitation`, `speakerHighlight`, `speakerEcho`) e citações do
 * resumo final (`blocks[type=quote]`).
 *
 * Cadência: distribuição logarítmica entre HIGHLIGHT_MIN_DAY_OFFSET (3) e
 * HIGHLIGHT_MAX_DAY_OFFSET (365) dias, calculada em runtime a partir da
 * quantidade N de frases da sessão (variável). Assim uma sessão com poucas
 * frases ainda cobre o tail de 1 ano, e uma com muitas frases distribui
 * naturalmente pelo intervalo.
 *
 * `source` rastreia de onde a frase veio, para telemetria e para o card
 * poder exibir metadados corretos (autor só faz sentido em citation/quote).
 */

export const HIGHLIGHT_MIN_DAY_OFFSET = 3;
export const HIGHLIGHT_MAX_DAY_OFFSET = 365;
export const HIGHLIGHT_MAX_ITEMS = 12;

export const HighlightSourceSchema = z.enum([
  "speakerCitation",
  "speakerHighlight",
  "speakerEcho",
  "summaryQuote",
]);
export type HighlightSource = z.infer<typeof HighlightSourceSchema>;

export const HighlightItemSchema = z.object({
  dayOffset: z.number().int().min(0),
  text: z.string(),
  author: z.string().optional(),
  source: HighlightSourceSchema,
});
export type HighlightItem = z.infer<typeof HighlightItemSchema>;

export const HighlightsPayloadSchema = z.object({
  items: z.array(HighlightItemSchema),
});
export type HighlightsPayload = z.infer<typeof HighlightsPayloadSchema>;

/**
 * Distribui N frases entre [MIN, MAX] em progressão geométrica. Para N=1
 * devolve [MIN]. Para N>=2, `offset[i] = round(MIN * (MAX/MIN)^(i/(N-1)))`
 * — garante primeiro em MIN e último em MAX, com espaçamento exponencial.
 *
 * Se dois offsets consecutivos colapsam no mesmo dia (arredondamento), o
 * segundo é empurrado +1 para evitar colisão visual no mesmo dia.
 */
export function computeHighlightDayOffsets(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [HIGHLIGHT_MIN_DAY_OFFSET];
  const min = HIGHLIGHT_MIN_DAY_OFFSET;
  const max = HIGHLIGHT_MAX_DAY_OFFSET;
  const ratio = max / min;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const raw = min * ratio ** (i / (n - 1));
    let day = Math.round(raw);
    if (out.length > 0 && day <= out[out.length - 1]) {
      day = out[out.length - 1] + 1;
    }
    out.push(day);
  }
  return out;
}
