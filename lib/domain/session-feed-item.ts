import type { FeedItem, FeedItemKind } from "@/lib/domain/feed";

/**
 * A row from public.session_feed_items — the normalized projection of
 * speaker-sourced feed items (citedVerse, speakerHighlight, speakerEcho,
 * speakerCitation) that Postgres maintains via trigger from
 * sessions.feed_items. Cross-session queries (all verses cited by a
 * speaker, all citations of an author, etc.) read this table.
 *
 * AI-authored items (relatedVerse, context, suggestedQuote) never land
 * here — they stay in the sessions.feed_items jsonb only.
 */

export type RecordingKind = Extract<
  FeedItemKind,
  "citedVerse" | "speakerHighlight" | "speakerEcho" | "speakerCitation"
>;

export type SessionFeedItemRow = {
  id: string;
  sessionId: string;
  position: number;
  kind: RecordingKind;
  payload: FeedItem;
  verseBook: string | null;
  verseChapter: number | null;
  verseStart: number | null;
  verseEnd: number | null;
  citationAuthor: string | null;
  textNormalized: string | null;
  createdAt: string;
};
