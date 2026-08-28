import "server-only";
import { upsertRereads } from "@/lib/db/rereads";
import type { FeedItem } from "@/lib/domain/feed";
import type { RereadsPayload } from "@/lib/domain/rereads";
import type { SummaryPayload } from "@/lib/domain/summary";
import { devLog } from "@/lib/log";
import { generateRereads } from "@/lib/rereads/generate";

/**
 * Wrapper best-effort para gerar + persistir as 10 "Releia este texto".
 * Usado por /api/final-summary (primeira geração) e por /api/final-summary/reprocess
 * (regeração). Nunca lança — falha vira null e é logada; o chamador continua
 * respondendo ao cliente normalmente.
 *
 * Devolve o payload persistido para o route incluir na resposta (evita um
 * roundtrip extra na UI). `null` significa que não há rereads disponíveis
 * para esta sessão nesta chamada.
 */
export async function generateAndSaveRereads(input: {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
}): Promise<RereadsPayload | null> {
  try {
    const result = await generateRereads(input);
    if (!result.ok) return null;
    try {
      await upsertRereads(input.sessionId, result.payload);
      devLog(`[${input.logPrefix}] saved`, {
        sessionId: input.sessionId,
        fillCount: result.fillCount,
      });
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
