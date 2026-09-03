import "server-only";
import { cache } from "react";
import type { FeedItem } from "@/lib/domain/feed";
import { parseSessionMode, type SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for recording sessions. One row per stop-press: transcript,
 * curated live feed (jsonb), and the final summary.
 *
 * Ownership (user_id) and RLS are deferred to the auth phase.
 *
 * feed_items stays a jsonb column here — it carries every kind including
 * AI-authored ones (relatedVerse, context, suggestedQuote). Speaker-sourced
 * kinds (citedVerse, speakerHighlight, speakerEcho, speakerCitation) are
 * additionally projected into public.session_feed_items by a Postgres
 * trigger (see migration 0004) so cross-session queries have first-class
 * rows to filter and index. Read those via @/lib/db/feed-items.
 *
 * speaker_id / location_id (nullable FKs) link to the reusable entities in
 * @/lib/db/{speakers,locations}. speaker_name / speaker_location stay as
 * the historical snapshot of what was captured at recording time, so
 * renaming a speaker later never rewrites past sessions.
 */

export { SESSION_MODES } from "@/lib/domain/session";

export type SessionRow = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload | null;
};

export type SessionListItem = {
  id: string;
  createdAt: string;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
};

/**
 * O cabeçalho de uma sessão, sem as três colunas pesadas.
 *
 * Existe porque as páginas de GRAVAÇÃO (live/audio/transcribe) e a de estudo
 * decidem rota e cabeçalho a partir de `mode`, `endedAt`, `title` e o
 * snapshot do orador — e nenhuma delas renderiza `transcript`, `feedItems`
 * ou `finalSummary`. Buscar tudo ali significava trazer a transcrição inteira
 * de um sermão de uma hora para abrir um gravador vazio.
 */
export type SessionMeta = Omit<SessionRow, "transcript" | "feedItems" | "finalSummary">;

export type CreateEmptySessionInput = {
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
  mode?: SessionMode;
};

export type UpdateSessionFinalInput = {
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

type DbRow = {
  id: string;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_id: string | null;
  location_id: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  capture_mode: string | null;
  transcript: string;
  feed_items: FeedItem[] | null;
  final_summary: SummaryPayload | null;
};

// `mode` is a Postgres ordered-set aggregate function name — PostgREST tries
// to parse `select=mode` as a call to that aggregate ("WITHIN GROUP is
// required for ordered-set aggregate mode"). The column is physically named
// `capture_mode`; we keep the API-side field name as `mode` for callers.
const SELECT_LIST =
  "id, created_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode";
const SELECT_FULL = `id, created_at, ended_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode, transcript, feed_items, final_summary`;
// O mesmo de SELECT_FULL menos transcript/feed_items/final_summary.
const SELECT_META =
  "id, created_at, ended_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode";

type MetaRow = Omit<DbRow, "transcript" | "feed_items" | "final_summary">;

function rowToMeta(row: MetaRow): SessionMeta {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerId: row.speaker_id,
    locationId: row.location_id,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    mode: parseSessionMode(row.capture_mode),
  };
}

function rowToSession(row: DbRow): SessionRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerId: row.speaker_id,
    locationId: row.location_id,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    mode: parseSessionMode(row.capture_mode),
    transcript: row.transcript,
    feedItems: Array.isArray(row.feed_items) ? row.feed_items : [],
    finalSummary: row.final_summary,
  };
}

/**
 * Create the row at the START of a recording so the URL /recording/{id}/live
 * is stable from the first second. Fills only what the user knows at that
 * point (speaker + location snapshot); transcript/feedItems/summary land
 * later via updateSessionFinal on stop.
 *
 * user_id is pulled from the authenticated Supabase session — RLS then
 * enforces that only the owner can read/update this row.
 */
export async function createEmptySession(input: CreateEmptySessionInput): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("createEmptySession: not authenticated");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      speaker_id: input.speakerId ?? null,
      location_id: input.locationId ?? null,
      speaker_name: input.speakerName,
      speaker_location: input.speakerLocation,
      capture_mode: input.mode ?? "live",
      transcript: "",
      feed_items: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createEmptySession failed: ${error?.message ?? "no id returned"}`);
  }
  return data.id;
}

/**
 * Fill an existing session on stop with the final transcript, curated feed,
 * summary payload, and duration. RLS scopes the update to the owner, so no
 * explicit ownership check is needed here.
 */
export async function updateSessionFinal(
  id: string,
  input: UpdateSessionFinalInput
): Promise<void> {
  const supabase = await createClient();
  const endedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ended_at: endedAt,
    duration_ms: input.durationMs,
    title: input.summary.title || null,
    short_summary: input.summary.shortSummary || null,
    speaker_name: input.speakerName,
    speaker_location: input.speakerLocation,
    transcript: input.transcript,
    feed_items: input.feedItems,
    final_summary: input.summary,
  };
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;

  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionFinal failed: ${error.message}`);
}

export type ListSessionsFilter = {
  speakerId?: string;
  locationId?: string;
};

type ListRow = {
  id: string;
  created_at: string;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_id: string | null;
  location_id: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  capture_mode: string | null;
};

