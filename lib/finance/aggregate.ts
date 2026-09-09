/**
 * A conta do painel financeiro — CLIENT-SAFE, pura e a ÚNICA implementação.
 *
 * Recebe o que já foi lido do banco e devolve tudo que as telas mostram. Não
 * abre consulta, não formata, não sabe o que é React. É o que permite testar
 * cada número com um `node --test` e sem banco (`lib/finance/*.test.ts`), e é
 * o que impede uma segunda definição de "lucro" nascer dentro de um `.tsx` —
 * o mesmo princípio que `lib/db/admin/metrics.ts` estabeleceu para as métricas
 * de produto.
 *
 * ============================================================================
 * OS DOIS REGIMES, e por que o painel mostra os dois
 * ============================================================================
 *
 * COMPETÊNCIA (`accrual`) responde "quanto o Scriba custa e rende por mês".
 *   Cada valor pertence ao mês que ele descreve, não ao mês em que o dinheiro
 *   se moveu. Um domínio de R$ 80/ano entra como R$ 6,67 em cada um dos doze
 *   meses. É a régua para comparar meses entre si e a base das projeções.
 *
 * CAIXA (`cash`) responde "quanto entrou e saiu da conta".
 *   O mesmo domínio sai inteiro em março e não sai mais nada nos outros onze.
 *   É a régua para saber se o dinheiro dá, e é a base de burn rate e runway.
 *
 * Somar os dois produz um número que não é nenhum dos dois. Por isso eles são
 * campos separados, com nomes diferentes, e nenhuma função aqui devolve um
 * "total de despesas" sem dizer de qual regime ele é.
 *
 * ============================================================================
 * MEDIDO × MANUAL, e por que nada é digitado duas vezes
 * ============================================================================
 *
 * Metade do dinheiro do Scriba já está medida no banco e NÃO é lançada à mão:
 *
 *   receita  → créditos de `coin_transactions` (`subscription_grant`,
 *              `topup_pack`), convertidos a BRL pelo catálogo de planos.
 *              É a única fonte com DATA de cada fatura paga.
 *   custo IA → `llm_usage_events` × `lib/llm/pricing.ts` × câmbio. O maior
 *              custo variável do produto, medido por chamada.
 *   parceiros→ `partner_commissions` / `partner_payouts`.
 *
 * O que se lança à mão é só o que ninguém mede por nós. As duas metades ficam
 * em campos separados (`...MeasuredCents` × `...ManualCents`) porque a tela
 * precisa dizer qual é qual: um número medido se corrige mexendo no código; um
 * número digitado se corrige mexendo no lançamento.
 *
 * A CONSEQUÊNCIA PRÁTICA, e ela é a armadilha desta área: lançar "assinaturas
 * de setembro, R$ 5.000" à mão CONTA DUAS VEZES, porque a receita medida já
 * está lá. O `warnings` devolvido por `buildFinanceOverview` acusa isso.
 *
 * ============================================================================
 * DUPLA CONTAGEM DE RECORRÊNCIA
 * ============================================================================
 *
 * Uma recorrência é um CONTRATO e um lançamento é um FATO. No regime de
 * competência entram as recorrências (provisionadas) e os lançamentos que NÃO
 * vieram de recorrência; um lançamento com `recurringId` é a fatura real
 * daquele contrato e substitui a provisão no mês dele. Sem essa regra, o mês
 * em que a fatura da Vercel foi registrada apareceria com o custo dobrado.
 */

