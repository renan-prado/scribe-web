import "server-only";
import { isActiveStatus, PLANS, type PlanKey } from "@/lib/billing/plans";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { stripeFeeCents } from "@/lib/partners/economics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Métricas de produto do admin: o funil inteiro, da visita ao dinheiro.
 *
 * Antes disso o /admin sabia dizer quantos usuários existem e quanto a OpenAI
 * custou — mas não quantos assinam, quantos gravaram alguma coisa, nem se as
 * moedas de boas-vindas estão sendo usadas. Este módulo fecha essa lacuna sem
 * nenhuma tabela nova: tudo sai de `profiles`, `subscriptions`,
 * `coin_transactions` e `sessions`, que já registram o que interessa.
 *
 * Existe ANTES das telas de parceiro de propósito. Toda métrica do parceiro é
 * uma métrica de produto filtrada por `partner_id` — construir as duas coisas
 * separadamente daria duas definições de "conversão" que um dia discordariam,
 * e a discordância apareceria como um parceiro reclamando do próprio painel.
 * Por isso o filtro `partnerId` está aqui embaixo, e não numa cópia.
 *
 * Sobre custo: tudo em CENTAVOS de BRL, inteiro. Dinheiro em float acumula
 * erro de arredondamento, e este módulo alimenta decisão de preço e de
 * comissão.
 */

export type MetricsFilters = {
  /** ISO. Recorta aquisição, receita e atividade; o saldo é sempre do agora. */
  from?: string;
  to?: string;
  /** Recorta tudo à base de um parceiro. É o que o painel dele consome. */
  partnerId?: string;
};

export type FunnelMetrics = {
  signups: number;
  /** Gravou ao menos uma sessão. */
  activated: number;
  /** Gastou ao menos uma moeda (sinal mais forte que "abriu o app"). */
  spentAny: number;
  /** Zerou o saldo inicial — o indício mais forte de intenção de compra. */
  exhaustedFreeCoins: number;
  /** Assinou alguma vez (inclui quem já cancelou). */
  everSubscribed: number;
  /** Assinatura viva agora. */
  activeSubscribers: number;
  activationRate: number;
  conversionRate: number;
};

export type WelcomeCoinUsage = {
  /** Faixas do consumo das moedas de boas-vindas, por conta cadastrada. */
  untouched: number;
  partial: number;
  most: number;
  exhausted: number;
};

export type RevenueMetrics = {
  /** Receita recorrente mensal, em centavos. */
  mrrCents: number;
  /** Receita média por assinante ativo. */
  arpuCents: number;
  activeByPlan: Record<PlanKey, number>;
  /** Assinaturas com cancelamento agendado — churn que já é conhecido. */
  cancelScheduled: number;
  /** Estimativa de taxa do Stripe sobre o MRR. */
  stripeFeeCents: number;
};

export type CoinLiability = {
  granted: number;
  spent: number;
  /**
   * Moedas creditadas e ainda não gastas. Como os créditos acumulam de um mês
   * para o outro, este saldo é custo de OpenAI já vendido e ainda não
   * incorrido — a métrica que ninguém lembra de olhar até ela doer.
   */
  outstanding: number;
  /** O mesmo saldo convertido pelo custo medido, em centavos de BRL. */
  outstandingCostCents: number;
};

export type SignupPoint = { day: string; count: number };

export type AdminMetrics = {
  funnel: FunnelMetrics;
  welcomeCoins: WelcomeCoinUsage;
  revenue: RevenueMetrics;
  liability: CoinLiability;
  signupsByDay: SignupPoint[];
  /** Dias entre o cadastro e a primeira assinatura (mediana). */
  medianDaysToSubscribe: number | null;
};

type ProfileRow = {
  id: string;
  created_at: string;
  coin_balance: number;
};

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  cancel_at_period_end: boolean;
  created_at: string;
};

const MAX_ROWS = 50_000;

/**
 * Custo de 1.000 moedas em centavos de BRL, para converter o passivo.
 * O chamador passa o valor MEDIDO (`loadAdminUsageSummary` + câmbio) em vez de
 * uma constante: ele muda com o dólar e com o preço do modelo, e um passivo
 * calculado sobre número velho é pior que passivo nenhum.
 */
