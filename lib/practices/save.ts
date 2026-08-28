import "server-only";
import { upsertPractices } from "@/lib/db/practices";
import type { FeedItem } from "@/lib/domain/feed";
import type { PracticesPayload } from "@/lib/domain/practices";
import type { SummaryPayload } from "@/lib/domain/summary";
import { devLog } from "@/lib/log";
import { generatePractices } from "@/lib/practices/generate";

/**
 * Wrapper best-effort para gerar + persistir as 5 "Coloque em prática".
 * Usado tanto por /api/final-summary (primeira geração) quanto por
 * /api/final-summary/reprocess (regeração). Nunca lança — falha vira null
 * e é logada; o chamador continua respondendo ao cliente normalmente.
 *
 * Devolve o payload persistido pra o route incluir na resposta ao cliente
 * e a UI já renderizar sem um extra roundtrip. `null` significa que não há
 * practices disponíveis para esta sessão nesta chamada.
 */
export async function generateAndSavePractices(input: {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
}): Promise<PracticesPayload | null> {
  try {
    const result = await generatePractices(input);
    if (!result.ok) return null;
    try {
      await upsertPractices(input.sessionId, result.payload);
      devLog(`[${input.logPrefix}] saved`, { sessionId: input.sessionId });
    } catch (err) {
      console.error(`[${input.logPrefix}] save failed`, {
        sessionId: input.sessionId,
        error: (err as Error).message,
      });
    }
    return result.payload;
  } catch (err) {
    console.error(`[${input.logPrefix}] threw`, {
      sessionId: input.sessionId,
      error: (err as Error).message,
    });
    return null;
  }
}
