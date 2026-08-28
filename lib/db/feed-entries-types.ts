import type { PracticeItem } from "@/lib/domain/practices";
import type { ReminderItem } from "@/lib/domain/reminders";
import type { RereadItem } from "@/lib/domain/rereads";

/**
 * Types-only companion to `feed-entries.ts`. Lives in a client-safe module so
 * client components (PaginatedFeed) can import them without pulling the
 * "server-only" gate.
 */

export type FeedEntryKind = "practice" | "reread" | "reminder";

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
  item: PracticeItem | RereadItem | ReminderItem;
};

export type FeedOrder = "recent" | "oldest";