import type {
  CostNature,
  FinanceCategory,
  FinanceEntry,
  FinanceRecurring,
} from "@/lib/domain/finance";
import {
  applyBps,
  entryAmountBrlCents,
  entryRemainingBrlCents,
  type FxContext,
  growthRatio,
  marginRatio,
  toBrlCents,
} from "./money";
import {
  addMonthsToKey,
  annualEquivalentCents,
  hasChargeInMonth,
  isActiveInMonth,
  monthKey,
  monthlyEquivalentCents,
  monthRange,
  nextChargeDate,
} from "./recurrence";

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/** O que o banco já mede sozinho. Nada aqui é digitado por gente. */
export type MeasuredInputs = {
  /** Receita por mês (`YYYY-MM` → centavos de BRL), dos créditos do ledger. */
  revenueByMonthCents: Record<string, number>;
  /** Créditos que não casaram com nenhum item do catálogo — receita perdida
   * do total. Contados para a tela poder avisar em vez de mentir por omissão. */
  unmappedCreditEvents: number;
  /** Custo de IA por mês, em centavos de BRL. */
  aiCostByMonthCents: Record<string, number>;
  /** MRR de hoje e o retrato das assinaturas. Vem de `loadAdminMetrics`. */
  mrrCents: number;
  arpuCents: number;
  activeSubscribers: number;
  /** Taxa do Stripe estimada sobre um mês de MRR. */
  stripeFeeMonthlyCents: number;
  /** Comissões de parceiro já pagas (caixa) e ainda devidas (compromisso). */
  partnerPaidCents: number;
  partnerOwedCents: number;
};

export type FinanceInputs = {
  entries: FinanceEntry[];
  recurring: FinanceRecurring[];
  categories: FinanceCategory[];
  measured: MeasuredInputs;
  fx: FxContext;
  /** Alíquota efetiva sobre a receita, em basis points. */
  taxBps: number;
  cashBalanceCents: number;
  /** `YYYY-MM-DD`. Parâmetro e não `new Date()` para o teste poder fixá-lo. */
  today: string;
  /** Quantos meses para trás a série cobre. 12 é o padrão das telas. */
  monthsBack?: number;
};

// ---------------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------------

export type MonthlyRow = {
  month: string;

  /** Regime de competência: a que mês o valor PERTENCE. */
  revenueCents: number;
  revenueMeasuredCents: number;
  revenueManualCents: number;
  expenseCents: number;
  expenseMeasuredCents: number;
  expenseManualCents: number;
  expenseProvisionedCents: number;
  fixedCents: number;
  variableCents: number;
  taxCents: number;
  /** Receita − despesas, antes de imposto. */
  grossProfitCents: number;
  /** Depois do imposto estimado. */
  netProfitCents: number;
  marginRatio: number | null;

  /** Previsto: `planned`, o que ainda não foi firmado. Fora dos totais acima. */
  plannedRevenueCents: number;
  plannedExpenseCents: number;

  /** Regime de caixa: quando o dinheiro se moveu. */
  cashInCents: number;
  cashOutCents: number;
  cashNetCents: number;

  /** Lançamentos em dólar que ficaram de fora por falta de cotação. */
  unconvertible: number;
};

export type RecurringSummary = {
  id: string;
  monthlyEquivalentCents: number | null;
  annualEquivalentCents: number | null;
  nextChargeDate: string | null;
  categoryName: string | null;
  nature: CostNature;
};

