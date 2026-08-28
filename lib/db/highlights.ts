import "server-only";
import type { HighlightsPayload } from "@/lib/domain/highlights";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistência para session_highlights — frases marcantes do sermão
 * recicladas sem IA e agendadas para o feed. Uma linha por session_id
 * (unique constraint em SQL); o reprocess sobrescreve o payload via upsert.
 */

export type HighlightsRow = {
  sessionId: string;
  payload: HighlightsPayload;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  session_id: string;
  payload: HighlightsPayload;
  created_at: string;
  updated_at: string;
};

export async function getHighlights(sessionId: string): Promise<HighlightsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_highlights")
    .select("session_id, payload, created_at, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`getHighlights failed: ${error.message}`);
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
 * geração cria a linha. `.select()` força o PostgREST a retornar a linha
 * afetada — sem isso, uma RLS quebrada devolveria data:null sem erro.
 */
export async function upsertHighlights(
  sessionId: string,
  payload: HighlightsPayload
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("upsertHighlights: not authenticated");

  const { data, error } = await supabase
    .from("session_highlights")
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
  if (error) throw new Error(`upsertHighlights failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("upsertHighlights failed: no rows affected (RLS or missing row)");
  }
}
