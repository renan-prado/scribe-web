import "server-only";
import type { PracticesPayload } from "@/lib/domain/practices";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistência para session_practices — o "Coloque em prática" gerado junto
 * com o final_summary. Uma linha por session_id (unique constraint em SQL).
 * O reprocess do resumo sobrescreve o payload via upsert.
 */

export type PracticesRow = {
  sessionId: string;
  payload: PracticesPayload;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  session_id: string;
  payload: PracticesPayload;
  created_at: string;
  updated_at: string;
};

export async function getPractices(sessionId: string): Promise<PracticesRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_practices")
    .select("session_id, payload, created_at, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`getPractices failed: ${error.message}`);
  if (!data) return null;
  const row = data as DbRow;
  return {
    sessionId: row.session_id,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function hasPractices(sessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_practices")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`hasPractices failed: ${error.message}`);
  return !!data;
}

/**
 * Upsert por session_id. Reprocess reescreve o payload inteiro; primeira
 * geração cria a linha. .select() força o PostgREST a retornar a linha
 * afetada — sem isso, uma RLS/policy quebrada retornaria data:null sem
 * erro (bug já pego no updateDeepening).
 */
export async function upsertPractices(sessionId: string, payload: PracticesPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("upsertPractices: not authenticated");

  const { data, error } = await supabase
    .from("session_practices")
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    )
    .select("session_id");
  if (error) throw new Error(`upsertPractices failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("upsertPractices failed: no rows affected (RLS or missing row)");
  }
}
