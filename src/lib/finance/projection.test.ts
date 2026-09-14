import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  measuredPaymentFeeBps,
  measuredVariableCostPerCustomer,
  monthsToRecover,
  type ProjectionAssumptions,
  type ProjectionBasis,
  project,
} from "./projection";

const BASIS: ProjectionBasis = {
  customers: 100,
  arpuCents: 3_000, // R$ 30
  fixedCostCents: 200_000, // R$ 2.000
  variableCostPerCustomerCents: 0,
  paymentFeeBps: 0,
  taxBps: 0,
  cashBalanceCents: 0,
  startMonth: "2026-10",
};

const FLAT: ProjectionAssumptions = {
  growthBps: 0,
  churnBps: 0,
  newCustomersPerMonth: 0,
  ticketCents: null,
  extraFixedCostCents: 0,
  taxBps: null,
  horizonMonths: 12,
};

describe("modelo de clientes", () => {
  it("sem crescimento nem churn a base não se move", () => {
    const r = project(BASIS, FLAT);
    assert.equal(r.months[0].customers, 100);
    assert.equal(r.months[11].customers, 100);
  });

  it("crescimento e churn COMPÕEM, não se somam sobre a base inicial", () => {
    // 10% de crescimento com 5% de churn = 5% ao mês composto.
    const r = project(BASIS, { ...FLAT, growthBps: 1_000, churnBps: 500 });
    assert.equal(r.months[0].customers, 105);
    assert.equal(r.months[1].customers, 110); // 110,25
    // 100 × 1,05^12 = 179,58, e NÃO 100 + 12×5 = 160.
    assert.equal(r.months[11].customers, 180);
  });

  it("os novos absolutos entram depois do churn do mês", () => {
    const r = project(BASIS, { ...FLAT, churnBps: 1_000, newCustomersPerMonth: 10 });
    // 100 − 10% = 90, + 10 = 100.
    assert.equal(r.months[0].customers, 100);
  });

  it("a base nunca fica negativa", () => {
    const r = project({ ...BASIS, customers: 5 }, { ...FLAT, churnBps: 10_000 });
    assert.equal(r.months[0].customers, 0);
    assert.equal(r.months[5].customers, 0);
  });

  it("frações acumulam dentro do laço em vez de serem truncadas por mês", () => {
    // Com arredondamento a cada mês, 30 clientes a 5% travariam em 31 (30×1,05
    // = 31,5 → 31 → 32,55 → 32…). Sem truncar, 30 × 1,05^12 = 53,9.
    const r = project({ ...BASIS, customers: 30 }, { ...FLAT, growthBps: 500 });
    assert.equal(r.months[11].customers, 54);
  });
});

describe("resultado mensal", () => {
  it("compõe receita, taxa, variável, fixo e imposto", () => {
    const r = project(
      {
        ...BASIS,
        variableCostPerCustomerCents: 500, // R$ 5 por cliente
        paymentFeeBps: 500, // 5%
        taxBps: 1_000, // 10%
      },
      FLAT
    );
    const m = r.months[0];
    assert.equal(m.revenueCents, 300_000); // 100 × R$ 30
    assert.equal(m.paymentFeeCents, 15_000); // 5%
    assert.equal(m.variableCostCents, 50_000); // 100 × R$ 5
    assert.equal(m.fixedCostCents, 200_000);
    assert.equal(m.taxCents, 30_000); // 10%
    assert.equal(m.totalCostCents, 295_000);
    assert.equal(m.profitCents, 5_000);
  });

  it("o ticket do cenário sobrescreve o ARPU medido", () => {
    const r = project(BASIS, { ...FLAT, ticketCents: 5_000 });
    assert.equal(r.months[0].revenueCents, 500_000);
  });

  it("a alíquota do cenário sobrescreve a padrão", () => {
    const r = project({ ...BASIS, taxBps: 1_000 }, { ...FLAT, taxBps: 0 });
    assert.equal(r.months[0].taxCents, 0);
  });

  it("o fixo extra do cenário SOMA ao fixo medido", () => {
    const r = project(BASIS, { ...FLAT, extraFixedCostCents: 100_000 });
    assert.equal(r.months[0].fixedCostCents, 300_000);
  });
});

