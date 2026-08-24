import "server-only";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for recording sessions. One row per stop-press: transcript,
 * curated live feed (jsonb), and the final summary.
 *
 * Ownership (user_id) and RLS are deferred to the auth phase.
 *
 * feed_items stays a jsonb column here — it carries every kind including
 * AI-authored ones (relatedVerse, context, suggestedQuote). Speaker-sourced
 * kinds (citedVerse, speakerHighlight, speakerEcho, speakerCitation) are
 * additionally projected into public.session_feed_items by a Postgres
 * trigger (see migration 0004) so cross-session queries have first-class
 * rows to filter and index. Read those via @/lib/db/feed-items.
 *
 * speaker_id / location_id (nullable FKs) link to the reusable entities in
 * @/lib/db/{speakers,locations}. speaker_name / speaker_location stay as
 * the historical snapshot of what was captured at recording time, so
 * renaming a speaker later never rewrites past sessions.
 */

/**
 * Recording mode. `live` runs the full bible/insights/echo enrichment
 * pipelines during capture. `audio_only` only transcribes chunks in the
 * background and produces the final summary on stop — no live cards.
 */
export type SessionMode = "live" | "audio_only";

export const SESSION_MODES = ["live", "audio_only"] as const;

export function parseSessionMode(value: unknown): SessionMode {
  return value === "audio_only" ? "audio_only" : "live";
}

export type SessionRow = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
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
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
};

export type CreateEmptySessionInput = {
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
  mode?: SessionMode;
};

export type UpdateSessionFinalInput = {
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

type DbRow = {
  id: string;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_id: string | null;
  location_id: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  capture_mode: string | null;
  transcript: string;
  feed_items: FeedItem[] | null;
  final_summary: SummaryPayload | null;
};

// `mode` is a Postgres ordered-set aggregate function name — PostgREST tries
// to parse `select=mode` as a call to that aggregate ("WITHIN GROUP is
// required for ordered-set aggregate mode"). The column is physically named
// `capture_mode`; we keep the API-side field name as `mode` for callers.
const SELECT_LIST =
  "id, created_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode";
const SELECT_FULL = `id, created_at, ended_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode, transcript, feed_items, final_summary`;

function rowToSession(row: DbRow): SessionRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerId: row.speaker_id,
    locationId: row.location_id,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    mode: parseSessionMode(row.capture_mode),
    transcript: row.transcript,
    feedItems: Array.isArray(row.feed_items) ? row.feed_items : [],
    finalSummary: row.final_summary,
  };
}

/**
 * Create the row at the START of a recording so the URL /recording/{id}/live
 * is stable from the first second. Fills only what the user knows at that
 * point (speaker + location snapshot); transcript/feedItems/summary land
 * later via updateSessionFinal on stop.
 *
 * user_id is pulled from the authenticated Supabase session — RLS then
 * enforces that only the owner can read/update this row.
 */
export async function createEmptySession(input: CreateEmptySessionInput): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("createEmptySession: not authenticated");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      speaker_id: input.speakerId ?? null,
      location_id: input.locationId ?? null,
      speaker_name: input.speakerName,
      speaker_location: input.speakerLocation,
      capture_mode: input.mode ?? "live",
      transcript: "",
      feed_items: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createEmptySession failed: ${error?.message ?? "no id returned"}`);
  }
  return data.id;
}

/**
 * Fill an existing session on stop with the final transcript, curated feed,
 * summary payload, and duration. RLS scopes the update to the owner, so no
 * explicit ownership check is needed here.
 */
export async function updateSessionFinal(
  id: string,
  input: UpdateSessionFinalInput
): Promise<void> {
  const supabase = await createClient();
  const endedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ended_at: endedAt,
    duration_ms: input.durationMs,
    title: input.summary.title || null,
    short_summary: input.summary.shortSummary || null,
    speaker_name: input.speakerName,
    speaker_location: input.speakerLocation,
    transcript: input.transcript,
    feed_items: input.feedItems,
    final_summary: input.summary,
  };
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;

  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionFinal failed: ${error.message}`);
}

export type ListSessionsFilter = {
  speakerId?: string;
  locationId?: string;
};

export async function listSessions(filter: ListSessionsFilter = {}): Promise<SessionListItem[]> {
  const supabase = await createClient();
  let q = supabase.from("sessions").select(SELECT_LIST).order("created_at", { ascending: false });

  if (filter.speakerId) q = q.eq("speaker_id", filter.speakerId);
  if (filter.locationId) q = q.eq("location_id", filter.locationId);

  const { data, error } = await q;
  if (error) throw new Error(`listSessions failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    durationMs: r.duration_ms,
    title: r.title,
    shortSummary: r.short_summary,
    speakerId: r.speaker_id,
    locationId: r.location_id,
    speakerName: r.speaker_name,
    speakerLocation: r.speaker_location,
    mode: parseSessionMode(r.capture_mode),
  }));
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSession failed: ${error.message}`);
  return data ? rowToSession(data as DbRow) : null;
}

export type UpdateSessionMetaInput = {
  title: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
};

export async function updateSessionMeta(id: string, input: UpdateSessionMetaInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      title: input.title,
      speaker_name: input.speakerName,
      speaker_location: input.speakerLocation,
    })
    .eq("id", id);
  if (error) throw new Error(`updateSessionMeta failed: ${error.message}`);
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(`deleteSession failed: ${error.message}`);
}
