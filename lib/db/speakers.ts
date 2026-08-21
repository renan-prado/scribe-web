import "server-only";
import type { Speaker } from "@/lib/domain/speaker";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for reusable speaker entities. Sessions link to a speaker
 * via sessions.speaker_id but ALSO keep speaker_name as a snapshot of
 * what was captured at recording time — renaming a speaker here does
 * not rewrite history in past sessions.
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

export async function listSpeakers(): Promise<Speaker[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw new Error(`listSpeakers failed: ${error.message}`);
  return (data ?? []).map((r) => rowToSpeaker(r as DbRow));
}

export async function getSpeaker(id: string): Promise<Speaker | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("speakers").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`getSpeaker failed: ${error.message}`);
  return data ? rowToSpeaker(data as DbRow) : null;
}

export async function findSpeakerByName(name: string): Promise<Speaker | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .select(SELECT)
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findSpeakerByName failed: ${error.message}`);
  return data ? rowToSpeaker(data as DbRow) : null;
}

export type UpsertSpeakerInput = {
  name: string;
  defaultLocationId?: string | null;
  bio?: string | null;
};

/**
 * Find by case-insensitive name or create. Used when a session save carries
 * a speaker name that should be promoted to an entity (or already matches
 * one).
 */
export async function upsertSpeakerByName(input: UpsertSpeakerInput): Promise<Speaker> {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("upsertSpeakerByName: empty name");
  const existing = await findSpeakerByName(trimmed);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .insert({
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
