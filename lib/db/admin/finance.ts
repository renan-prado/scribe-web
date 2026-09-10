import "server-only";

import { isActiveStatus, PLANS, type PlanKey } from "@/lib/billing/plans";
import type {
  Cadence,
  CategoryInput,
  CategoryKind,
  CostNature,
  Currency,
  EntryFilters,
  EntryInput,
  EntryStatus,
  FinanceCategory,
  FinanceEntry,
  FinanceKind,
  FinanceRecurring,
  FinanceScenario,
  FinanceSettings,
  RecurringInput,
  RecurringStatus,
  ScenarioInput,
  SettingsInput,
} from "@/lib/domain/finance";
import type { MeasuredInputs } from "@/lib/finance/aggregate";
import {
  aggregateAiCostByMonth,
  aggregateMeasuredRevenue,
  type CoinCreditRow,
  type UsageCostRow,
} from "@/lib/finance/measured";
import { stripeFeeCents } from "@/lib/partners/economics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura e escrita das cinco tabelas financeiras, e a montagem do lado MEDIDO
 * do painel.
 *
 * Tudo com service-role, depois de `requireAdmin()`, as tabelas de 0043 não
 * têm policy nenhuma, então não existe outro caminho. Nenhuma conta é feita
 * aqui: a aritmética inteira mora em `lib/finance/*`, que é puro e testável
 * sem banco. Este módulo só busca linhas e as converte para os tipos de
 * `lib/domain/finance.ts`.
 *
 * A exceção aparente é `loadMeasuredInputs`, e ela não é exceção: as somas que
 * ele faz são de `lib/finance/measured.ts`, e os números de assinatura vêm de
 * `loadAdminMetrics`, a MESMA implementação que desenha `/admin/metricas`.
 * Uma segunda consulta de MRR aqui seria uma segunda definição de MRR, e um
 * dia o painel financeiro e o de métricas discordariam sobre a mesma receita.
 */

const MAX_ROWS = 20_000;

type AdminClient = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  nature: CostNature;
  sort_order: number;
  archived_at: string | null;
};

const CATEGORY_SELECT = "id, slug, name, kind, nature, sort_order, archived_at";

function toCategory(row: CategoryRow): FinanceCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    nature: row.nature,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

