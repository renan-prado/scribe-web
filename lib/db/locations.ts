import "server-only";
import { escapeLikeValue } from "@/lib/db/like";
import type { Location } from "@/lib/domain/location";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for reusable location entities (churches, venues, wherever
 * a sermon happens). Sessions link via sessions.location_id and keep
 * speaker_location as the historical snapshot.
 *
 * All reads/writes are user-scoped by RLS (user_id column). Case-insensitive
 * uniqueness on (user_id, lower(name)) enforced by index — see 0019.
 */

type DbRow = {
  id: string;
  name: string;
  city: string | null;
  notes: string | null;
  created_at: string;
};

function rowToLocation(row: DbRow): Location {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const SELECT = "id, name, city, notes, created_at";

export type LocationWithUsage = Location & { usageCount: number };

/**
 * List the current user's locations ordered by usage (most sessions first),
 * then name. Optional case-insensitive substring search.
 */
export async function listLocationsWithUsage(
  opts: { q?: string; limit?: number } = {}
): Promise<LocationWithUsage[]> {
  const supabase = await createClient();
  let q = supabase
    .from("locations_with_usage")
    .select("id, name, city, notes, created_at, usage_count")
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(opts.limit ?? 25);
  if (opts.q?.trim()) {
    q = q.ilike("name", `%${escapeLikeValue(opts.q.trim())}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listLocationsWithUsage failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    ...rowToLocation(r as DbRow),
    usageCount: (r as { usage_count?: number }).usage_count ?? 0,
  }));
}

async function findLocationByNameForUser(name: string, userId: string): Promise<Location | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(SELECT)
    .eq("user_id", userId)
    .ilike("name", escapeLikeValue(name.trim()))
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findLocationByName failed: ${error.message}`);
  return data ? rowToLocation(data as DbRow) : null;
}

export type UpsertLocationInput = {
  name: string;
  userId: string;
  city?: string | null;
  notes?: string | null;
};

export async function upsertLocationByName(input: UpsertLocationInput): Promise<Location> {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("upsertLocationByName: empty name");
  const existing = await findLocationByNameForUser(trimmed, input.userId);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      user_id: input.userId,
      name: trimmed,
      city: input.city ?? null,
      notes: input.notes ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    throw new Error(`upsertLocationByName insert failed: ${error?.message ?? "no row returned"}`);
  }
  return rowToLocation(data as DbRow);
}
