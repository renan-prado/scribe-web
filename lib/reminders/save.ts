import "server-only";
import { upsertReminders } from "@/lib/db/reminders";
import type { FeedItem } from "@/lib/domain/feed";
import type { RemindersPayload } from "@/lib/domain/reminders";
import type { SummaryPayload } from "@/lib/domain/summary";
import { devLog } from "@/lib/log";
import { generateReminders } from "@/lib/reminders/generate";

/**
 * Wrapper best-effort para gerar + persistir os 10 "Lembra disso?". Nunca
 * lança — falha vira null e é logada; o chamador continua respondendo ao
 * cliente normalmente. Devolve o payload para o route incluir na resposta.
 */
export async function generateAndSaveReminders(input: {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
}): Promise<RemindersPayload | null> {
  try {
    const result = await generateReminders(input);
    if (!result.ok) return null;
    try {
      await upsertReminders(input.sessionId, result.payload);
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