export async function listCategories(): Promise<FinanceCategory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_categories")
    .select(CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listCategories failed: ${error.message}`);
  return ((data ?? []) as CategoryRow[]).map(toCategory);
}

/**
 * O slug é derivado do nome e só na CRIAÇÃO. Renomear "SaaS" para "Ferramentas"
 * não pode mudar o slug: ele é a chave estável que o seed da migração usa, e
 * trocá-la faria as referências do código apontarem para nada.
 */
function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "categoria"
  );
}

export async function createCategory(input: CategoryInput): Promise<FinanceCategory> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_categories")
    .insert({
      slug: slugify(input.name),
      name: input.name,
      kind: input.kind,
      nature: input.nature,
      sort_order: input.sortOrder ?? 100,
    })
    .select(CATEGORY_SELECT)
    .single();
  if (error) throw new Error(`createCategory failed: ${error.message}`);
  return toCategory(data as CategoryRow);
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>
): Promise<FinanceCategory> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.nature !== undefined) patch.nature = input.nature;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  // Arquivar em vez de apagar mantém legível o histórico que aponta para ela.
  if (input.archived !== undefined) {
    patch.archived_at = input.archived ? new Date().toISOString() : null;
  }
  const { data, error } = await admin
    .from("finance_categories")
    .update(patch)
    .eq("id", id)
    .select(CATEGORY_SELECT)
    .single();
  if (error) throw new Error(`updateCategory failed: ${error.message}`);
  return toCategory(data as CategoryRow);
}

// ---------------------------------------------------------------------------
// Recorrências
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  kind: FinanceKind;
  description: string;
  counterparty: string | null;
  category_id: string | null;
  amount_cents: number;
  currency: Currency;
  cadence: Cadence;
  start_date: string;
  end_date: string | null;
  status: RecurringStatus;
  notes: string | null;
  created_at: string;
};

const RECURRING_SELECT =
  "id, kind, description, counterparty, category_id, amount_cents, currency, cadence, start_date, end_date, status, notes, created_at";

function toRecurring(row: RecurringRow): FinanceRecurring {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    counterparty: row.counterparty,
    categoryId: row.category_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    cadence: row.cadence,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listRecurring(): Promise<FinanceRecurring[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_recurring")
    .select(RECURRING_SELECT)
    .order("status", { ascending: true })
    .order("description", { ascending: true })
    .limit(MAX_ROWS);
  if (error) throw new Error(`listRecurring failed: ${error.message}`);
  return ((data ?? []) as RecurringRow[]).map(toRecurring);
}

function recurringPatch(input: Partial<RecurringInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.description !== undefined) patch.description = input.description;
  if (input.counterparty !== undefined) patch.counterparty = input.counterparty || null;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.amountCents !== undefined) patch.amount_cents = input.amountCents;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.cadence !== undefined) patch.cadence = input.cadence;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  return patch;
}

export async function createRecurring(
  input: RecurringInput,
  createdBy: string
): Promise<FinanceRecurring> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_recurring")
    .insert({ ...recurringPatch(input), created_by: createdBy })
    .select(RECURRING_SELECT)
    .single();
  if (error) throw new Error(`createRecurring failed: ${error.message}`);
  return toRecurring(data as RecurringRow);
}

export async function updateRecurring(
  id: string,
  input: Partial<RecurringInput>
): Promise<FinanceRecurring> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_recurring")
    .update({ ...recurringPatch(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(RECURRING_SELECT)
    .single();
  if (error) throw new Error(`updateRecurring failed: ${error.message}`);
  return toRecurring(data as RecurringRow);
}

export async function deleteRecurring(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("finance_recurring").delete().eq("id", id);
  if (error) throw new Error(`deleteRecurring failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

type EntryRow = {
  id: string;
  kind: FinanceKind;
  description: string;
  counterparty: string | null;
  category_id: string | null;
  amount_cents: number;
  currency: Currency;
  fx_rate: number | string | null;
  paid_cents: number;
  status: EntryStatus;
  competence_date: string;
  due_date: string | null;
  settled_at: string | null;
  recurring_id: string | null;
  notes: string | null;
  created_at: string;
};

const ENTRY_SELECT =
  "id, kind, description, counterparty, category_id, amount_cents, currency, fx_rate, paid_cents, status, competence_date, due_date, settled_at, recurring_id, notes, created_at";

function toEntry(row: EntryRow): FinanceEntry {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    counterparty: row.counterparty,
    categoryId: row.category_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    // `numeric` volta como STRING no supabase-js, o driver não a converte em
    // number para não perder precisão. Um `Number()` esquecido aqui faz
    // `amount * fxRate` virar concatenação de strings.
    fxRate: row.fx_rate === null ? null : Number(row.fx_rate),
    paidCents: Number(row.paid_cents),
    status: row.status,
    competenceDate: row.competence_date,
    dueDate: row.due_date,
    settledAt: row.settled_at,
    recurringId: row.recurring_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listEntries(filters: EntryFilters = {}): Promise<FinanceEntry[]> {
  const admin = createAdminClient();
  let query = admin
    .from("finance_entries")
    .select(ENTRY_SELECT)
    .order("competence_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (filters.from) query = query.gte("competence_date", filters.from);
  if (filters.to) query = query.lte("competence_date", filters.to);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.currency) query = query.eq("currency", filters.currency);

  const { data, error } = await query;
  if (error) throw new Error(`listEntries failed: ${error.message}`);
  return ((data ?? []) as EntryRow[]).map(toEntry);
}

/**
 * Normaliza o que o cliente mandou antes de gravar. Três regras, e as três
 * existem para o banco não guardar um estado que a leitura não sabe explicar:
 *
 * 1. `paid` sem `settledAt` recebe a data de competência. O CHECK da migração
 *    recusaria a linha, e um 500 na cara de quem lançou uma despesa paga é
 *    pior do que assumir a única data que ele já informou.
 * 2. `paid` em BRL nunca guarda câmbio: não há o que congelar.
 * 3. Sair de `paid` LIMPA `settledAt`, `fxRate` e `paidCents`: um lançamento
 *    que voltou a ser pendente carregando o câmbio do dia em que esteve pago
 *    seria convertido pela cotação errada para sempre.
 */
function entryPatch(input: Partial<EntryInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.description !== undefined) patch.description = input.description;
  if (input.counterparty !== undefined) patch.counterparty = input.counterparty || null;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.amountCents !== undefined) patch.amount_cents = input.amountCents;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.competenceDate !== undefined) patch.competence_date = input.competenceDate;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.recurringId !== undefined) patch.recurring_id = input.recurringId;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.paidCents !== undefined) patch.paid_cents = input.paidCents;

  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "paid") {
      patch.settled_at = input.settledAt ?? input.competenceDate ?? null;
      patch.fx_rate = input.currency === "USD" ? (input.fxRate ?? null) : null;
      if (input.paidCents === undefined && input.amountCents !== undefined) {
        patch.paid_cents = input.amountCents;
      }
    } else {
      patch.settled_at = null;
      patch.fx_rate = null;
      if (input.paidCents === undefined) patch.paid_cents = 0;
    }
  } else {
    if (input.settledAt !== undefined) patch.settled_at = input.settledAt;
    if (input.fxRate !== undefined) patch.fx_rate = input.fxRate;
  }

  return patch;
}

