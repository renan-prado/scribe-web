import { z } from "zod";

/**
 * Uma passagem, versículo a versículo.
 *
 * ⚠️ A forma é uma LISTA e não um texto corrido de propósito: a UI numera cada
 * versículo, e concatenar no servidor obrigaria o cliente a resegmentar — que
 * é impossível de fazer certo (o ponto final não delimita versículo).
 */
const VerseLineSchema = z.object({
  verse: z.number().int().positive(),
  text: z.string(),
});

export type VerseLine = z.infer<typeof VerseLineSchema>;

const PassagePayloadSchema = z.object({
  reference: z.string(),
  book: z.string(),
  chapter: z.number().int().positive(),
  /** Só os versículos que EXISTEM. Um pedido por 1:11-17 num capítulo de 15
   *  devolve 5 linhas, não 7 com duas vazias. */
  verses: z.array(VerseLineSchema),
});

export type PassagePayload = z.infer<typeof PassagePayloadSchema>;

/**
 * Resposta de `POST /api/verse`. Sempre uma lista, mesmo para uma passagem só
 * — assim o cliente tem um caminho único, e pedir cinco passagens de uma vez é
 * a mesma chamada de pedir uma.
 */
const VerseResponseSchema = z.object({
  passages: z.array(PassagePayloadSchema),
});

export type VerseResponse = z.infer<typeof VerseResponseSchema>;

export function parseVerseResponse(raw: unknown): VerseResponse | null {
  const parsed = VerseResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Os versículos como texto corrido, sem numeração.
 *
 * Existe para os dois lugares que mostram a passagem como uma citação só
 * (`VerseDialog` e o card do feed) — a numeração ali disputaria a atenção com
 * um texto de duas linhas. O caminho inverso não existe de propósito: juntar é
 * trivial, separar de volta é impossível de fazer certo, porque o ponto final
 * não delimita versículo.
 */
export function joinVerses(verses: VerseLine[]): string {
  return verses
    .map((v) => v.text)
    .join(" ")
    .trim();
}
