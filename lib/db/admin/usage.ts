import "server-only";
import {
  BILLABLE_ACTIONS,
  type BillableActionKey,
  INTERNAL_ACTION_KEY,
  UNBILLED_ACTION_KEY,
  type UsageActionKey,
} from "@/lib/coins/billable";
import { type ChargeReason, isChargeReason } from "@/lib/coins/pricing";
import { SESSION_MODES, type SessionMode } from "@/lib/domain/session";
import { hasAudioPricing, hasChatPricing } from "@/lib/llm/pricing";
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
  totalCoins: number;
};

/**
 * Um modelo dentro de uma rota. A quebra existe para o analista de
 * `/admin/insights` poder dizer "a rota X está num modelo caro para o que ela
 * faz" — a pergunta mais barata de responder que este painel tem, e a única
 * que não dá para responder olhando só o custo por rota.
 *
 * `priced = false` quando o modelo não está em `lib/llm/pricing.ts`: o custo
 * dele entrou no banco como ZERO e contamina toda soma acima. É o número que
 * precisa aparecer antes de qualquer conversa sobre margem.
 */
export type UsageByModel = {
  model: string;
  events: number;
  totalCostUsd: number;
  priced: boolean;
};

export type UsageByRoute = {
  route: string;
  events: number;
  totalCostUsd: number;
  /** Ordenada por custo. Quase sempre um item só — uma rota, um modelo. */
  models: UsageByModel[];
};
export type UsageByUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  events: number;
  totalCostUsd: number;
  totalCoins: number;
};
export type UsageBySession = {
  sessionId: string;
  title: string | null;
  createdAt: string;
  durationMs: number | null;
  totalCostUsd: number;
  events: number;
  coins: number;
  costPerCoinUsd: number | null;
  userId: string | null;
  ownerDisplayName: string | null;
  mode: SessionMode | null;
};
export type UsageByDay = { day: string; totalCostUsd: number; events: number };

/**
 * Uma linha por AÇÃO cobrável (ver lib/coins/billable.ts), mais a linha
 * `unbilled` do que se gastou sem cobrar. É o corte que responde "este preço
 * se paga?" — o de rota responde "onde o dinheiro foi", que é outra pergunta.
 * A conversão para real e a margem ficam com `lib/coins/economics.ts`; aqui só
 * saem números medidos.
 */
export type UsageByAction = {
  key: UsageActionKey;
  /** Chamadas de LLM atribuídas à ação. */
  events: number;
  /** Custo medido no período, em dólar. */
  totalCostUsd: number;
  /** Moedas debitadas pelo ledger. Sempre 0 em `unbilled`. */
  coins: number;
  /** Lançamentos no ledger: minutos iniciados, estudos gerados, reprocessos. */
  executions: number;
};

/**
 * As três etapas de LLM do estudo, mais os nomes de rota LEGADOS que saíram do
 * código e continuam no banco (ver o comentário de `UsageRoute` em
 * lib/db/usage.ts). Esquecer os legados não quebra nada visivelmente: o custo
 * antigo do estudo some caladamente dentro da linha da gravação que o gerou.
 */
const STUDY_ROUTES = new Set([
  "study-questions",
  "study-answers",
  "study-write",
  "study-guard",
  "deepening",
  "deepening-audit",
  "study-plan",
  "study-audit",
]);

const REPROCESS_SUMMARY_ROUTES = new Set([
  "final-summary-reprocess",
  "summary-enrichment-reprocess",
  // Reprocessar não reexecuta só o resumo: regenera também praticar, releia e
  // lembra (ver o Promise.all em app/api/final-summary/reprocess/route.ts).
  // São 3 chamadas de LLM a mais por reprocessamento, e enquanto elas
  // gravavam as rotas SEM sufixo o custo delas era lido como custo da
  // gravação — a margem de `reprocess_summary` saía otimista.
  "practices-reprocess",
  "rereads-reprocess",
  "reminders-reprocess",
]);