describe("meses e acumulado", () => {
  it("os meses são sequenciais a partir de startMonth", () => {
    const r = project(BASIS, { ...FLAT, horizonMonths: 4 });
    assert.deepEqual(
      r.months.map((m) => m.month),
      ["2026-10", "2026-11", "2026-12", "2027-01"]
    );
    assert.deepEqual(
      r.months.map((m) => m.index),
      [1, 2, 3, 4]
    );
  });

  it("o caixa projetado parte do saldo de hoje", () => {
    const r = project({ ...BASIS, cashBalanceCents: 500_000 }, FLAT);
    // 100 × R$ 30 − R$ 2.000 = R$ 1.000 de lucro por mês.
    assert.equal(r.months[0].profitCents, 100_000);
    assert.equal(r.months[0].cashCents, 600_000);
    assert.equal(r.months[2].cashCents, 800_000);
  });

  it("aponta o mês em que o caixa acaba", () => {
    const r = project(
      { ...BASIS, customers: 10, cashBalanceCents: 300_000 },
      { ...FLAT, horizonMonths: 6 }
    );
    // 10 × R$ 30 = R$ 300 contra R$ 2.000 de fixo: queima R$ 1.700/mês.
    assert.equal(r.months[0].profitCents, -170_000);
    assert.equal(r.cashOutMonth, "2026-11");
  });

  it("aponta o primeiro mês lucrativo", () => {
    const r = project({ ...BASIS, customers: 50 }, { ...FLAT, growthBps: 1_000 });
    // 50 clientes rendem R$ 1.500 contra R$ 2.000: precisa passar de ~67.
    assert.equal(r.breakEvenMonth, "2027-01");
  });

  it("nunca lucrativo devolve null", () => {
    const r = project({ ...BASIS, customers: 1 }, { ...FLAT, horizonMonths: 6 });
    assert.equal(r.breakEvenMonth, null);
  });
});

describe("comparação de cenários", () => {
  it("soma 6 e 12 meses para a tabela lado a lado", () => {
    const r = project(BASIS, FLAT);
    assert.equal(r.totals.revenue6mCents, 6 * 300_000);
    assert.equal(r.totals.revenue12mCents, 12 * 300_000);
    assert.equal(r.totals.profit12mCents, 12 * 100_000);
    assert.equal(r.totals.customersAtEnd, 100);
  });

  it("horizonte menor que 12 não inventa os meses que faltam", () => {
    const r = project(BASIS, { ...FLAT, horizonMonths: 3 });
    assert.equal(r.totals.revenue12mCents, 3 * 300_000);
  });
});

describe("monthsToRecover", () => {
  it("acha o mês em que o acumulado cobre o investimento", () => {
    const r = project(BASIS, FLAT); // R$ 1.000/mês de lucro
    assert.equal(monthsToRecover(r, 250_000), 3);
    assert.equal(monthsToRecover(r, 100_000), 1);
  });

  it("investimento zero se paga na hora", () => {
    assert.equal(monthsToRecover(project(BASIS, FLAT), 0), 0);
  });

  it("devolve null quando não cabe no horizonte, em vez de extrapolar", () => {
    const r = project(BASIS, { ...FLAT, horizonMonths: 6 });
    assert.equal(monthsToRecover(r, 5_000_000), null);
  });
});

describe("entradas medidas", () => {
  it("custo variável por cliente sai da divisão do custo medido", () => {
    assert.equal(measuredVariableCostPerCustomer(100_000, 40), 2_500);
  });

  it("sem assinante não inventa custo por cliente", () => {
    assert.equal(measuredVariableCostPerCustomer(100_000, 0), 0);
  });

  it("a taxa de pagamento vira percentual do MRR medido", () => {
    assert.equal(measuredPaymentFeeBps(5_000, 100_000), 500);
    assert.equal(measuredPaymentFeeBps(5_000, 0), 0);
  });
});
