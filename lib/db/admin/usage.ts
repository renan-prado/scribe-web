import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-side usage aggregates. Uses the service-role client so it can
 * count events across every user. Filters are optional and combine via
 * AND. Assumes the caller is authorized (see requireAdmin).
 */

export type UsageTotals = {
  totalCostUsd: number;
  totalEvents: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalAudioSeconds: number;
};

export type UsageByRoute = { route: string; events: number; totalCostUsd: number };
export type UsageByUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  events: number;
  totalCostUsd: number;
};
export type UsageBySession = {
  sessionId: string;
  title: string | null;
  createdAt: string;
  durationMs: number | null;
  totalCostUsd: number;
  events: number;
  costPerMinuteUsd: number | null;
  userId: string | null;
  ownerDisplayName: string | null;
};
export type UsageByDay = { day: string; totalCostUsd: number; events: number };

export type UsageFilters = {
  userId?: string;
  route?: string;
  sessionId?: string;
  from?: string;
  to?: string;
};

export type AdminUsageSummary = {
  totals: UsageTotals;
  byRoute: UsageByRoute[];
  byUser: UsageByUser[];
  bySession: UsageBySession[];
  byDay: UsageByDay[];
  routes: string[];
  overallCostPerMinuteUsd: number | null;
};

type EventRow = {
  route: string;
  user_id: string;
  session_id: string | null;
  total_cost_usd: number | string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  audio_seconds: number | string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  title: string | null;
  created_at: string;
  duration_ms: number | null;
  user_id: string | null;
};

type ProfileLite = { id: string; display_name: string | null; email: string | null };

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function emptyTotals(): UsageTotals {
  return {
    totalCostUsd: 0,
    totalEvents: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalAudioSeconds: 0,
  };
}

function accumulate(acc: UsageTotals, row: EventRow): void {
  acc.totalCostUsd += toNumber(row.total_cost_usd);
  acc.totalEvents += 1;
  acc.totalPromptTokens += row.prompt_tokens ?? 0;
  acc.totalCompletionTokens += row.completion_tokens ?? 0;
  acc.totalAudioSeconds += toNumber(row.audio_seconds);
}

const RECENT_SESSIONS = 50;
const TOP_USERS = 25;

export async function loadAdminUsageSummary(
  filters: UsageFilters = {}
): Promise<AdminUsageSummary> {
  const admin = createAdminClient();

  let query = admin
    .from("llm_usage_events")
    .select(
      "route, user_id, session_id, total_cost_usd, prompt_tokens, completion_tokens, audio_seconds, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50_000);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.route) query = query.eq("route", filters.route);
  if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data: events, error } = await query;
  if (error) throw new Error(`loadAdminUsageSummary events failed: ${error.message}`);

  const rows = (events ?? []) as EventRow[];

  const totals = emptyTotals();
  const routeMap = new Map<string, UsageByRoute>();
  const userMap = new Map<string, { cost: number; events: number }>();
  const sessionAgg = new Map<string, { cost: number; events: number }>();
  const dayMap = new Map<string, UsageByDay>();
  const routeUniverse = new Set<string>();

  for (const row of rows) {
    accumulate(totals, row);
    routeUniverse.add(row.route);

    const routeAgg = routeMap.get(row.route) ?? { route: row.route, events: 0, totalCostUsd: 0 };
    routeAgg.events += 1;
    routeAgg.totalCostUsd += toNumber(row.total_cost_usd);
    routeMap.set(row.route, routeAgg);

    const uAgg = userMap.get(row.user_id) ?? { cost: 0, events: 0 };
    uAgg.cost += toNumber(row.total_cost_usd);
    uAgg.events += 1;
    userMap.set(row.user_id, uAgg);

    if (row.session_id) {
      const sAgg = sessionAgg.get(row.session_id) ?? { cost: 0, events: 0 };
      sAgg.cost += toNumber(row.total_cost_usd);
      sAgg.events += 1;
      sessionAgg.set(row.session_id, sAgg);
    }

    const day = row.created_at.slice(0, 10);
    const dAgg = dayMap.get(day) ?? { day, totalCostUsd: 0, events: 0 };
    dAgg.totalCostUsd += toNumber(row.total_cost_usd);
    dAgg.events += 1;
    dayMap.set(day, dAgg);
  }

  const userIds = Array.from(userMap.keys());
  let profiles: Map<string, ProfileLite> = new Map();
  if (userIds.length > 0) {
    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);
    if (pErr) throw new Error(`loadAdminUsageSummary profiles failed: ${pErr.message}`);
    profiles = new Map(((profs ?? []) as ProfileLite[]).map((p) => [p.id, p]));
  }

  const byUser: UsageByUser[] = userIds
    .map((id) => {
      const agg = userMap.get(id);
      if (!agg) return null;
      const prof = profiles.get(id);
      return {
        userId: id,
        displayName: prof?.display_name ?? null,
        email: prof?.email ?? null,
        events: agg.events,
        totalCostUsd: agg.cost,
      } satisfies UsageByUser;
    })
    .filter((u): u is UsageByUser => u !== null)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, TOP_USERS);

  const sessionIds = Array.from(sessionAgg.keys());
  let sessionMeta: Map<string, SessionRow> = new Map();
  if (sessionIds.length > 0) {
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, title, created_at, duration_ms, user_id")
      .in("id", sessionIds);
    if (sErr) throw new Error(`loadAdminUsageSummary sessions failed: ${sErr.message}`);
    sessionMeta = new Map(((sessions ?? []) as SessionRow[]).map((s) => [s.id, s]));
  }

  const bySession: UsageBySession[] = sessionIds
    .map((id) => {
      const agg = sessionAgg.get(id);
      if (!agg) return null;
      const meta = sessionMeta.get(id);
      const durationMs = meta?.duration_ms ?? null;
      const minutes = durationMs && durationMs > 0 ? durationMs / 60_000 : 0;
      const costPerMinuteUsd = minutes > 0 ? agg.cost / minutes : null;
      const ownerProfile = meta?.user_id ? profiles.get(meta.user_id) : null;
      return {
        sessionId: id,
        title: meta?.title ?? null,
        createdAt: meta?.created_at ?? "",
        durationMs,
        totalCostUsd: agg.cost,
        events: agg.events,
        costPerMinuteUsd,
        userId: meta?.user_id ?? null,
        ownerDisplayName: ownerProfile?.display_name ?? ownerProfile?.email ?? null,
      } satisfies UsageBySession;
    })
    .filter((s): s is UsageBySession => s !== null)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, RECENT_SESSIONS);

  const totalMinutes = bySession.reduce(
    (sum, s) => sum + (s.durationMs && s.durationMs > 0 ? s.durationMs / 60_000 : 0),
    0
  );
  const recordedCost = bySession.reduce((sum, s) => sum + s.totalCostUsd, 0);
  const overallCostPerMinuteUsd = totalMinutes > 0 ? recordedCost / totalMinutes : null;

  const byRoute = Array.from(routeMap.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  const byDay = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  return {
    totals,
    byRoute,
    byUser,
    bySession,
    byDay,
    routes: Array.from(routeUniverse).sort(),
    overallCostPerMinuteUsd,
  };
}

/**
 * Cheap list for the user filter dropdown — no aggregate work.
 */
export async function listUsersForFilter(): Promise<
  { id: string; displayName: string | null; email: string | null }[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email")
    .order("display_name", { ascending: true });
  if (error) throw new Error(`listUsersForFilter failed: ${error.message}`);
  return (data as ProfileLite[]).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    email: p.email,
  }));
}
