import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinanceCategory, FinanceEntry, FinanceRecurring } from "@/lib/domain/finance";
import { buildFinanceOverview, type FinanceInputs, type MeasuredInputs } from "./aggregate";

const CATEGORIES: FinanceCategory[] = [
  {
    id: "cat-infra",
    slug: "infraestrutura",
    name: "Infraestrutura",
    kind: "expense",
    nature: "fixed",
    sortOrder: 10,
    archivedAt: null,
  },
  {
    id: "cat-mkt",
    slug: "marketing",
    name: "Marketing",
    kind: "expense",
    nature: "variable",
    sortOrder: 20,
    archivedAt: null,
  },
];

function entry(patch: Partial<FinanceEntry> = {}): FinanceEntry {
  return {
    id: crypto.randomUUID(),
    kind: "expense",
    description: "lançamento",
    counterparty: null,
    categoryId: "cat-infra",
    amountCents: 10_000,
    currency: "BRL",
    fxRate: null,
    paidCents: 0,
    status: "pending",
    competenceDate: "2026-09-01",
    dueDate: null,
    settledAt: null,
    recurringId: null,
    notes: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

function recurring(patch: Partial<FinanceRecurring> = {}): FinanceRecurring {
  return {
    id: crypto.randomUUID(),
    kind: "expense",
    description: "Vercel",
    counterparty: "Vercel",
    categoryId: "cat-infra",
    amountCents: 20_000,
    currency: "BRL",
    cadence: "monthly",
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

const NO_MEASUREMENT: MeasuredInputs = {
  revenueByMonthCents: {},
  unmappedCreditEvents: 0,
  aiCostByMonthCents: {},
  mrrCents: 0,
  arpuCents: 0,
  activeSubscribers: 0,
  stripeFeeMonthlyCents: 0,
  partnerPaidCents: 0,
  partnerOwedCents: 0,
};

function build(patch: Partial<FinanceInputs> = {}) {
  return buildFinanceOverview({
    entries: [],
    recurring: [],
    categories: CATEGORIES,
    measured: NO_MEASUREMENT,
    fx: { usdBrl: 5 },
    taxBps: 0,
    cashBalanceCents: 0,
    today: "2026-09-09",
    monthsBack: 3,
    ...patch,
  });
}

describe("série mensal", () => {
  it("cobre monthsBack + 1 meses e termina no mês de hoje", () => {
    const overview = build();
    assert.equal(overview.months.length, 4);
    assert.equal(overview.months[0].month, "2026-06");
    assert.equal(overview.current.month, "2026-09");
    assert.equal(overview.previous?.month, "2026-08");
  });
});

describe("regime de competência × regime de caixa", () => {
  it("a anual entra rateada na competência e inteira no caixa do mês da cobrança", () => {
    // R$ 1.200/ano começando em março: R$ 100/mês de provisão em todos os
    // meses, e R$ 1.200 de saída de caixa só em março.
    const overview = build({
      recurring: [recurring({ cadence: "annual", amountCents: 120_000, startDate: "2026-03-05" })],
      today: "2026-03-20",
      monthsBack: 1,
    });
    const march = overview.months.find((m) => m.month === "2026-03")!;
    const february = overview.months.find((m) => m.month === "2026-02")!;

    assert.equal(march.expenseProvisionedCents, 10_000);
    assert.equal(march.cashOutCents, 120_000);
    // Fevereiro é anterior ao início: nem provisão nem caixa.
    assert.equal(february.expenseProvisionedCents, 0);
    assert.equal(february.cashOutCents, 0);
  });

  it("um lançamento pago em mês diferente da competência aparece nos dois eixos certos", () => {
    const overview = build({
      entries: [
        entry({
          kind: "expense",
          amountCents: 30_000,
          status: "paid",
          competenceDate: "2026-08-31",
          settledAt: "2026-09-03",
        }),
      ],
    });
    const august = overview.months.find((m) => m.month === "2026-08")!;
    const september = overview.months.find((m) => m.month === "2026-09")!;

    assert.equal(august.expenseManualCents, 30_000);
    assert.equal(august.cashOutCents, 0);
    assert.equal(september.expenseManualCents, 0);
    assert.equal(september.cashOutCents, 30_000);
  });
});

describe("dupla contagem de recorrência", () => {
  it("a fatura real SUBSTITUI a provisão no mês dela", () => {
    const vercel = recurring({ amountCents: 20_000 });
    const overview = build({
      recurring: [vercel],
      entries: [
        entry({
          amountCents: 21_300, // a fatura veio mais cara que o contrato
          status: "paid",
          competenceDate: "2026-09-01",
          settledAt: "2026-09-05",
          recurringId: vercel.id,
        }),
      ],
    });
    const september = overview.current;
    const august = overview.months.find((m) => m.month === "2026-08")!;

    // Setembro: só a fatura real, sem a provisão de R$ 200 por cima.
    assert.equal(september.expenseProvisionedCents, 0);
    assert.equal(september.expenseManualCents, 21_300);
    assert.equal(september.expenseCents, 21_300);
    // Agosto: sem fatura lançada, a provisão do contrato vale.
    assert.equal(august.expenseProvisionedCents, 20_000);
  });
});

describe("realizado × previsto", () => {
  it("`planned` fica FORA dos totais e numa linha própria", () => {
    const overview = build({
      entries: [
        entry({ status: "planned", amountCents: 50_000, competenceDate: "2026-09-10" }),
        entry({ status: "pending", amountCents: 10_000, competenceDate: "2026-09-10" }),
      ],
    });
    assert.equal(overview.current.expenseManualCents, 10_000);
    assert.equal(overview.current.plannedExpenseCents, 50_000);
    assert.equal(overview.current.expenseCents, 10_000);
  });
});

describe("fixo × variável", () => {
  it("classifica pela categoria e trata sem categoria como variável", () => {
    const overview = build({
      entries: [
        entry({ categoryId: "cat-infra", amountCents: 10_000, competenceDate: "2026-09-01" }),
        entry({ categoryId: "cat-mkt", amountCents: 5_000, competenceDate: "2026-09-01" }),
        entry({ categoryId: null, amountCents: 3_000, competenceDate: "2026-09-01" }),
      ],
    });
    assert.equal(overview.current.fixedCents, 10_000);
    assert.equal(overview.current.variableCents, 8_000);
  });

  it("custo medido (IA e taxa) é sempre variável", () => {
    const overview = build({
      measured: {
        ...NO_MEASUREMENT,
        aiCostByMonthCents: { "2026-09": 40_000 },
      },
    });
    assert.equal(overview.current.variableCents, 40_000);
    assert.equal(overview.current.fixedCents, 0);
  });
});

describe("compromissos", () => {
  it("soma o RESTANTE, não o valor cheio", () => {
    const overview = build({
      entries: [entry({ status: "pending", amountCents: 100_000, paidCents: 40_000 })],
    });
    assert.equal(overview.commitments.payableCents, 60_000);
  });

  it("separa vencido de vencendo em 30 dias", () => {
    const overview = build({
      entries: [
        entry({ status: "pending", amountCents: 10_000, dueDate: "2026-09-01" }), // venceu
        entry({ status: "pending", amountCents: 20_000, dueDate: "2026-09-20" }), // 30 dias
        entry({ status: "pending", amountCents: 30_000, dueDate: "2026-12-01" }), // longe
      ],
    });
    assert.equal(overview.commitments.payableCents, 60_000);
    assert.equal(overview.commitments.overdueCents, 10_000);
    assert.equal(overview.commitments.dueNext30Cents, 20_000);
  });

  it("receita pendente vira a receber, não a pagar", () => {
    const overview = build({
      entries: [entry({ kind: "revenue", status: "pending", amountCents: 70_000 })],
    });
    assert.equal(overview.commitments.receivableCents, 70_000);
    assert.equal(overview.commitments.payableCents, 0);
  });

  it("inclui a comissão de parceiro devida, que é medida", () => {
    const overview = build({
      measured: { ...NO_MEASUREMENT, partnerOwedCents: 12_345 },
    });
    assert.equal(overview.commitments.partnerOwedCents, 12_345);
    assert.equal(overview.commitments.payableCents, 12_345);
  });
});

describe("moeda sem cotação", () => {
  it("não soma zero: conta o inconvertível e avisa", () => {
    const overview = build({
      fx: { usdBrl: null },
      entries: [entry({ currency: "USD", amountCents: 50_000, competenceDate: "2026-09-01" })],
    });
    assert.equal(overview.current.expenseManualCents, 0);
    assert.ok(overview.current.unconvertible > 0);
    assert.ok(overview.warnings.some((w) => w.includes("cotação do dólar")));
  });
});

describe("resultado e imposto", () => {
  it("lucro bruto ignora imposto; líquido o desconta", () => {
    const overview = build({
      taxBps: 1_000, // 10%
      measured: { ...NO_MEASUREMENT, revenueByMonthCents: { "2026-09": 100_000 } },
      entries: [entry({ amountCents: 30_000, competenceDate: "2026-09-01" })],
    });
    assert.equal(overview.current.revenueCents, 100_000);
    assert.equal(overview.current.expenseCents, 30_000);
    assert.equal(overview.current.grossProfitCents, 70_000);
    assert.equal(overview.current.taxCents, 10_000);
    assert.equal(overview.current.netProfitCents, 60_000);
    // Margem considera o imposto: (100.000 − 40.000) / 100.000.
    assert.equal(overview.current.marginRatio, 0.6);
  });

  it("margem é null sem receita, nunca Infinity", () => {
    const overview = build({ entries: [entry({ amountCents: 30_000 })] });
    assert.equal(overview.current.marginRatio, null);
  });
});

describe("burn rate e runway", () => {
  it("ignora o mês corrente, que está sempre incompleto", () => {
    const overview = build({
      monthsBack: 3,
      cashBalanceCents: 300_000,
      recurring: [recurring({ amountCents: 10_000 })], // R$ 100/mês de custo fixo
    });
    // Três meses fechados queimando R$ 100 cada.
    assert.equal(overview.indicators.burnRateCents, 10_000);
    assert.equal(overview.indicators.runwayMonths, 30);
  });

  it("sem queima não há runway", () => {
    const overview = build({
      monthsBack: 3,
      cashBalanceCents: 300_000,
      measured: {
        ...NO_MEASUREMENT,
        revenueByMonthCents: { "2026-06": 100_000, "2026-07": 100_000, "2026-08": 100_000 },
      },
    });
    assert.ok(overview.indicators.burnRateCents < 0);
    assert.equal(overview.indicators.runwayMonths, null);
  });
});

describe("avisos", () => {
  it("acusa receita lançada à mão sobre mês que já tem receita medida", () => {
    const overview = build({
      measured: { ...NO_MEASUREMENT, revenueByMonthCents: { "2026-09": 500_000 } },
      entries: [
        entry({ kind: "revenue", status: "paid", settledAt: "2026-09-05", amountCents: 500_000 }),
      ],
    });
    assert.ok(overview.warnings.some((w) => w.includes("duas vezes")));
  });

  it("acusa MRR sem nenhum crédito no ledger, a contradição mais visível da tela", () => {
    const overview = build({
      measured: { ...NO_MEASUREMENT, mrrCents: 10_970, activeSubscribers: 3 },
    });
    assert.ok(overview.warnings.some((w) => w.includes("checkout do Stripe")));
  });

  it("não acusa quando há crédito medido em algum mês", () => {
    const overview = build({
      measured: {
        ...NO_MEASUREMENT,
        mrrCents: 10_970,
        activeSubscribers: 3,
        revenueByMonthCents: { "2026-08": 10_970 },
      },
    });
    assert.ok(!overview.warnings.some((w) => w.includes("checkout do Stripe")));
  });

  it("acusa crédito do ledger que não casou com o catálogo", () => {
    const overview = build({
      measured: { ...NO_MEASUREMENT, unmappedCreditEvents: 3 },
    });
    assert.ok(overview.warnings.some((w) => w.includes("catálogo")));
  });
});

describe("resumo de recorrentes", () => {
  it("soma o equivalente mensal só das DESPESAS ativas", () => {
    const overview = build({
      recurring: [
        recurring({ amountCents: 20_000, cadence: "monthly" }),
        recurring({ amountCents: 120_000, cadence: "annual", categoryId: "cat-infra" }),
        recurring({ amountCents: 99_000, status: "cancelled" }),
        recurring({ kind: "revenue", amountCents: 50_000 }),
      ],
    });
    // 200 + 100 = R$ 300/mês.
    assert.equal(overview.recurring.monthlyCents, 30_000);
    assert.equal(overview.recurring.annualCents, 360_000);
    assert.equal(overview.recurring.fixedMonthlyCents, 30_000);
    assert.equal(overview.recurring.activeCount, 3);
    assert.equal(overview.recurring.cancelledCount, 1);
  });
});
