import "server-only";
import type { FeedItem } from "@/lib/domain/feed";
import type { RecordingKind, SessionFeedItemRow } from "@/lib/domain/session-feed-item";
import { createClient } from "@/lib/supabase/server";

/**
 * Cross-session queries against session_feed_items — the normalized
 * projection of speaker-sourced feed items. Postgres populates this table
 * via trigger from sessions.feed_items, so writes go through the existing
 * session save path unchanged.
 *
 * Use these helpers for the "all verses cited by pastor X", "all sermons
 * that touched this passage", "every citation of Spurgeon", etc. queries.
 */

type DbRow = {
  id: string;
  session_id: string;
  position: number;
  kind: string;
  payload: FeedItem;
  verse_book: string | null;
  verse_chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  citation_author: string | null;
  text_normalized: string | null;
  created_at: string;
};

function rowToFeedItem(row: DbRow): SessionFeedItemRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    position: row.position,
    kind: row.kind as RecordingKind,
    payload: row.payload,
    verseBook: row.verse_book,
    verseChapter: row.verse_chapter,
    verseStart: row.verse_start,
    verseEnd: row.verse_end,
    citationAuthor: row.citation_author,
    textNormalized: row.text_normalized,
    createdAt: row.created_at,
  };
}

const SELECT =
  "id, session_id, position, kind, payload, verse_book, verse_chapter, verse_start, verse_end, citation_author, text_normalized, created_at";

/** All recording-origin feed items for one session, in feed order. */
export async function listFeedItemsForSession(sessionId: string): Promise<SessionFeedItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_feed_items")
    .select(SELECT)
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw new Error(`listFeedItemsForSession failed: ${error.message}`);
  return (data ?? []).map((r) => rowToFeedItem(r as DbRow));
}

export type VerseFilter = {
  /** Normalized book name — lowercase, no punctuation. Match parseVerseReference. */
  book?: string;
  chapter?: number;
  verse?: number;
};

/**
 * All citedVerse rows across all sessions matching an optional filter.
 * A verse-level filter matches when the verse is inside [verse_start, verse_end].
 */
export async function listCitedVerses(filter: VerseFilter = {}): Promise<SessionFeedItemRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("session_feed_items")
    .select(SELECT)
    .eq("kind", "citedVerse")
    .order("created_at", { ascending: false });

  if (filter.book) q = q.eq("verse_book", filter.book.toLowerCase());
  if (typeof filter.chapter === "number") q = q.eq("verse_chapter", filter.chapter);
  if (typeof filter.verse === "number") {
    q = q.lte("verse_start", filter.verse).gte("verse_end", filter.verse);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listCitedVerses failed: ${error.message}`);
  return (data ?? []).map((r) => rowToFeedItem(r as DbRow));
}

/** All speakerCitation rows, optionally filtered by author (case-insensitive). */
export async function listSpeakerCitations(author?: string): Promise<SessionFeedItemRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("session_feed_items")
    .select(SELECT)
    .eq("kind", "speakerCitation")
    .order("created_at", { ascending: false });

  if (author?.trim()) q = q.ilike("citation_author", author.trim());

  const { data, error } = await q;
  if (error) throw new Error(`listSpeakerCitations failed: ${error.message}`);
  return (data ?? []).map((r) => rowToFeedItem(r as DbRow));
}

/**
 * All feed items across sessions matching a substring (case-insensitive)
 * in text_normalized. Cheap enough at current scale; upgrade to a real
 * tsvector index if this becomes hot.
 */
export async function searchFeedItemsByText(query: string): Promise<SessionFeedItemRow[]> {
  const supabase = await createClient();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const { data, error } = await supabase
    .from("session_feed_items")
    .select(SELECT)
    .ilike("text_normalized", `%${trimmed}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`searchFeedItemsByText failed: ${error.message}`);
  return (data ?? []).map((r) => rowToFeedItem(r as DbRow));
}