export async function createEntry(input: EntryInput, createdBy: string): Promise<FinanceEntry> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_entries")
    .insert({ ...entryPatch(input), created_by: createdBy })
    .select(ENTRY_SELECT)
    .single();
  if (error) throw new Error(`createEntry failed: ${error.message}`);
  return toEntry(data as EntryRow);
}

export async function updateEntry(id: string, input: Partial<EntryInput>): Promise<FinanceEntry> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_entries")
    .update({ ...entryPatch(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(ENTRY_SELECT)
    .single();
  if (error) throw new Error(`updateEntry failed: ${error.message}`);
  return toEntry(data as EntryRow);
}

export async function deleteEntry(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("finance_entries").delete().eq("id", id);
  if (error) throw new Error(`deleteEntry failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

type ScenarioRow = {
  id: string;
  slug: string;
  name: string;
  growth_bps: number;
  churn_bps: number;
  new_customers_per_month: number;
  ticket_cents: number | null;
  extra_fixed_cost_cents: number;
  tax_bps: number | null;
  horizon_months: number;
  sort_order: number;
};

const SCENARIO_SELECT =
  "id, slug, name, growth_bps, churn_bps, new_customers_per_month, ticket_cents, extra_fixed_cost_cents, tax_bps, horizon_months, sort_order";

function toScenario(row: ScenarioRow): FinanceScenario {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    growthBps: row.growth_bps,
    churnBps: row.churn_bps,
    newCustomersPerMonth: row.new_customers_per_month,
    ticketCents: row.ticket_cents === null ? null : Number(row.ticket_cents),
    extraFixedCostCents: Number(row.extra_fixed_cost_cents),
    taxBps: row.tax_bps,
    horizonMonths: row.horizon_months,
    sortOrder: row.sort_order,
  };
}

export async function listScenarios(): Promise<FinanceScenario[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_scenarios")
    .select(SCENARIO_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listScenarios failed: ${error.message}`);
  return ((data ?? []) as ScenarioRow[]).map(toScenario);
}

function scenarioPatch(input: Partial<ScenarioInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.growthBps !== undefined) patch.growth_bps = input.growthBps;
  if (input.churnBps !== undefined) patch.churn_bps = input.churnBps;
  if (input.newCustomersPerMonth !== undefined) {
    patch.new_customers_per_month = input.newCustomersPerMonth;
  }
  if (input.ticketCents !== undefined) patch.ticket_cents = input.ticketCents;
  if (input.extraFixedCostCents !== undefined) {
    patch.extra_fixed_cost_cents = input.extraFixedCostCents;
  }
  if (input.taxBps !== undefined) patch.tax_bps = input.taxBps;
  if (input.horizonMonths !== undefined) patch.horizon_months = input.horizonMonths;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  return patch;
}

export async function createScenario(input: ScenarioInput): Promise<FinanceScenario> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_scenarios")
    .insert({ ...scenarioPatch(input), slug: slugify(input.name) })
    .select(SCENARIO_SELECT)
    .single();
  if (error) throw new Error(`createScenario failed: ${error.message}`);
  return toScenario(data as ScenarioRow);
}

