import "server-only";
import type { DeepeningPayload } from "@/lib/domain/deepening";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for session deepenings — the on-demand "aprofundamento" a user
 * can generate once per session. See migration 0009: unique(session_id) is the
 * hard rule; UI/API only surface it.
 */

export type DeepeningRow = {
  sessionId: string;
  payload: DeepeningPayload;
  createdAt: string;
};

type DbRow = {
  session_id: string;
  payload: DeepeningPayload;
  created_at: string;
};

export async function getDeepening(sessionId: string): Promise<DeepeningRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_deepenings")
    .select("session_id, payload, created_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`getDeepening failed: ${error.message}`);
  if (!data) return null;
  const row = data as DbRow;
  return { sessionId: row.session_id, payload: row.payload, createdAt: row.created_at };
}

export async function hasDeepening(sessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_deepenings")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`hasDeepening failed: ${error.message}`);
  return !!data;
}

/**
 * Insert the deepening. The unique(session_id) constraint enforces the
 * "só pode ser aprofundado uma vez" rule at the DB level — this throws with
 * a distinctive message so the caller can turn it into a 409.
 */
export async function createDeepening(sessionId: string, payload: DeepeningPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("createDeepening: not authenticated");

  const { error } = await supabase.from("session_deepenings").insert({
    session_id: sessionId,
    user_id: user.id,
    payload,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("deepening_already_exists");
    }
    throw new Error(`createDeepening failed: ${error.message}`);
  }
}