export type FinanceOverview = {
  months: MonthlyRow[];
  current: MonthlyRow;
  previous: MonthlyRow | null;
  /** Soma dos últimos 12 meses fechados + o corrente, em competência. */
  trailing: { revenueCents: number; expenseCents: number; netProfitCents: number };
  recurring: {
    monthlyCents: number;
    annualCents: number;
    fixedMonthlyCents: number;
    variableMonthlyCents: number;
    activeCount: number;
    cancelledCount: number;
    unconvertible: number;
    items: RecurringSummary[];
  };
  commitments: {
    /** Despesas firmadas e não liquidadas — o que devemos. */
    payableCents: number;
    /** Vencidas: parte do acima cujo `dueDate` já passou. */
    overdueCents: number;
    /** Vence nos próximos 30 dias. */
    dueNext30Cents: number;
    /** Receitas firmadas e não recebidas. */
    receivableCents: number;
    /** Comissões de parceiro devidas — medidas, não lançadas. */
    partnerOwedCents: number;
    unconvertible: number;
  };
  indicators: {
    mrrCents: number;
    arpuCents: number;
    activeSubscribers: number;
    mrrGrowthRatio: number | null;
    /** Custo total do mês ÷ assinantes ativos. */
    costPerCustomerCents: number | null;
    /** Fatia do custo do mês que é IA. Decide onde vale otimizar. */
    aiCostShare: number | null;
    /**
     * Queima média dos últimos três meses fechados, em competência. Positivo =
     * queima; negativo = lucro. Três meses e não um: um mês com a cobrança
     * anual do domínio não descreve o ritmo.
     */
    burnRateCents: number;
    /** Meses de caixa ao ritmo atual. `null` quando não há queima. */
    runwayMonths: number | null;
    cashBalanceCents: number;
    marginRatio: number | null;
  };
  /** O que a tela precisa DIZER antes que alguém decida com base nos números. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Construção
// ---------------------------------------------------------------------------

const DEFAULT_MONTHS_BACK = 11;

export function buildFinanceOverview(input: FinanceInputs): FinanceOverview {
  const {
    entries,
    recurring,
    categories,
    measured,
    fx,
    taxBps,
    cashBalanceCents,
    today,
    monthsBack = DEFAULT_MONTHS_BACK,
  } = input;

  const currentKey = monthKey(today);
  const firstKey = addMonthsToKey(currentKey, -monthsBack);
  const keys = monthRange(firstKey, currentKey);

  const natureById = new Map<string, CostNature>();
  const nameById = new Map<string, string>();
  for (const c of categories) {
    natureById.set(c.id, c.nature);
    nameById.set(c.id, c.name);
  }
  /** Sem categoria, um custo é tratado como VARIÁVEL. É o palpite conservador:
   * inflar o custo fixo faria o runway parecer pior do que é sem motivo. */
  const natureOf = (categoryId: string | null): CostNature =>
    (categoryId && natureById.get(categoryId)) || "variable";

  const months = keys.map((key) =>
    buildMonth({
      key,
      entries,
      recurring,
      measured,
      fx,
      taxBps,
      natureOf,
    })
  );

  const current = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : null;

  const trailing = months.reduce(
    (acc, m) => ({
      revenueCents: acc.revenueCents + m.revenueCents,
      expenseCents: acc.expenseCents + m.expenseCents,
      netProfitCents: acc.netProfitCents + m.netProfitCents,
    }),
    { revenueCents: 0, expenseCents: 0, netProfitCents: 0 }
  );

  return {
    months,
    current,
    previous,
    trailing,
    recurring: summarizeRecurring(recurring, fx, today, natureOf, nameById),
    commitments: summarizeCommitments(entries, fx, today, measured.partnerOwedCents),
    indicators: buildIndicators({ months, current, previous, measured, cashBalanceCents }),
    warnings: buildWarnings({ entries, months, measured, fx }),
  };
}

// ---------------------------------------------------------------------------

type MonthArgs = {
  key: string;
  entries: FinanceEntry[];
  recurring: FinanceRecurring[];
  measured: MeasuredInputs;
  fx: FxContext;
  taxBps: number;
  natureOf: (categoryId: string | null) => CostNature;
};

