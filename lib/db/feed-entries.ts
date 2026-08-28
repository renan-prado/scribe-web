import "server-only";
import type { PracticesPayload } from "@/lib/domain/practices";
import type { RemindersPayload } from "@/lib/domain/reminders";
import type { RereadsPayload } from "@/lib/domain/rereads";
import { createClient } from "@/lib/supabase/server";
import type {
  FeedEntry,
  FeedEntryKind,
  FeedEntrySessionRef,
  FeedOrder,
} from "./feed-entries-types";

export type {
  FeedEntry,
  FeedEntryKind,
  FeedEntrySessionRef,
  FeedOrder,
} from "./feed-entries-types";

/**
 * Feed unificado do /feed — junta os três tipos de card gerados junto com o
 * final_summary (praticar / releia / lembra) de TODAS as sessões do usuário
 * em uma única lista, ordenada por data agendada absoluta (createdAt da
 * sessão + dayOffset). Só entram itens cuja data agendada já foi alcançada.
 *
 * RLS nas tabelas session_practices / session_rereads / session_reminders
 * já auto-escopa por user_id, então basta emitir os três selects e cruzar
 * em memória com a lista de sessões do próprio usuário.
 */

export type ListFeedEntriesInput = {
  order: FeedOrder;
  offset: number;
  limit: number;
  now: Date;
  /**
   * Sessão a esconder do feed paginado — o /feed a exibe fixa no topo via
   * ReflectionCard. Evita duplicar o card da última gravação em dois lugares.
   */
  excludeSessionId?: string | null;
};

export type ListFeedEntriesResult = {
  items: FeedEntry[];
  total: number;
  hasMore: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TIEBREAK: Record<FeedEntryKind, number> = {
  practice: 0,
  reread: 1,
  reminder: 2,
};

function scheduledAtIso(createdAt: string, dayOffset: number): string {
  const base = new Date(createdAt);
  base.setHours(0, 0, 0, 0);
  const at = new Date(base.getTime() + dayOffset * DAY_MS);
  return at.toISOString();
}

function isEligible(scheduledAt: string, now: Date): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(scheduledAt).getTime() <= startOfToday.getTime();
}

type SessionRefRow = {
  id: string;
  created_at: string;
  title: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
};

export async function listFeedEntries(input: ListFeedEntriesInput): Promise<ListFeedEntriesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0, hasMore: false };

  const [sessionsRes, practicesRes, rereadsRes, remindersRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, created_at, title, speaker_name, speaker_location")
      .order("created_at", { ascending: false }),
    supabase.from("session_practices").select("session_id, payload"),
    supabase.from("session_rereads").select("session_id, payload"),
    supabase.from("session_reminders").select("session_id, payload"),
  ]);

  if (sessionsRes.error) {
    throw new Error(`listFeedEntries.sessions failed: ${sessionsRes.error.message}`);
  }
  if (practicesRes.error) {
    throw new Error(`listFeedEntries.practices failed: ${practicesRes.error.message}`);
  }
  if (rereadsRes.error) {
    throw new Error(`listFeedEntries.rereads failed: ${rereadsRes.error.message}`);
  }
  if (remindersRes.error) {
    throw new Error(`listFeedEntries.reminders failed: ${remindersRes.error.message}`);
  }

  const sessions = new Map<string, FeedEntrySessionRef>();
  for (const row of (sessionsRes.data ?? []) as SessionRefRow[]) {
    if (input.excludeSessionId && row.id === input.excludeSessionId) continue;
    sessions.set(row.id, {
      id: row.id,
      createdAt: row.created_at,
      title: row.title,
      speakerName: row.speaker_name,
      speakerLocation: row.speaker_location,
    });
  }

  const entries: FeedEntry[] = [];

  for (const row of (practicesRes.data ?? []) as {
    session_id: string;
    payload: PracticesPayload;
  }[]) {
    const session = sessions.get(row.session_id);
    if (!session) continue;
    for (const item of row.payload?.items ?? []) {
      const scheduledAt = scheduledAtIso(session.createdAt, item.dayOffset);
      if (!isEligible(scheduledAt, input.now)) continue;
      entries.push({
        kind: "practice",
        key: `practice:${session.id}:${item.dayOffset}`,
        dayOffset: item.dayOffset,
        scheduledAt,
        session,
        item,
      });
    }
  }

  for (const row of (rereadsRes.data ?? []) as { session_id: string; payload: RereadsPayload }[]) {
    const session = sessions.get(row.session_id);
    if (!session) continue;
    for (const item of row.payload?.items ?? []) {
      const scheduledAt = scheduledAtIso(session.createdAt, item.dayOffset);
      if (!isEligible(scheduledAt, input.now)) continue;
      entries.push({
        kind: "reread",
        key: `reread:${session.id}:${item.dayOffset}`,
        dayOffset: item.dayOffset,
        scheduledAt,
        session,
        item,
      });
    }
  }

  for (const row of (remindersRes.data ?? []) as {
    session_id: string;
    payload: RemindersPayload;
  }[]) {
    const session = sessions.get(row.session_id);
    if (!session) continue;
    for (const item of row.payload?.items ?? []) {
      const scheduledAt = scheduledAtIso(session.createdAt, item.dayOffset);
      if (!isEligible(scheduledAt, input.now)) continue;
      entries.push({
        kind: "reminder",
        key: `reminder:${session.id}:${item.dayOffset}`,
        dayOffset: item.dayOffset,
        scheduledAt,
        session,
        item,
      });
    }
  }

  entries.sort((a, b) => {
    const aMs = new Date(a.scheduledAt).getTime();
    const bMs = new Date(b.scheduledAt).getTime();
    if (aMs !== bMs) return input.order === "recent" ? bMs - aMs : aMs - bMs;
    return TIEBREAK[a.kind] - TIEBREAK[b.kind];
  });

  const total = entries.length;
  const offset = Math.max(0, input.offset);
  const limit = Math.max(1, Math.min(100, input.limit));
  const slice = entries.slice(offset, offset + limit);
  const hasMore = offset + slice.length < total;

  return { items: slice, total, hasMore };
}