/**
 * Rotas que o painel dispara para si mesmo. Não são gasto de usuário e nunca
 * terão moeda atrás — ver `INTERNAL_ACTION_KEY`.
 */
const INTERNAL_ROUTES = new Set(["admin-insights"]);

const ACTION_BY_MODE: Record<SessionMode, BillableActionKey> = {
  live: "live",
  audio_only: "audio_only",
  transcript_only: "transcript_only",
};

const ACTION_BY_REASON = new Map<ChargeReason, BillableActionKey>(
  BILLABLE_ACTIONS.flatMap((action) => action.reasons.map((r) => [r, action.key] as const))
);

/**
 * Toda rota que não é do estudo nem do reprocessamento de resumo está dentro
 * do preço por minuto da gravação — inclusive as gratuitas (praticar, releia,
 * lembra, formatação). Sem sessão para dizer o modo, o custo cai em
 * `unbilled`: é gasto real que ninguém pagou, e ele PRECISA aparecer.
 */
function actionForEvent(route: string, mode: SessionMode | null): UsageActionKey {
  if (INTERNAL_ROUTES.has(route)) return INTERNAL_ACTION_KEY;
  if (STUDY_ROUTES.has(route)) return "study";
  if (REPROCESS_SUMMARY_ROUTES.has(route)) return "reprocess_summary";
  return mode ? ACTION_BY_MODE[mode] : UNBILLED_ACTION_KEY;
}

export type UsageFilters = {
  userId?: string;
  route?: string;
  sessionId?: string;
  /**
   * Recording mode of the parent session. When set, only events tied to a
   * session with this mode are counted. Events without a session_id (ad-hoc
   * routes like verse / format-paragraphs) are excluded when the filter is on.
   */
  mode?: SessionMode;
  from?: string;
  to?: string;
};

export type AdminUsageSummary = {
  totals: UsageTotals;
  byRoute: UsageByRoute[];
  byUser: UsageByUser[];
  bySession: UsageBySession[];
  byDay: UsageByDay[];
  byAction: UsageByAction[];
  routes: string[];
  /**
   * Custo do milheiro de moeda no agregado — e ele sai SÓ do custo cobrável.
   *
   * Somar aqui o gasto sem cobrança e o custo interno do painel produzia um
   * número que não responde pergunta nenhuma: ele misturava "o preço das ações
   * se paga?" com "quanto o produto dá de graça?", e a resposta piorava toda
   * vez que um admin abria a tela de insights — a própria análise entrava na
   * conta. Pior, ele contradizia as margens por ação logo abaixo, que sempre
   * foram cobráveis contra cobráveis.
   *
   * As duas fatias excluídas não sumiram: estão em `unchargedCostUsd` e
   * `internalCostUsd`, ao lado, porque continuam saindo do lucro — só não são
   * problema de PREÇO.
   */
  overallCostPerCoinUsd: number | null;
  /** Custo das ações que debitaram moeda. Base do número acima. */
  billableCostUsd: number;
  /**
   * Gasto de usuário sem moeda atrás: consulta de versículo e formatação fora
   * de uma gravação, mais eventos cuja sessão foi apagada. Fora da margem,
   * dentro do prejuízo.
   */
  unchargedCostUsd: number;
  /** Custo que o próprio painel gera (a análise de /api/admin/insights). */
  internalCostUsd: number;
  /**
   * Chamadas cujo modelo não está em `lib/llm/pricing.ts`. Elas gravaram custo
   * ZERO, então todo total acima está subestimado — e ninguém descobre isso
   * olhando um painel que só mostra somas. É o número que precisa ser dito
   * antes de qualquer decisão de preço.
   */
  unpricedEvents: number;
  /** Os modelos por trás desse número, para o aviso poder nomeá-los. */
  unpricedModels: string[];
};

type EventRow = {
  route: string;
  model: string | null;
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
  capture_mode: string | null;
};

