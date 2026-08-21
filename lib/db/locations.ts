import "server-only";
import type { Location } from "@/lib/domain/location";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for reusable location entities (churches, venues, wherever
 * a sermon happens). Sessions link via sessions.location_id and keep
 * speaker_location as the historical snapshot.
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

export async function listLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw new Error(`listLocations failed: ${error.message}`);
  return (data ?? []).map((r) => rowToLocation(r as DbRow));
}

export async function getLocation(id: string): Promise<Location | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getLocation failed: ${error.message}`);
  return data ? rowToLocation(data as DbRow) : null;
}

export async function findLocationByName(name: string): Promise<Location | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(SELECT)
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findLocationByName failed: ${error.message}`);
  return data ? rowToLocation(data as DbRow) : null;
}

export type UpsertLocationInput = {
  name: string;
  city?: string | null;
  notes?: string | null;
};

export async function upsertLocationByName(input: UpsertLocationInput): Promise<Location> {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("upsertLocationByName: empty name");
  const existing = await findLocationByName(trimmed);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
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