function buildMonth({
  key,
  entries,
  recurring,
  measured,
  fx,
  taxBps,
  natureOf,
}: MonthArgs): MonthlyRow {
  let revenueManual = 0;
  let expenseManual = 0;
  let plannedRevenue = 0;
  let plannedExpense = 0;
  let fixed = 0;
  let variable = 0;
  let cashIn = 0;
  let cashOut = 0;
  let unconvertible = 0;

  /** Contratos cuja fatura REAL já foi lançada neste mês. Ver o cabeçalho. */
  const realizedRecurring = new Set<string>();

  for (const entry of entries) {
    const brl = entryAmountBrlCents(entry, fx);

    // Competência: `paid` e `pending` são firmes; `planned` fica de fora dos
    // totais e aparece numa linha própria (§14 — realizado × previsto).
    if (monthKey(entry.competenceDate) === key) {
      if (brl === null) {
        unconvertible += 1;
      } else if (entry.status === "planned") {
        if (entry.kind === "revenue") plannedRevenue += brl;
        else plannedExpense += brl;
      } else if (entry.kind === "revenue") {
        revenueManual += brl;
      } else {
        expenseManual += brl;
        if (natureOf(entry.categoryId) === "fixed") fixed += brl;
        else variable += brl;
        if (entry.recurringId) realizedRecurring.add(entry.recurringId);
      }
    }

    // Caixa: o mês em que o dinheiro se moveu, que pode não ser o da
    // competência. Só `paid` tem `settledAt` (CHECK na migração 0043).
    if (entry.status === "paid" && entry.settledAt && monthKey(entry.settledAt) === key) {
      if (brl === null) unconvertible += 1;
      else if (entry.kind === "revenue") cashIn += brl;
      else cashOut += brl;
    }
  }

  // Provisão das recorrências que ainda não têm fatura lançada neste mês.
  let provisioned = 0;
  for (const r of recurring) {
    if (r.kind !== "expense") continue;
    if (!isActiveInMonth(r, key)) continue;
    if (realizedRecurring.has(r.id)) continue;
    const monthlyNative = monthlyEquivalentCents(r.amountCents, r.cadence);
    const brl = toBrlCents(monthlyNative, r.currency, fx.usdBrl);
    if (brl === null) {
      unconvertible += 1;
      continue;
    }
    provisioned += brl;
    if (natureOf(r.categoryId) === "fixed") fixed += brl;
    else variable += brl;
    // Caixa: a cobrança inteira sai no mês da ocorrência, não rateada.
    if (hasChargeInMonth(r, key)) {
      const full = toBrlCents(r.amountCents, r.currency, fx.usdBrl);
      if (full !== null) cashOut += full;
    }
  }

  // Receitas recorrentes lançadas à mão (fora do Stripe) entram na competência
  // pelo equivalente mensal, pela mesma razão das despesas.
  for (const r of recurring) {
    if (r.kind !== "revenue") continue;
    if (!isActiveInMonth(r, key)) continue;
    if (realizedRecurring.has(r.id)) continue;
    const brl = toBrlCents(monthlyEquivalentCents(r.amountCents, r.cadence), r.currency, fx.usdBrl);
    if (brl === null) unconvertible += 1;
    else revenueManual += brl;
  }

  const revenueMeasured = measured.revenueByMonthCents[key] ?? 0;
  const aiCost = measured.aiCostByMonthCents[key] ?? 0;
  // Taxa do Stripe: proporcional à receita MEDIDA do mês, não ao MRR de hoje.
  // Ela incide sobre o que foi cobrado, e um mês antigo cobrou o que cobrou.
  const stripeFee =
    measured.mrrCents > 0
      ? Math.round((measured.stripeFeeMonthlyCents * revenueMeasured) / measured.mrrCents)
      : 0;
  const expenseMeasured = aiCost + stripeFee;

  const revenueCents = revenueMeasured + revenueManual;
  const expenseCents = expenseMeasured + expenseManual + provisioned;
  // IA e taxa são custo variável por definição — escalam com uso e com receita.
  variable += expenseMeasured;

  const grossProfitCents = revenueCents - expenseCents;
  const taxCents = applyBps(Math.max(0, revenueCents), taxBps);
  const netProfitCents = grossProfitCents - taxCents;

  return {
    month: key,
    revenueCents,
    revenueMeasuredCents: revenueMeasured,
    revenueManualCents: revenueManual,
    expenseCents,
    expenseMeasuredCents: expenseMeasured,
    expenseManualCents: expenseManual,
    expenseProvisionedCents: provisioned,
    fixedCents: fixed,
    variableCents: variable,
    taxCents,
    grossProfitCents,
    netProfitCents,
    marginRatio: marginRatio(revenueCents, expenseCents + taxCents),
    plannedRevenueCents: plannedRevenue,
    plannedExpenseCents: plannedExpense,
    cashInCents: cashIn + revenueMeasured,
    cashOutCents: cashOut + expenseMeasured,
    cashNetCents: cashIn + revenueMeasured - (cashOut + expenseMeasured),
    unconvertible,
  };
}