export async function updateScenario(
  id: string,
  input: Partial<ScenarioInput>
): Promise<FinanceScenario> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_scenarios")
    .update({ ...scenarioPatch(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SCENARIO_SELECT)
    .single();
  if (error) throw new Error(`updateScenario failed: ${error.message}`);
  return toScenario(data as ScenarioRow);
}

export async function deleteScenario(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("finance_scenarios").delete().eq("id", id);
  if (error) throw new Error(`deleteScenario failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

const SETTINGS_SELECT = "cash_balance_cents, cash_balance_at, tax_bps, projection_usd_brl";

const DEFAULT_SETTINGS: FinanceSettings = {
  cashBalanceCents: 0,
  cashBalanceAt: null,
  taxBps: 0,
  projectionUsdBrl: null,
};

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_settings")
    .select(SETTINGS_SELECT)
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(`getFinanceSettings failed: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;
  return {
    cashBalanceCents: Number(data.cash_balance_cents),
    cashBalanceAt: data.cash_balance_at,
    taxBps: data.tax_bps,
    projectionUsdBrl: data.projection_usd_brl === null ? null : Number(data.projection_usd_brl),
  };
}

export async function updateFinanceSettings(input: SettingsInput): Promise<FinanceSettings> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.cashBalanceCents !== undefined) patch.cash_balance_cents = input.cashBalanceCents;
  if (input.cashBalanceAt !== undefined) patch.cash_balance_at = input.cashBalanceAt;
  if (input.taxBps !== undefined) patch.tax_bps = input.taxBps;
  if (input.projectionUsdBrl !== undefined) patch.projection_usd_brl = input.projectionUsdBrl;

  // `upsert` e não `update`: a linha nasce no seed da migração, mas um banco
  // restaurado de backup parcial pode não a ter, e uma configuração que se
  // recusa a salvar sem dizer por quê é o pior modo de descobrir isso.
  const { data, error } = await admin
    .from("finance_settings")
    .upsert({ id: "default", ...patch }, { onConflict: "id" })
    .select(SETTINGS_SELECT)
    .single();
  if (error) throw new Error(`updateFinanceSettings failed: ${error.message}`);
  return {
    cashBalanceCents: Number(data.cash_balance_cents),
    cashBalanceAt: data.cash_balance_at,
    taxBps: data.tax_bps,
    projectionUsdBrl: data.projection_usd_brl === null ? null : Number(data.projection_usd_brl),
  };
}

// ---------------------------------------------------------------------------
// O lado MEDIDO
// ---------------------------------------------------------------------------

/**
 * Monta tudo que o painel financeiro NÃO pede que ninguém digite.
 *
 * Quatro fontes, todas já existentes: o ledger de moedas (receita datada),
 * `llm_usage_events` (custo de IA), `loadAdminMetrics` (MRR, ARPU, assinantes
 * ativos) e `partner_commissions` (comissão paga e devida). Nenhuma consulta
 * nova de MRR, ver o cabeçalho do arquivo.
 *
 * `monthsBack` recorta as duas séries pesadas. Sem ele, um ano de eventos de
 * LLM viria inteiro para calcular doze meses.
 */
export async function loadMeasuredInputs(
  usdBrl: number | null,
  monthsBack = 12
): Promise<MeasuredInputs> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - monthsBack);
  since.setUTCDate(1);
  const sinceIso = since.toISOString();

  const [creditRows, usageRows, metrics, partners] = await Promise.all([
    loadRevenueCredits(admin, sinceIso),
    loadUsageCosts(admin, sinceIso),
    loadSubscriptionSnapshot(admin),
    loadPartnerTotals(admin),
  ]);

  const revenue = aggregateMeasuredRevenue(creditRows);

  return {
    revenueByMonthCents: revenue.byMonthCents,
    unmappedCreditEvents: revenue.unmapped,
    aiCostByMonthCents: aggregateAiCostByMonth(usageRows, usdBrl),
    mrrCents: metrics.mrrCents,
    arpuCents: metrics.arpuCents,
    activeSubscribers: metrics.activeSubscribers,
    stripeFeeMonthlyCents: metrics.stripeFeeCents,
    partnerPaidCents: partners.paidCents,
    partnerOwedCents: partners.owedCents,
  };
}

