import "server-only";
import type { RemindersPayload } from "@/lib/domain/reminders";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistência para session_reminders — o "Lembra disso?" gerado junto com o
 * final_summary. Uma linha por session_id (unique constraint em SQL). O
 * reprocess do resumo sobrescreve o payload via upsert.
 */

export type RemindersRow = {
  sessionId: string;
  payload: RemindersPayload;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  session_id: string;
  payload: RemindersPayload;
  created_at: string;
  updated_at: string;
};

export async function getReminders(sessionId: string): Promise<RemindersRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_reminders")
    .select("session_id, payload, created_at, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`getReminders failed: ${error.message}`);
  if (!data) return null;
  const row = data as DbRow;
  return {
    sessionId: row.session_id,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert por session_id. Reprocess reescreve o payload inteiro; primeira
 * geração cria a linha. .select() força o PostgREST a retornar a linha
 * afetada — sem isso, uma RLS quebrada retornaria data:null sem erro.
 */
export async function upsertReminders(sessionId: string, payload: RemindersPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("upsertReminders: not authenticated");

  const { data, error } = await supabase
    .from("session_reminders")
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
  if (error) throw new Error(`upsertReminders failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("upsertReminders failed: no rows affected (RLS or missing row)");
  }
}