function rowToListItem(r: ListRow): SessionListItem {
  return {
    id: r.id,
    createdAt: r.created_at,
    durationMs: r.duration_ms,
    title: r.title,
    shortSummary: r.short_summary,
    speakerId: r.speaker_id,
    locationId: r.location_id,
    speakerName: r.speaker_name,
    speakerLocation: r.speaker_location,
    mode: parseSessionMode(r.capture_mode),
  };
}

/**
 * Sessões CONCLUÍDAS. `ended_at` só é preenchido por updateSessionFinal /
 * updateSessionTranscript, ou seja, ao encerrar de verdade — filtrar por ele
 * tira da lista as gravações que ficaram no meio do caminho, que passam a
 * viver em `listUnfinishedSessions`.
 */
export async function listSessions(filter: ListSessionsFilter = {}): Promise<SessionListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("sessions")
    .select(SELECT_LIST)
    .not("ended_at", "is", null)
    .order("created_at", { ascending: false });

  if (filter.speakerId) q = q.eq("speaker_id", filter.speakerId);
  if (filter.locationId) q = q.eq("location_id", filter.locationId);

  const { data, error } = await q;
  if (error) throw new Error(`listSessions failed: ${error.message}`);
  return (data ?? []).map((r) => rowToListItem(r as ListRow));
}

/**
 * Gravações EM ABERTO — a linha existe, mas nunca foi encerrada. Acontece
 * quando o navegador fecha no meio, quando a bateria acaba, ou quando a pessoa
 * sai da página com a gravação congelada por falta de crédito.
 *
 * Ficam listadas para que a gravação não vire um fantasma invisível: o usuário
 * decide se volta para ela ou se apaga. Abrir a sessão de novo reaproveita os
 * chunks de áudio que ficaram pendentes no IndexedDB (ver `useTranscribeQueue`,
 * TTL de 24h); o texto já transcrito antes do fechamento, porém, vivia só na
 * memória da aba e não volta.
 */
export async function listUnfinishedSessions(): Promise<SessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_LIST)
    .is("ended_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listUnfinishedSessions failed: ${error.message}`);
  return (data ?? []).map((r) => rowToListItem(r as ListRow));
}

/**
 * A sessão inteira, incluindo transcrição, feed e resumo.
 *
 * Memoizada por render pass: as páginas de `/recording/[id]/*` chamam isto no
 * `generateMetadata` E no corpo, e o Next só deduplica `fetch()` — consulta
 * do Supabase, não. Eram duas leituras das colunas mais pesadas do banco por
 * page view, a segunda apenas para descobrir o `title` da aba.
 *
 * Quem não precisa de `transcript`/`feedItems`/`finalSummary` deve chamar
 * `getSessionMeta`.
 */
export const getSession = cache(async (id: string): Promise<SessionRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSession failed: ${error.message}`);
  return data ? rowToSession(data as DbRow) : null;
});

/** Cabeçalho da sessão, sem as colunas pesadas. Ver {@link SessionMeta}. */
export const getSessionMeta = cache(async (id: string): Promise<SessionMeta | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_META)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSessionMeta failed: ${error.message}`);
  return data ? rowToMeta(data as MetaRow) : null;
});

export type UpdateSessionMetaInput = {
  title?: string | null;
  speakerName?: string | null;
  speakerLocation?: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

export async function updateSessionMeta(id: string, input: UpdateSessionMetaInput): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.speakerName !== undefined) patch.speaker_name = input.speakerName;
  if (input.speakerLocation !== undefined) patch.speaker_location = input.speakerLocation;
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionMeta failed: ${error.message}`);
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(`deleteSession failed: ${error.message}`);
}

/**
 * Overwrite only the final_summary payload (plus its derived title and
 * short_summary). Used by POST /api/final-summary/reprocess — transcript,
 * feed_items and duration_ms are preserved as originally captured.
 */
export async function updateSessionSummary(id: string, summary: SummaryPayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      title: summary.title || null,
      short_summary: summary.shortSummary || null,
      final_summary: summary,
    })
    .eq("id", id);
  if (error) throw new Error(`updateSessionSummary failed: ${error.message}`);
}

export type UpdateSessionTranscriptInput = {
  transcript: string;
  durationMs: number | null;
  /** Título escolhido pelo usuário no header da gravação (ou o padrão
   * "Gravação dia N de mês"). Modo transcrição não roda LLM, então não há
   * título gerado — este é o único que a sessão terá. */
  title: string | null;
  /** Preview curto para o card da lista: as primeiras frases da própria
   * transcrição, cortadas no servidor. Não é um resumo — é um trecho. */
  shortSummary: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

/**
 * Fecha uma sessão do modo transcrição: grava o texto capturado, a duração e
 * o título. `final_summary` fica null de propósito — é o que distingue uma
 * sessão transcript_only salva de uma sessão com resumo, e o que faz a página
 * salva renderizar a transcrição em vez do SummaryView.
 */
export async function updateSessionTranscript(
  id: string,
  input: UpdateSessionTranscriptInput
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    ended_at: new Date().toISOString(),
    duration_ms: input.durationMs,
    title: input.title,
    short_summary: input.shortSummary,
    speaker_name: input.speakerName,
    speaker_location: input.speakerLocation,
    transcript: input.transcript,
    feed_items: [],
  };
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;

  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionTranscript failed: ${error.message}`);
}
