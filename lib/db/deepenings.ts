import "server-only";
import type { StudyPayload, StudyRecord } from "@/lib/domain/study";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for session deepenings — the on-demand "aprofundamento" a user
 * can generate once per session. See migration 0009: unique(session_id) is the
 * hard rule; UI/API only surface it.
 */

export type DeepeningRow = {
  sessionId: string;
  payload: StudyPayload;
  /**
   * As perguntas que originaram o estudo e o recorte respondido. A coluna se
   * chama `plan` desde a migração 0033, quando o passo 1 do pipeline ainda era
   * um plano de eixos; hoje guarda um `StudyRecord`. NULL nos estudos
   * anteriores ao pipeline — não há backfill possível.
   */
  plan: StudyRecord | null;
  createdAt: string;
};

type DbRow = {
  session_id: string;
  payload: StudyPayload;
  plan: StudyRecord | null;
  created_at: string;
};

export async function getDeepening(sessionId: string): Promise<DeepeningRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_deepenings")
    .select("session_id, payload, plan, created_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`getDeepening failed: ${error.message}`);
  if (!data) return null;
  const row = data as DbRow;
  return {
    sessionId: row.session_id,
    payload: row.payload,
    plan: row.plan ?? null,
    createdAt: row.created_at,
  };
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
 * List all deepenings do usuário atual, ordenados por criação desc, joined
 * com metadata mínima do sermão parental (título, nome do orador, data,
 * duração). Usado pela página /studies. RLS restringe às linhas do dono.
 */
export type DeepeningListItem = {
  sessionId: string;
  createdAt: string;
  studyTitle: string;
  studyShort: string;
  sessionTitle: string | null;
  sessionCreatedAt: string;
  sessionSpeakerName: string | null;
  sessionDurationMs: number | null;
};

export async function listDeepenings(): Promise<DeepeningListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_deepenings")
    .select(
      "session_id, payload, created_at, session:sessions!inner(title, created_at, duration_ms, speaker_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDeepenings failed: ${error.message}`);
  type Row = {
    session_id: string;
    payload: StudyPayload;
    created_at: string;
    session:
      | {
          title: string | null;
          created_at: string;
          duration_ms: number | null;
          speaker_name: string | null;
        }
      | Array<{
          title: string | null;
          created_at: string;
          duration_ms: number | null;
          speaker_name: string | null;
        }>;
  };
  return ((data ?? []) as Row[]).map((row) => {
    const session = Array.isArray(row.session) ? row.session[0] : row.session;
    return {
      sessionId: row.session_id,
      createdAt: row.created_at,
      studyTitle: row.payload?.title?.trim() || "Estudo sem título",
      studyShort: row.payload?.shortSummary?.trim() ?? "",
      sessionTitle: session?.title ?? null,
      sessionCreatedAt: session?.created_at ?? "",
      sessionSpeakerName: session?.speaker_name ?? null,
      sessionDurationMs: session?.duration_ms ?? null,
    };
  });
}

/**
 * Bulk lookup of which sessions already have a deepening. Returns a Set of
 * session ids the caller can O(1) test. RLS scopes rows to the current user,
 * so no extra ownership filter is needed here.
 */
export async function listDeepenedSessionIds(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_deepenings")
    .select("session_id")
    .in("session_id", sessionIds);
  if (error) throw new Error(`listDeepenedSessionIds failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.session_id as string));
}

/**
 * Insert the deepening. The unique(session_id) constraint enforces the
 * "só pode ser aprofundado uma vez" rule at the DB level — this throws with
 * a distinctive message so the caller can turn it into a 409.
 */
export async function createDeepening(
  sessionId: string,
  payload: StudyPayload,
  plan: StudyRecord
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("createDeepening: not authenticated");

  const { error } = await supabase.from("session_deepenings").insert({
    session_id: sessionId,
    user_id: user.id,
    payload,
    plan,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("deepening_already_exists");
    }
    throw new Error(`createDeepening failed: ${error.message}`);
  }
}

/**
 * Overwrite the payload of an existing deepening. Used by /api/deepening/reprocess
 * to re-run the study prompt on demand. Matches the update-by-session_id
 * pattern used by sessions.updateSessionSummary — RLS scopes the row to the
 * current user, so no explicit ownership filter is needed here.
 */
export async function updateDeepening(
  sessionId: string,
  payload: StudyPayload,
  plan: StudyRecord
): Promise<void> {
  const supabase = await createClient();
  // .select() forces PostgREST to return the affected rows so we can detect
  // silent 0-row updates (e.g. missing UPDATE RLS policy, wrong session_id).
  // Without it, Supabase happily returns { data: null, error: null } even
  // when the update matched nothing — which masked the "reprocess parecia
  // funcionar mas nunca persistia" bug caught in prod.
  const { data, error } = await supabase
    .from("session_deepenings")
    .update({ payload, plan })
    .eq("session_id", sessionId)
    .select("session_id");
  if (error) throw new Error(`updateDeepening failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("updateDeepening failed: no rows affected (RLS or missing row)");
  }
}
