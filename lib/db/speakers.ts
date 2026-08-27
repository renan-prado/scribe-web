import "server-only";
import type { Speaker } from "@/lib/domain/speaker";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for reusable speaker entities. Sessions link to a speaker
 * via sessions.speaker_id but ALSO keep speaker_name as a snapshot of
 * what was captured at recording time — renaming a speaker here does
 * not rewrite history in past sessions.
 *
 * All reads/writes are user-scoped by RLS (user_id column). Case-insensitive
 * uniqueness on (user_id, lower(name)) enforced by index — see 0019.
 */

type DbRow = {
  id: string;
  name: string;
  default_location_id: string | null;
  bio: string | null;
  created_at: string;
};

function rowToSpeaker(row: DbRow): Speaker {
  return {
    id: row.id,
    name: row.name,
    defaultLocationId: row.default_location_id,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

const SELECT = "id, name, default_location_id, bio, created_at";

export type SpeakerWithUsage = Speaker & { usageCount: number };

/**
 * List the current user's speakers ordered by usage (most sessions first),
 * then name. Optional case-insensitive substring search.
 */
export async function listSpeakersWithUsage(
  opts: { q?: string; limit?: number } = {}
): Promise<SpeakerWithUsage[]> {
  const supabase = await createClient();
  let q = supabase
    .from("speakers_with_usage")
    .select("id, name, default_location_id, bio, created_at, usage_count")
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(opts.limit ?? 25);
  if (opts.q?.trim()) {
    q = q.ilike("name", `%${opts.q.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listSpeakersWithUsage failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    ...rowToSpeaker(r as DbRow),
    usageCount: (r as { usage_count?: number }).usage_count ?? 0,
  }));
}

export async function getSpeaker(id: string): Promise<Speaker | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("speakers").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`getSpeaker failed: ${error.message}`);
  return data ? rowToSpeaker(data as DbRow) : null;
}

async function findSpeakerByNameForUser(name: string, userId: string): Promise<Speaker | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .select(SELECT)
    .eq("user_id", userId)
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findSpeakerByName failed: ${error.message}`);
  return data ? rowToSpeaker(data as DbRow) : null;
}

export type UpsertSpeakerInput = {
  name: string;
  userId: string;
  defaultLocationId?: string | null;
  bio?: string | null;
};

/**
 * Find (case-insensitive, scoped to userId) or create. Used when a session
 * save carries a speaker name that should be promoted to an entity.
 */
export async function upsertSpeakerByName(input: UpsertSpeakerInput): Promise<Speaker> {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("upsertSpeakerByName: empty name");
  const existing = await findSpeakerByNameForUser(trimmed, input.userId);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .insert({
      user_id: input.userId,
      name: trimmed,
      default_location_id: input.defaultLocationId ?? null,
      bio: input.bio ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    throw new Error(`upsertSpeakerByName insert failed: ${error?.message ?? "no row returned"}`);
  }
  return rowToSpeaker(data as DbRow);
}
