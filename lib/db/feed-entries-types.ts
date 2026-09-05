import type { HighlightItem } from "@/lib/domain/highlights";
import type { ReminderItem } from "@/lib/domain/reminders";
import type { RereadItem } from "@/lib/domain/rereads";

/**
 * Types-only companion to `feed-entries.ts`. Lives in a client-safe module so
 * client components (PaginatedFeed) can import them without pulling the
 * "server-only" gate.
 */

/**
 * "practice" existiu aqui e saiu junto com o "Coloque em prática". A tabela
 * `session_practices` continua no banco com os payloads antigos — o recurso foi
 * retirado da tela, não descartado — mas nada mais a lê.
 */
export type FeedEntryKind = "reread" | "reminder" | "highlight";

export type FeedEntrySessionRef = {
  id: string;
  title: string | null;
  createdAt: string;
  speakerName: string | null;
  speakerLocation: string | null;
};

export type FeedEntry = {
  kind: FeedEntryKind;
  key: string;
  dayOffset: number;
  scheduledAt: string;
  session: FeedEntrySessionRef;
  item: RereadItem | ReminderItem | HighlightItem;
};

export type FeedOrder = "recent" | "oldest";
