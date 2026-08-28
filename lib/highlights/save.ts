import "server-only";
import { upsertHighlights } from "@/lib/db/highlights";
import type { FeedItem } from "@/lib/domain/feed";
import type { HighlightsPayload } from "@/lib/domain/highlights";
import type { SummaryPayload } from "@/lib/domain/summary";
import { extractHighlights } from "@/lib/highlights/extract";
import { devLog } from "@/lib/log";

/**
 * Best-effort: extrai frases marcantes do feed do ao vivo + summary final e
 * persiste como série agendada no /feed. Sem chamada de LLM — puro
 * reciclagem, então o único caminho de falha é a escrita no banco. Retorna
 * o payload para o route incluir na resposta (nunca lança).
 */
export async function generateAndSaveHighlights(input: {
  sessionId: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
}): Promise<HighlightsPayload | null> {
  try {
    const payload = extractHighlights({
      feedItems: input.feedItems,
      finalSummary: input.finalSummary,
    });
    if (payload.items.length === 0) {
      devLog(`[${input.logPrefix}] no candidates`, { sessionId: input.sessionId });
      return payload;
    }
    try {
      await upsertHighlights(input.sessionId, payload);
      devLog(`[${input.logPrefix}] saved`, {
        sessionId: input.sessionId,
        count: payload.items.length,
      });
    } catch (err) {
      console.error(`[${input.logPrefix}] save failed`, {
        sessionId: input.sessionId,
        error: (err as Error).message,
      });
    }
    return payload;
  } catch (err) {
    console.error(`[${input.logPrefix}] threw`, {
      sessionId: input.sessionId,
      error: (err as Error).message,
    });
    return null;
  }
}