// ---------------------------------------------------------------------------

function summarizeRecurring(
  recurring: FinanceRecurring[],
  fx: FxContext,
  today: string,
  natureOf: (categoryId: string | null) => CostNature,
  nameById: Map<string, string>
): FinanceOverview["recurring"] {
  let monthlyCents = 0;
  let annualCents = 0;
  let fixedMonthlyCents = 0;
  let variableMonthlyCents = 0;
  let activeCount = 0;
  let cancelledCount = 0;
  let unconvertible = 0;
  const items: RecurringSummary[] = [];

  for (const r of recurring) {
    const nature = natureOf(r.categoryId);
    const monthlyNative = monthlyEquivalentCents(r.amountCents, r.cadence);
    const monthly = toBrlCents(monthlyNative, r.currency, fx.usdBrl);
    // O anual sai do valor ORIGINAL, não de `monthly * 12`: o rateio arredonda
    // uma vez por mês, e doze desses erram alguns centavos contra o contrato.
    const annual = toBrlCents(
      annualEquivalentCents(r.amountCents, r.cadence),
      r.currency,
      fx.usdBrl
    );

    items.push({
      id: r.id,
      monthlyEquivalentCents: monthly,
      annualEquivalentCents: annual,
      nextChargeDate: nextChargeDate(r, today),
      categoryName: r.categoryId ? (nameById.get(r.categoryId) ?? null) : null,
      nature,
    });

    if (r.status === "cancelled") {
      cancelledCount += 1;
      continue;
    }
    activeCount += 1;
    // Só DESPESA entra no "quanto o Scriba custa por mês". Uma receita
    // recorrente somada ali faria o custo cair quando a receita subisse.
    if (r.kind !== "expense") continue;
    if (monthly === null) {
      unconvertible += 1;
      continue;
    }
    monthlyCents += monthly;
    annualCents += annual ?? monthly * 12;
    if (nature === "fixed") fixedMonthlyCents += monthly;
    else variableMonthlyCents += monthly;
  }

  return {
    monthlyCents,
    annualCents,
    fixedMonthlyCents,
    variableMonthlyCents,
    activeCount,
    cancelledCount,
    unconvertible,
    items,
  };
}

// ---------------------------------------------------------------------------

function summarizeCommitments(
  entries: FinanceEntry[],
  fx: FxContext,
  today: string,
  partnerOwedCents: number
): FinanceOverview["commitments"] {
  let payableCents = 0;
  let overdueCents = 0;
  let dueNext30Cents = 0;
  let receivableCents = 0;
  let unconvertible = 0;

  const horizon = addDays(today, 30);

  for (const entry of entries) {
    if (entry.status === "paid") continue;
    // O que se deve é o RESTANTE, não o valor cheio: um pagamento parcial já
    // saiu do caixa e continuar cobrando-o na dívida infla o passivo.
    const remaining = entryRemainingBrlCents(entry, fx);
    if (remaining === null) {
      unconvertible += 1;
      continue;
    }
    if (remaining === 0) continue;

    if (entry.kind === "revenue") {
      receivableCents += remaining;
      continue;
    }
    payableCents += remaining;
    if (entry.dueDate) {
      if (entry.dueDate < today) overdueCents += remaining;
      else if (entry.dueDate <= horizon) dueNext30Cents += remaining;
    }
  }

  return {
    payableCents: payableCents + partnerOwedCents,
    overdueCents,
    dueNext30Cents,
    receivableCents,
    partnerOwedCents,
    unconvertible,
  };
}

/** Soma dias a uma data `YYYY-MM-DD`, em UTC. */
function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------