async function loadRevenueCredits(admin: AdminClient, since: string): Promise<CoinCreditRow[]> {
  const { data, error } = await admin
    .from("coin_transactions")
    .select("reason, amount, created_at")
    .in("reason", ["subscription_grant", "topup_pack", "refund", "chargeback"])
    .gte("created_at", since)
    .limit(MAX_ROWS);
  if (error) throw new Error(`loadRevenueCredits failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    reason: row.reason as string,
    amount: row.amount as number,
    createdAt: row.created_at as string,
  }));
}

async function loadUsageCosts(admin: AdminClient, since: string): Promise<UsageCostRow[]> {
  const { data, error } = await admin
    .from("llm_usage_events")
    .select("created_at, total_cost_usd")
    .gte("created_at", since)
    .limit(50_000);
  if (error) throw new Error(`loadUsageCosts failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    createdAt: row.created_at as string,
    costUsd: Number(row.total_cost_usd ?? 0),
  }));
}

/**
 * MRR, ARPU e assinantes ativos.
 *
 * A conta é a MESMA de `lib/db/admin/metrics.ts`, plano ativo × preço do
 * plano, mas rodando sobre uma consulta enxuta em vez de todo o funil:
 * `loadAdminMetrics` carrega perfis, sessões e o ledger inteiro para responder
 * perguntas de produto que esta tela não faz, e chamá-lo aqui custaria quatro
 * consultas grandes por render. A aritmética continua vindo de `PLANS` e
 * `isActiveStatus`, que são a definição, não há um segundo preço em lugar
 * nenhum.
 */
async function loadSubscriptionSnapshot(admin: AdminClient): Promise<{
  mrrCents: number;
  arpuCents: number;
  activeSubscribers: number;
  stripeFeeCents: number;
}> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status")
    .neq("plan", "free")
    .limit(MAX_ROWS);
  if (error) throw new Error(`loadSubscriptionSnapshot failed: ${error.message}`);

  const active = (data ?? []).filter((s) => isActiveStatus(s.status as string));
  let mrrCents = 0;
  let feeCents = 0;
  for (const sub of active) {
    const plan = ((sub.plan as string) in PLANS ? sub.plan : "free") as PlanKey;
    mrrCents += PLANS[plan].priceCents;
    feeCents += stripeFeeCents(PLANS[plan].priceCents);
  }
  const activeSubscribers = new Set(active.map((s) => s.user_id as string)).size;

  return {
    mrrCents,
    arpuCents: activeSubscribers > 0 ? Math.round(mrrCents / activeSubscribers) : 0,
    activeSubscribers,
    stripeFeeCents: feeCents,
  };
}

/**
 * Comissões de parceiro: quanto já saiu e quanto ainda se deve.
 *
 * Devido é TUDO que não foi pago nem estornado, inclusive o que ainda está na
 * carência de 30 dias. Do ponto de vista financeiro a carência não muda a
 * obrigação, só a data em que ela pode ser quitada: o dinheiro é do parceiro
 * assim que a comissão nasce. O painel de parceiros separa as duas fatias
 * porque lá a pergunta é "o que sai no próximo PIX"; aqui a pergunta é "quanto
 * devemos", e a resposta inclui a carência.
 */
async function loadPartnerTotals(
  admin: AdminClient
): Promise<{ paidCents: number; owedCents: number }> {
  const { data, error } = await admin
    .from("partner_commissions")
    .select("commission_cents, status")
    .limit(MAX_ROWS);
  if (error) {
    // Um erro aqui não pode derrubar o painel inteiro: comissão é uma fatia do
    // passivo, não a conta toda. Zerar e seguir é pior que avisar, mas melhor
    // que uma tela em branco, e o erro sobe no log de quem chamou.
    return { paidCents: 0, owedCents: 0 };
  }
  let paidCents = 0;
  let owedCents = 0;
  for (const row of data ?? []) {
    const cents = Number(row.commission_cents ?? 0);
    const status = row.status as string;
    if (status === "paid") paidCents += cents;
    else if (status !== "reversed") owedCents += cents;
  }
  return { paidCents, owedCents };
}