function parseMode(value: string | null | undefined): SessionMode | null {
  return (SESSION_MODES as readonly string[]).includes(value ?? "") ? (value as SessionMode) : null;
}

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
    totalCoins: 0,
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
      "route, model, user_id, session_id, total_cost_usd, prompt_tokens, completion_tokens, audio_seconds, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50_000);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.route) query = query.eq("route", filters.route);
  if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  let modeSessionIds: Set<string> | null = null;
  if (filters.mode) {
    // llm_usage_events has no mode column, so resolve session ids of the
    // requested mode first and restrict the event query to that set. The
    // subquery is bounded to sessions the same admin scope can read.
    const modeSessionsQuery = admin.from("sessions").select("id").eq("capture_mode", filters.mode);
    const modeSessions =
      filters.userId != null
        ? await modeSessionsQuery.eq("user_id", filters.userId)
        : await modeSessionsQuery;
    if (modeSessions.error) {
      throw new Error(`loadAdminUsageSummary mode filter failed: ${modeSessions.error.message}`);
    }
    const ids = (modeSessions.data ?? []).map((r) => r.id as string);
    modeSessionIds = new Set(ids);
    // When the mode has no matching sessions, force an empty result rather
    // than returning every event (Supabase treats .in([]) as no filter).
    query = ids.length > 0 ? query.in("session_id", ids) : query.eq("session_id", "__none__");
  }

  const { data: events, error } = await query;
  if (error) throw new Error(`loadAdminUsageSummary events failed: ${error.message}`);

  const rows = (events ?? []) as EventRow[];

  // Ledger de moedas cobradas — autoritativo do que o usuário gastou. É a base
  // do "custo por moeda": totalUsd / totalCoins gastos no mesmo escopo.
  let coinQuery = admin
    .from("coin_transactions")
    .select("user_id, session_id, amount, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(50_000);
  if (filters.userId) coinQuery = coinQuery.eq("user_id", filters.userId);
  if (filters.sessionId) coinQuery = coinQuery.eq("session_id", filters.sessionId);
  if (filters.from) coinQuery = coinQuery.gte("created_at", filters.from);
  if (filters.to) coinQuery = coinQuery.lte("created_at", filters.to);
  const { data: coinRows, error: coinErr } = await coinQuery;
  if (coinErr) throw new Error(`loadAdminUsageSummary coins failed: ${coinErr.message}`);
  type CoinRow = {
    user_id: string;
    session_id: string | null;
    amount: number | string;
    reason: string;
    created_at: string;
  };
  const coinsBySession = new Map<string, number>();
  const coinsByUser = new Map<string, number>();
  const coinsByAction = new Map<BillableActionKey, { coins: number; executions: number }>();
  let coinsTotal = 0;
  for (const r of (coinRows ?? []) as CoinRow[]) {
    // "Moedas gastas" é o que o usuário CONSUMIU, e o ledger guarda também o
    // que ele comprou: grant_coins grava `subscription_grant` e `topup_pack`
    // com amount POSITIVO, e o estorno grava um negativo que é devolução de
    // crédito, não consumo. O motivo é o que separa os dois — um |amount| sobre
    // a tabela inteira somava mil moedas creditadas como mil gastas, e o custo
    // por moeda saía uma fração do que é.
    const reason = r.reason;
    if (!isChargeReason(reason)) continue;
    if (modeSessionIds && (r.session_id == null || !modeSessionIds.has(r.session_id))) continue;
    const spent = Math.abs(toNumber(r.amount));
    if (spent === 0) continue;
    coinsTotal += spent;
    coinsByUser.set(r.user_id, (coinsByUser.get(r.user_id) ?? 0) + spent);
    if (r.session_id) {
      coinsBySession.set(r.session_id, (coinsBySession.get(r.session_id) ?? 0) + spent);
    }
    const actionKey = ACTION_BY_REASON.get(reason);
    if (actionKey) {
      const agg = coinsByAction.get(actionKey) ?? { coins: 0, executions: 0 };
      agg.coins += spent;
      // Um lançamento é uma execução: a gravação debita a cada 60s, e as ações
      // avulsas debitam uma vez por chamada.
      agg.executions += 1;
      coinsByAction.set(actionKey, agg);
    }
  }

  const totals = emptyTotals();
  totals.totalCoins = coinsTotal;
  const routeMap = new Map<string, { route: string; events: number; totalCostUsd: number }>();
  const modelMap = new Map<string, Map<string, { events: number; cost: number }>>();
  const unpricedModels = new Set<string>();
  let unpricedEvents = 0;
  const userMap = new Map<string, { cost: number; events: number }>();
  const sessionAgg = new Map<string, { cost: number; events: number }>();
  const dayMap = new Map<string, UsageByDay>();
  const routeUniverse = new Set<string>();

  for (const row of rows) {
    accumulate(totals, row);
    routeUniverse.add(row.route);
    const rowCost = toNumber(row.total_cost_usd);

    const routeAgg = routeMap.get(row.route) ?? { route: row.route, events: 0, totalCostUsd: 0 };
    routeAgg.events += 1;
    routeAgg.totalCostUsd += rowCost;
    routeMap.set(row.route, routeAgg);

    // A tabela de preço que vale para uma linha depende da rota, não do nome
    // do modelo: `transcribe` é cobrada por minuto de áudio e o resto por
    // token. Perguntar à tabela errada marcaria todo modelo de STT como sem
    // preço, e o aviso perderia o sentido no dia seguinte.
    const model = row.model ?? "(sem modelo)";
    const priced = row.route === "transcribe" ? hasAudioPricing(model) : hasChatPricing(model);
    if (!priced) {
      unpricedEvents += 1;
      unpricedModels.add(model);
    }
    const perRoute = modelMap.get(row.route) ?? new Map<string, { events: number; cost: number }>();
    const modelAgg = perRoute.get(model) ?? { events: 0, cost: 0 };
    modelAgg.events += 1;
    modelAgg.cost += rowCost;
    perRoute.set(model, modelAgg);
    modelMap.set(row.route, perRoute);

    const uAgg = userMap.get(row.user_id) ?? { cost: 0, events: 0 };
    uAgg.cost += rowCost;
    uAgg.events += 1;
    userMap.set(row.user_id, uAgg);

    if (row.session_id) {
      const sAgg = sessionAgg.get(row.session_id) ?? { cost: 0, events: 0 };
      sAgg.cost += rowCost;
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
        totalCoins: coinsByUser.get(id) ?? 0,
      } satisfies UsageByUser;
    })
    .filter((u): u is UsageByUser => u !== null)
    // O ranking é por MOEDAS gastas, não por custo em dólar: o que classifica um
    // usuário é o quanto ele consumiu do produto, e moeda é a unidade que ele
    // paga. O custo em USD continua na linha, como informação, não como ordem.
    .sort((a, b) => b.totalCoins - a.totalCoins || b.totalCostUsd - a.totalCostUsd)
    .slice(0, TOP_USERS);

  const sessionIds = Array.from(sessionAgg.keys());
  let sessionMeta: Map<string, SessionRow> = new Map();
  if (sessionIds.length > 0) {
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, title, created_at, duration_ms, user_id, capture_mode")
      .in("id", sessionIds);
    if (sErr) throw new Error(`loadAdminUsageSummary sessions failed: ${sErr.message}`);
    sessionMeta = new Map(((sessions ?? []) as SessionRow[]).map((s) => [s.id, s]));
  }

  // Segunda passada pelos eventos: a atribuição por ação depende do
  // capture_mode da sessão, que só existe depois de sessionMeta.
  const costByAction = new Map<UsageActionKey, { events: number; cost: number }>();
  for (const row of rows) {
    const mode = row.session_id ? parseMode(sessionMeta.get(row.session_id)?.capture_mode) : null;
    const key = actionForEvent(row.route, mode);
    const agg = costByAction.get(key) ?? { events: 0, cost: 0 };
    agg.events += 1;
    agg.cost += toNumber(row.total_cost_usd);
    costByAction.set(key, agg);
  }

  // Toda ação aparece, mesmo sem dado no período: uma linha ausente se lê como
  // "não existe", quando o que ela diz é "ninguém usou".
  const byAction: UsageByAction[] = [
    ...BILLABLE_ACTIONS.map((action) => {
      const cost = costByAction.get(action.key);
      const coins = coinsByAction.get(action.key);
      return {
        key: action.key,
        events: cost?.events ?? 0,
        totalCostUsd: cost?.cost ?? 0,
        coins: coins?.coins ?? 0,
        executions: coins?.executions ?? 0,
      } satisfies UsageByAction;
    }),
    ...([UNBILLED_ACTION_KEY, INTERNAL_ACTION_KEY] as const).map(
      (key) =>
        ({
          key,
          events: costByAction.get(key)?.events ?? 0,
          totalCostUsd: costByAction.get(key)?.cost ?? 0,
          coins: 0,
          executions: 0,
        }) satisfies UsageByAction
    ),
  ];

  const bySession: UsageBySession[] = sessionIds
    .map((id) => {
      const agg = sessionAgg.get(id);
      if (!agg) return null;
      const meta = sessionMeta.get(id);
      const durationMs = meta?.duration_ms ?? null;
      const coins = coinsBySession.get(id) ?? 0;
      // custo/moeda = tudo que a API cobrou nessa sessão dividido pelas moedas
      // que o usuário efetivamente pagou (live_minute + audio_only_minute +
      // transcript_minute +
      // deepening + reprocess_*). Se não houver ledger para a sessão, é null.
      const costPerCoinUsd = coins > 0 ? agg.cost / coins : null;
      const ownerProfile = meta?.user_id ? profiles.get(meta.user_id) : null;
      return {
        sessionId: id,
        title: meta?.title ?? null,
        createdAt: meta?.created_at ?? "",
        durationMs,
        totalCostUsd: agg.cost,
        events: agg.events,
        coins,
        costPerCoinUsd,
        userId: meta?.user_id ?? null,
        ownerDisplayName: ownerProfile?.display_name ?? ownerProfile?.email ?? null,
        mode: parseMode(meta?.capture_mode),
      } satisfies UsageBySession;
    })
    .filter((s): s is UsageBySession => s !== null)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, RECENT_SESSIONS);

  const unchargedCostUsd = costByAction.get(UNBILLED_ACTION_KEY)?.cost ?? 0;
  const internalCostUsd = costByAction.get(INTERNAL_ACTION_KEY)?.cost ?? 0;
  const billableCostUsd = totals.totalCostUsd - unchargedCostUsd - internalCostUsd;
  const overallCostPerCoinUsd = coinsTotal > 0 ? billableCostUsd / coinsTotal : null;

  const byRoute: UsageByRoute[] = Array.from(routeMap.values())
    .map((r) => ({
      ...r,
      models: Array.from(modelMap.get(r.route)?.entries() ?? [])
        .map(([model, agg]) => ({
          model,
          events: agg.events,
          totalCostUsd: agg.cost,
          priced: r.route === "transcribe" ? hasAudioPricing(model) : hasChatPricing(model),
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd || b.events - a.events),
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  const byDay = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  return {
    totals,
    byRoute,
    byUser,
    bySession,
    byDay,
    byAction,
    routes: Array.from(routeUniverse).sort(),
    overallCostPerCoinUsd,
    billableCostUsd,
    unchargedCostUsd,
    internalCostUsd,
    unpricedEvents,
    unpricedModels: Array.from(unpricedModels).sort(),
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
