import { z } from "zod";
import type { VerseLine } from "@/lib/domain/verse";

/**
 * A busca por SENTIDO no painel da Bíblia: "versículos sobre perdão", "em que
 * passagem Daniel estava na cova dos leões". Client-safe: é o que a tela
 * desenha e o que a rota valida, mesma razão de `domain/biblo.ts`.
 *
 * ## O texto bíblico não vem do modelo, aqui também
 *
 * A mesma regra do `bibleQuote` do resumo (ver `docs/biblo-implementacao.md`):
 * o modelo escreve a REFERÊNCIA e uma nota curta, nunca o versículo. Por
 * isso o schema abaixo (`BibleAISearchReplySchema`) é o que o MODELO devolve
 * — sem texto nenhum —, e `BibleAISearchResponse` é o que a TELA recebe,
 * depois de cada referência ser resolvida contra a NVI local
 * (`server/biblo/bible-search.ts`). Uma referência que o modelo inventou, ou
 * que não existe, simplesmente não aparece — é o que torna um versículo
 * inventado impossível em vez de improvável, e não precisa de instrução
 * nenhuma no prompt pedindo cuidado.
 */

/** Uma pergunta não é um texto. Cabe numa frase, como as do exemplo na tela. */
export const BIBLE_SEARCH_MAX_QUESTION_CHARS = 200;

/** Teto de resultados. Uma pergunta de sentido tem poucas respostas boas; seis
 * já é mais do que cabe numa rolagem curta do painel. */
export const BIBLE_SEARCH_MAX_PASSAGES = 6;

const BibleSearchHitSchema = z.object({
  /** "Daniel 6:10-23", no MESMO formato que `parseVerseReference` entende —
   * é o parser único do produto, ver o cabeçalho de `lib/domain/reference.ts`. */
  reference: z.string().trim().min(1).max(60),
  /** Por que ESTA passagem responde à pergunta. Uma frase, não um sermão. */
  note: z.string().trim().max(240).default("").catch(""),
});

/**
 * O que o MODELO devolve. Nenhum campo é fatal — a régua é a mesma do
 * `BibloReplySchema`: a chamada já aconteceu e a moeda já foi debitada
 * quando este schema roda, então uma referência malformada não pode derrubar
 * a explicação, que pode estar certa mesmo com a lista vazia.
 */
export const BibleAISearchReplySchema = z.object({
  /** A explicação em prosa. Também a mensagem ORIENTATIVA para pergunta
   * genérica demais ou sem correspondência — ver o cabeçalho do servidor. */
  explanation: z.string().trim().max(400).default("").catch(""),
  passages: z.array(BibleSearchHitSchema).max(BIBLE_SEARCH_MAX_PASSAGES).default([]).catch([]),
});

export type BibleAISearchReply = z.infer<typeof BibleAISearchReplySchema>;

export function parseBibleAISearchFromLLM(content: string): BibleAISearchReply | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = BibleAISearchReplySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Uma passagem já ANCORADA contra a NVI — o `reference` e os `verses` são os
 * MESMOS de `PassagePayload` (`lib/domain/verse.ts`), com a nota do Biblo ao
 * lado. Duas formas para a mesma ideia (passagem resolvida) seriam a
 * divergência de sempre; esta é a mesma.
 */
export type BibleSearchPassage = {
  reference: string;
  book: string;
  chapter: number;
  verses: VerseLine[];
  note: string;
};

/** Resposta de `POST /api/bible-search`. */
export type BibleAISearchResponse = {
  explanation: string;
  passages: BibleSearchPassage[];
};

/** O que a rota devolve de verdade: a resposta mais o saldo depois do débito,
 * pela mesma razão de `BibloTurn.balance` — a store de moedas não precisa
 * reperguntar. */
export type BibleSearchApiResponse = BibleAISearchResponse & { balance: number | null };