export async function loadAdminMetrics(
  filters: MetricsFilters = {},
  costPerThousandCoinsCents = 0
): Promise<AdminMetrics> {
  const admin = createAdminClient();

  // --- contas ---------------------------------------------------------------
  let profileQuery = admin
    .from("profiles")
    .select("id, created_at, coin_balance")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (filters.partnerId) profileQuery = profileQuery.eq("partner_id", filters.partnerId);
  if (filters.from) profileQuery = profileQuery.gte("created_at", filters.from);
  if (filters.to) profileQuery = profileQuery.lte("created_at", filters.to);

  const { data: profileData, error: profileErr } = await profileQuery;
  if (profileErr) throw new Error(`loadAdminMetrics profiles failed: ${profileErr.message}`);
  const profiles = (profileData ?? []) as ProfileRow[];
  const userIds = profiles.map((p) => p.id);
  const createdAt = new Map(profiles.map((p) => [p.id, p.created_at]));

  // Sem contas no recorte, devolvemos zeros em vez de rodar consultas com
  // `in([])` — que o PostgREST trata como "sem filtro" e devolveria a base
  // inteira. É uma pegadinha silenciosa: o número sairia grande, não vazio.
  if (userIds.length === 0) return emptyMetrics();

  const [sessions, coins, subscriptions] = await Promise.all([
    loadSessionUserIds(admin, userIds, filters),
    loadCoinAggregates(admin, userIds, filters),
    loadSubscriptions(admin, userIds),
  ]);

  // --- funil ----------------------------------------------------------------
  const everSubscribed = new Set(subscriptions.map((s) => s.user_id));
  const activeSubs = subscriptions.filter((s) => isActiveStatus(s.status));
  const activeSubscribers = new Set(activeSubs.map((s) => s.user_id)).size;

  // "Zerou as moedas de boas-vindas" precisa somar o que foi gasto ao saldo
  // atual: quem comprou depois tem saldo alto de novo, e olhar só o saldo
  // marcaria essa pessoa como "nunca gastou".
  let exhausted = 0;
  const usage: WelcomeCoinUsage = { untouched: 0, partial: 0, most: 0, exhausted: 0 };
  for (const p of profiles) {
    const spent = coins.spentByUser.get(p.id) ?? 0;
    const ratio = INITIAL_COIN_BALANCE > 0 ? spent / INITIAL_COIN_BALANCE : 0;
    if (spent === 0) usage.untouched += 1;
    else if (ratio < 0.5) usage.partial += 1;
    else if (ratio < 1) usage.most += 1;
    else {
      usage.exhausted += 1;
      exhausted += 1;
    }
  }

  const signups = profiles.length;
  const activated = sessions.usersWithSession.size;
  const spentAny = signups - usage.untouched;

  const funnel: FunnelMetrics = {
    signups,
    activated,
    spentAny,
    exhaustedFreeCoins: exhausted,
    everSubscribed: everSubscribed.size,
    activeSubscribers,
    activationRate: signups > 0 ? activated / signups : 0,
    conversionRate: signups > 0 ? everSubscribed.size / signups : 0,
  };

  // --- receita --------------------------------------------------------------
  const activeByPlan: Record<PlanKey, number> = { free: 0, pessoal: 0, estudioso: 0 };
  let mrrCents = 0;
  for (const sub of activeSubs) {
    const plan = (sub.plan in PLANS ? sub.plan : "free") as PlanKey;
    activeByPlan[plan] += 1;
    mrrCents += PLANS[plan].priceCents;
  }

  const revenue: RevenueMetrics = {
    mrrCents,
    arpuCents: activeSubscribers > 0 ? Math.round(mrrCents / activeSubscribers) : 0,
    activeByPlan,
    cancelScheduled: activeSubs.filter((s) => s.cancel_at_period_end).length,
    // Aproximação: a taxa fixa incide por cobrança, então o total é ~uma
    // cobrança por assinante ativo.
    stripeFeeCents: activeSubs.reduce((acc, s) => {
      const plan = (s.plan in PLANS ? s.plan : "free") as PlanKey;
      return acc + stripeFeeCents(PLANS[plan].priceCents);
    }, 0),
  };

  // --- passivo de moedas ----------------------------------------------------
  const outstanding = profiles.reduce((acc, p) => acc + Math.max(0, p.coin_balance), 0);
  const liability: CoinLiability = {
    granted: coins.granted,
    spent: coins.spent,
    outstanding,
    outstandingCostCents: Math.round((outstanding * costPerThousandCoinsCents) / 1000),
  };

  // --- tempo até assinar ----------------------------------------------------
  const daysToSubscribe: number[] = [];
  for (const sub of subscriptions) {
    const created = createdAt.get(sub.user_id);
    if (!created) continue;
    const days = (Date.parse(sub.created_at) - Date.parse(created)) / 86_400_000;
    if (Number.isFinite(days) && days >= 0) daysToSubscribe.push(days);
  }

  return {
    funnel,
    welcomeCoins: usage,
    revenue,
    liability,
    signupsByDay: groupByDay(profiles.map((p) => p.created_at)),
    medianDaysToSubscribe: median(daysToSubscribe),
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Quem gravou ao menos uma sessão dentro do recorte. */
async function loadSessionUserIds(
  admin: AdminClient,
  userIds: string[],
  filters: MetricsFilters
): Promise<{ usersWithSession: Set<string> }> {
  let query = admin.from("sessions").select("user_id").in("user_id", userIds).limit(MAX_ROWS);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  const { data, error } = await query;
  if (error) throw new Error(`loadAdminMetrics sessions failed: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) set.add(row.user_id as string);
  }
  return { usersWithSession: set };
}

/**
 * Agrega o ledger de moedas. `amount` é assinado: positivo credita, negativo
 * gasta — a mesma convenção de `coin_transactions` desde 0017.
 */
async function loadCoinAggregates(
  admin: AdminClient,
  userIds: string[],
  filters: MetricsFilters
): Promise<{ granted: number; spent: number; spentByUser: Map<string, number> }> {
  let query = admin
    .from("coin_transactions")
    .select("user_id, amount, created_at")
    .in("user_id", userIds)
    .limit(MAX_ROWS);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(`loadAdminMetrics coins failed: ${error.message}`);

  let granted = 0;
  let spent = 0;
  const spentByUser = new Map<string, number>();
  for (const row of data ?? []) {
    const amount = row.amount as number;
    const userId = row.user_id as string;
    if (amount > 0) granted += amount;
    else {
      spent += -amount;
      spentByUser.set(userId, (spentByUser.get(userId) ?? 0) + -amount);
    }
  }
  return { granted, spent, spentByUser };
}

/**
 * Assinaturas das contas do recorte. SEM filtro de data de propósito: a
 * pergunta é "esta coorte de cadastros converteu?", e a assinatura acontece
 * depois — recortá-la pela mesma janela do cadastro descartaria exatamente as
 * conversões que interessam.
 */
async function loadSubscriptions(
  admin: AdminClient,
  userIds: string[]
): Promise<SubscriptionRow[]> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, cancel_at_period_end, created_at")
    .in("user_id", userIds)
    .neq("plan", "free")
    .limit(MAX_ROWS);
  if (error) throw new Error(`loadAdminMetrics subscriptions failed: ${error.message}`);
  return (data ?? []) as SubscriptionRow[];
}

function groupByDay(timestamps: string[]): SignupPoint[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const day = ts.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Mediana, e não média: um único usuário que assinou depois de um ano
 * deslocaria a média e faria o número mentir sobre o caso típico. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

function emptyMetrics(): AdminMetrics {
  return {
    funnel: {
      signups: 0,
      activated: 0,
      spentAny: 0,
      exhaustedFreeCoins: 0,
      everSubscribed: 0,
      activeSubscribers: 0,
      activationRate: 0,
      conversionRate: 0,
    },
    welcomeCoins: { untouched: 0, partial: 0, most: 0, exhausted: 0 },
    revenue: {
      mrrCents: 0,
      arpuCents: 0,
      activeByPlan: { free: 0, pessoal: 0, estudioso: 0 },
      cancelScheduled: 0,
      stripeFeeCents: 0,
    },
    liability: { granted: 0, spent: 0, outstanding: 0, outstandingCostCents: 0 },
    signupsByDay: [],
    medianDaysToSubscribe: null,
  };
}
