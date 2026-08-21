import "server-only";
import type { Profile } from "@/lib/domain/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile is the app-side mirror of an auth.users row. The row is
 * auto-created by a trigger on auth.users insert (see migration 0005), so
 * reads here always find a row for a signed-in user.
 */

type DbRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
};

function rowToProfile(row: DbRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    email: row.email,
    createdAt: row.created_at,
  };
}

const SELECT = "id, display_name, avatar_url, email, created_at";

/** Current auth user's profile row, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`getCurrentProfile failed: ${error.message}`);
  return data ? rowToProfile(data as DbRow) : null;
}
