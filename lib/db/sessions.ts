import "server-only";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for recording sessions. One row per stop-press: transcript,
 * curated live feed, and the final summary. RLS is off (see the migration) —
 * this app runs single-user in local testing with the anon key.
 */

export type SessionRow = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload | null;
};

export type SessionListItem = {
  id: string;
  createdAt: string;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
};

export type SaveSessionInput = {
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
};

type DbRow = {
  id: string;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  transcript: string;
  feed_items: FeedItem[] | null;
  final_summary: SummaryPayload | null;
};

function rowToSession(row: DbRow): SessionRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    transcript: row.transcript,
    feedItems: Array.isArray(row.feed_items) ? row.feed_items : [],
    finalSummary: row.final_summary,
  };
}

export async function saveSession(input: SaveSessionInput): Promise<string> {
  const supabase = await createClient();
  const endedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      ended_at: endedAt,
      duration_ms: input.durationMs,
      title: input.summary.title || null,
      short_summary: input.summary.shortSummary || null,
      speaker_name: input.speakerName,
      speaker_location: input.speakerLocation,
      transcript: input.transcript,
      feed_items: input.feedItems,
      final_summary: input.summary,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`saveSession failed: ${error?.message ?? "no id returned"}`);
  }
  return data.id;
}

export async function listSessions(): Promise<SessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, created_at, duration_ms, title, short_summary, speaker_name, speaker_location")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listSessions failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    durationMs: r.duration_ms,
    title: r.title,
    shortSummary: r.short_summary,
    speakerName: r.speaker_name,
    speakerLocation: r.speaker_location,
  }));
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, created_at, ended_at, duration_ms, title, short_summary, speaker_name, speaker_location, transcript, feed_items, final_summary"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSession failed: ${error.message}`);
  return data ? rowToSession(data as DbRow) : null;
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(`deleteSession failed: ${error.message}`);
}
