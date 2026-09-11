import "server-only";
import { escapeLikeValue } from "@/lib/db/like";
import type { FeedItem } from "@/lib/domain/feed";
import { parseSessionMode, type SessionMode } from "@/lib/domain/session";
import type { StudyPayload, StudyRecord } from "@/lib/domain/study";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura do CONTEÚDO das sessões, transversal a usuários, para `/admin/sessions`.
 *
 * Existe por uma pergunta que nenhuma das outras telas responde: **o que saiu
 * está bom?** `/admin/usage` diz quanto custou, `/admin/metricas` diz quantas
 * foram e `/admin/feedback` diz que nota deram, mas nenhuma delas mostra o
 * texto que a pessoa de fato leu. Nos primeiros usuários esse texto é a única evidência de
 * qualidade que existe: uma nota "razoável" não diz se o resumo inventou uma
 * citação, se a transcrição perdeu o meio da pregação ou se o estudo respondeu
 * outra coisa.
 *
 * Service-role porque a RLS de `sessions` é dona-a-dona (migração 0005): o
 * client do admin logado enxergaria só as sessões DELE, e a tela existe
 * justamente para ler as dos outros. Só é alcançada depois do
 * `isCurrentUserAdmin()` do layout, e quem lê é server component: o texto
 * chega ao navegador já renderizado, sem rota de API por trás.
 *
 * **Leitura, nunca escrita.** Não há função de update aqui, e não deve haver:
 * corrigir o resumo de alguém pelo painel produziria um conteúdo que o dono
 * não gerou e não sabe que mudou. O que o admin faz com o que lê é mexer em
 * prompt e em modelo, que é o conserto de verdade.
 */

/**
 * Teto da listagem, mesmo espírito do `ADMIN_USERS_PAGE_SIZE`: o dia em que a
 * base passar disto precisa ser VISÍVEL (a tela diz o teto no rodapé), em vez
 * de a lista simplesmente parar de crescer em silêncio.
 */
export const ADMIN_SESSIONS_PAGE_SIZE = 100;

export type AdminSessionListItem = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  mode: SessionMode;
  sourceUrl: string | null;
  speakerName: string | null;
  userId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  /**
   * `short_summary` é denormalizado de `final_summary` (ver 0001), então ele
   * responde "tem resumo?" sem arrastar o jsonb inteiro de cem sessões para
   * uma coluna de sim/não.
   */
  hasSummary: boolean;
  hasStudy: boolean;
};

export type AdminSessionFilters = {
  userId?: string;
  mode?: SessionMode;
  /** Casa no título. Texto de gente, então passa pelo escape do `ilike`. */
  search?: string;
  /** Só as encerradas. Uma sessão em andamento ainda não tem o que avaliar. */
  onlyFinished?: boolean;
};

type ListRow = {
  id: string;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  capture_mode: string | null;
  source_url: string | null;
  speaker_name: string | null;
  user_id: string | null;
};

const SELECT_LIST =
  "id, created_at, ended_at, duration_ms, title, short_summary, capture_mode, source_url, speaker_name, user_id";

export async function listSessionsForAdmin(
  filters: AdminSessionFilters = {}
): Promise<AdminSessionListItem[]> {
  const admin = createAdminClient();

  let q = admin
    .from("sessions")
    .select(SELECT_LIST)
    .order("created_at", { ascending: false })
    .limit(ADMIN_SESSIONS_PAGE_SIZE);

  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.mode) q = q.eq("capture_mode", filters.mode);
  if (filters.onlyFinished) q = q.not("ended_at", "is", null);
  const search = filters.search?.trim();
  if (search) q = q.ilike("title", `%${escapeLikeValue(search)}%`);

  const { data, error } = await q;
  if (error) throw new Error(`listSessionsForAdmin failed: ${error.message}`);

  const rows = (data ?? []) as unknown as ListRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ownerIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];

  const [owners, studyIds] = await Promise.all([
    loadOwners(ownerIds),
    loadSessionIdsWithStudy(ids),
  ]);

  return rows.map((row) => {
    const owner = row.user_id ? owners.get(row.user_id) : undefined;
    return {
      id: row.id,
      createdAt: row.created_at,
      endedAt: row.ended_at,
      durationMs: row.duration_ms,
      title: row.title,
      shortSummary: row.short_summary,
      mode: parseSessionMode(row.capture_mode),
      sourceUrl: row.source_url,
      speakerName: row.speaker_name,
      userId: row.user_id,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      hasSummary: !!row.short_summary?.trim(),
      hasStudy: studyIds.has(row.id),
    };
  });
}

export type AdminSessionDetail = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  mode: SessionMode;
  sourceUrl: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  userId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload | null;
  study: {
    createdAt: string;
    payload: StudyPayload;
    /** Perguntas levantadas e o recorte respondido. Nulo antes da 0033. */
    record: StudyRecord | null;
  } | null;
};

type DetailRow = ListRow & {
  speaker_location: string | null;
  transcript: string | null;
  feed_items: FeedItem[] | null;
  final_summary: SummaryPayload | null;
};

export async function getSessionForAdmin(id: string): Promise<AdminSessionDetail | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sessions")
    .select(`${SELECT_LIST}, speaker_location, transcript, feed_items, final_summary`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getSessionForAdmin failed: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;

  const [owners, study] = await Promise.all([
    loadOwners(row.user_id ? [row.user_id] : []),
    loadStudy(id),
  ]);
  const owner = row.user_id ? owners.get(row.user_id) : undefined;

  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    mode: parseSessionMode(row.capture_mode),
    sourceUrl: row.source_url,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    userId: row.user_id,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    transcript: row.transcript ?? "",
    feedItems: row.feed_items ?? [],
    summary: row.final_summary,
    study,
  };
}

type Owner = { name: string | null; email: string | null };
type ProfileRow = { id: string; display_name: string | null; email: string | null };

async function loadOwners(ids: string[]): Promise<Map<string, Owner>> {
  const map = new Map<string, Owner>();
  if (ids.length === 0) return map;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids);
  // O dono é contexto, não o conteúdo: uma falha aqui não pode esconder a
  // sessão inteira, a tela cai no id curto e segue.
  if (error) return map;

  for (const p of (data ?? []) as unknown as ProfileRow[]) {
    map.set(p.id, { name: p.display_name, email: p.email });
  }
  return map;
}

async function loadSessionIdsWithStudy(ids: string[]): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_deepenings")
    .select("session_id")
    .in("session_id", ids);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => (r as { session_id: string }).session_id));
}

async function loadStudy(sessionId: string): Promise<AdminSessionDetail["study"]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_deepenings")
    .select("created_at, payload, plan")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    created_at: string;
    payload: StudyPayload;
    plan: StudyRecord | null;
  };
  return { createdAt: row.created_at, payload: row.payload, record: row.plan ?? null };
}