function buildIndicators({
  months,
  current,
  previous,
  measured,
  cashBalanceCents,
}: {
  months: MonthlyRow[];
  current: MonthlyRow;
  previous: MonthlyRow | null;
  measured: MeasuredInputs;
  cashBalanceCents: number;
}): FinanceOverview["indicators"] {
  // Burn dos três últimos meses FECHADOS. O corrente fica de fora: no dia 3 ele
  // tem três dias de custo e zero de fatura, e entraria como lucro recorde.
  const closed = months.slice(0, -1).slice(-3);
  const burnRateCents =
    closed.length > 0
      ? Math.round(closed.reduce((acc, m) => acc - m.netProfitCents, 0) / closed.length)
      : 0;

  const runwayMonths =
    burnRateCents > 0 && cashBalanceCents > 0
      ? Math.round((cashBalanceCents / burnRateCents) * 10) / 10
      : null;

  const aiCostShare =
    current.expenseCents > 0 ? current.expenseMeasuredCents / current.expenseCents : null;

  return {
    mrrCents: measured.mrrCents,
    arpuCents: measured.arpuCents,
    activeSubscribers: measured.activeSubscribers,
    mrrGrowthRatio: previous
      ? growthRatio(current.revenueMeasuredCents, previous.revenueMeasuredCents)
      : null,
    costPerCustomerCents:
      measured.activeSubscribers > 0
        ? Math.round(current.expenseCents / measured.activeSubscribers)
        : null,
    aiCostShare,
    burnRateCents,
    runwayMonths,
    cashBalanceCents,
    marginRatio: current.marginRatio,
  };
}

// ---------------------------------------------------------------------------

/**
 * Os avisos são parte do produto, não enfeite.
 *
 * Um painel financeiro erra em silêncio: o total continua sendo um número
 * plausível quando falta a cotação do dólar, quando alguém lançou a receita de
 * assinatura que o ledger já contava, ou quando nenhum custo recorrente foi
 * cadastrado. Nos três casos a tela precisa DIZER, porque o sintoma é sempre o
 * mesmo — uma conta boa demais, que é a que ninguém investiga.
 */
function buildWarnings({
  entries,
  months,
  measured,
  fx,
}: {
  entries: FinanceEntry[];
  months: MonthlyRow[];
  measured: MeasuredInputs;
  fx: FxContext;
}): string[] {
  const warnings: string[] = [];

  if (fx.usdBrl === null && entries.some((e) => e.currency === "USD")) {
    warnings.push(
      "Sem cotação do dólar: lançamentos em US$ ficaram de fora dos totais. Informe uma cotação manual em Uso & custos."
    );
  }

  const unconvertible = months.reduce((acc, m) => acc + m.unconvertible, 0);
  if (unconvertible > 0 && fx.usdBrl !== null) {
    warnings.push(`${unconvertible} valor(es) em moeda estrangeira não puderam ser convertidos.`);
  }

  if (measured.unmappedCreditEvents > 0) {
    warnings.push(
      `${measured.unmappedCreditEvents} crédito(s) do ledger não casaram com nenhum plano ou pacote do catálogo e ficaram fora da receita medida.`
    );
  }

  // MRR sem NENHUM crédito no ledger. É a contradição mais visível que este
  // painel consegue produzir sozinho: "MRR R$ 109,70" no card de indicadores e
  // "Receita do mês R$ 0,00" três centímetros acima. Acontece quando as
  // assinaturas não nasceram de um checkout do Stripe (base semeada à mão, ou
  // migrada) — o ledger é a única fonte com DATA, e sem ela não há histórico.
  if (measured.mrrCents > 0 && months.every((m) => m.revenueMeasuredCents === 0)) {
    warnings.push(
      "Há assinaturas ativas (MRR acima de zero) e nenhum crédito de assinatura no ledger do período: a receita medida aparece zerada. Verifique se essas assinaturas passaram pelo checkout do Stripe."
    );
  }

  const manualRevenueMonths = months.filter(
    (m) => m.revenueManualCents > 0 && m.revenueMeasuredCents > 0
  ).length;
  if (manualRevenueMonths > 0) {
    warnings.push(
      "Há receita lançada à mão em meses que já têm receita medida das assinaturas. Confira se ela não está sendo contada duas vezes."
    );
  }

  return warnings;
}
