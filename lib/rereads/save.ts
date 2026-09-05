import "server-only";
import { upsertRereads } from "@/lib/db/rereads";
import type { FeedItem } from "@/lib/domain/feed";
import type { RereadsPayload } from "@/lib/domain/rereads";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";
import { type GenerateRereadsInput, generateRereads } from "@/lib/rereads/generate";

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
  metadataRoute: GenerateRereadsInput["metadataRoute"];
  logPrefix: string;
}): Promise<RereadsPayload | null> {
  const log = createLogger(input.logPrefix);
  try {
    const result = await generateRereads(input);
    if (!result.ok) return null;
    try {
      await upsertRereads(input.sessionId, result.payload);
      log.debug(`saved`, {
        sessionId: input.sessionId,
        fillCount: result.fillCount,
      });
    } catch (err) {
      log.error(`save failed`, {
        sessionId: input.sessionId,
        error: (err as Error).message,
      });
    }
    return result.payload;
  } catch (err) {
    log.error(`threw`, {
      sessionId: input.sessionId,
      error: (err as Error).message,
    });
    return null;
  }
}
