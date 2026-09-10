import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinanceRecurring } from "@/lib/domain/finance";
import {
  addMonthsToKey,
  annualEquivalentCents,
  chargeDateInMonth,
  hasChargeInMonth,
  isActiveInMonth,
  monthKey,
  monthlyEquivalentCents,
  monthRange,
  monthsBetween,
  nextChargeDate,
} from "./recurrence";

function recurring(patch: Partial<FinanceRecurring> = {}): FinanceRecurring {
  return {
    id: "r1",
    kind: "expense",
    description: "Vercel",
    counterparty: null,
    categoryId: null,
    amountCents: 20_000,
    currency: "BRL",
    cadence: "monthly",
    startDate: "2026-01-15",
    endDate: null,
    status: "active",
    notes: null,
    createdAt: "2026-01-15T00:00:00Z",
    ...patch,
  };
}

describe("chaves de mês", () => {
  it("extrai e anda", () => {
    assert.equal(monthKey("2026-09-09"), "2026-09");
    assert.equal(addMonthsToKey("2026-11", 3), "2027-02");
    assert.equal(addMonthsToKey("2026-01", -1), "2025-12");
  });

  it("conta meses atravessando o ano", () => {
    assert.equal(monthsBetween("2026-11-01", "2027-02-01"), 3);
    assert.equal(monthsBetween("2027-02-01", "2026-11-01"), -3);
  });

  it("monta a sequência inclusiva", () => {
    assert.deepEqual(monthRange("2026-11", "2027-01"), ["2026-11", "2026-12", "2027-01"]);
    assert.deepEqual(monthRange("2027-01", "2026-11"), []);
  });
});

describe("chargeDateInMonth", () => {
  it("grampeia o dia ao fim do mês em vez de transbordar", () => {
    assert.equal(chargeDateInMonth("2026-02", 31), "2026-02-28");
    assert.equal(chargeDateInMonth("2028-02", 31), "2028-02-29"); // bissexto
    assert.equal(chargeDateInMonth("2026-04", 31), "2026-04-30");
    assert.equal(chargeDateInMonth("2026-03", 15), "2026-03-15");
  });
});

describe("equivalentes", () => {
  it("mensal de cada cadência", () => {
    assert.equal(monthlyEquivalentCents(20_000, "monthly"), 20_000);
    assert.equal(monthlyEquivalentCents(30_000, "quarterly"), 10_000);
    assert.equal(monthlyEquivalentCents(60_000, "semiannual"), 10_000);
    assert.equal(monthlyEquivalentCents(8_000, "annual"), 667); // R$ 80/ano ≈ R$ 6,67
  });

  it("o anual sai do valor original, não de mensal × 12", () => {
    // 667 × 12 = 8.004, quatro centavos a mais que o contrato de 8.000.
    assert.equal(annualEquivalentCents(8_000, "annual"), 8_000);
    assert.equal(annualEquivalentCents(20_000, "monthly"), 240_000);
    assert.equal(annualEquivalentCents(30_000, "quarterly"), 120_000);
  });
});

describe("isActiveInMonth", () => {
  it("cancelada nunca está viva", () => {
    assert.equal(isActiveInMonth(recurring({ status: "cancelled" }), "2026-06"), false);
  });
  it("respeita início e fim", () => {
    const r = recurring({ startDate: "2026-03-10", endDate: "2026-08-10" });
    assert.equal(isActiveInMonth(r, "2026-02"), false);
    assert.equal(isActiveInMonth(r, "2026-03"), true);
    assert.equal(isActiveInMonth(r, "2026-08"), true);
    assert.equal(isActiveInMonth(r, "2026-09"), false);
  });
});

describe("hasChargeInMonth", () => {
  it("mensal cobra todo mês", () => {
    const r = recurring({ cadence: "monthly", startDate: "2026-01-15" });
    assert.equal(hasChargeInMonth(r, "2026-01"), true);
    assert.equal(hasChargeInMonth(r, "2026-02"), true);
    assert.equal(hasChargeInMonth(r, "2026-07"), true);
  });

  it("trimestral conta a partir do MÊS DE INÍCIO, não do calendário", () => {
    // Começou em fevereiro: cobra fev, mai, ago, nov, não jan/abr/jul/out.
    const r = recurring({ cadence: "quarterly", startDate: "2026-02-01" });
    assert.equal(hasChargeInMonth(r, "2026-02"), true);
    assert.equal(hasChargeInMonth(r, "2026-03"), false);
    assert.equal(hasChargeInMonth(r, "2026-04"), false);
    assert.equal(hasChargeInMonth(r, "2026-05"), true);
    assert.equal(hasChargeInMonth(r, "2026-11"), true);
  });

  it("anual cobra uma vez por ano no mês de início", () => {
    const r = recurring({ cadence: "annual", startDate: "2026-03-20" });
    assert.equal(hasChargeInMonth(r, "2026-03"), true);
    assert.equal(hasChargeInMonth(r, "2026-09"), false);
    assert.equal(hasChargeInMonth(r, "2027-03"), true);
  });

  it("não cobra depois do término", () => {
    const r = recurring({ cadence: "monthly", startDate: "2026-01-20", endDate: "2026-03-10" });
    assert.equal(hasChargeInMonth(r, "2026-02"), true);
    // A cobrança de março cairia no dia 20, depois do fim em 10.
    assert.equal(hasChargeInMonth(r, "2026-03"), false);
  });
});

describe("nextChargeDate", () => {
  it("acha a próxima dentro do mês corrente", () => {
    const r = recurring({ cadence: "monthly", startDate: "2026-01-20" });
    assert.equal(nextChargeDate(r, "2026-09-09"), "2026-09-20");
  });

  it("pula para o mês seguinte quando a do mês já passou", () => {
    const r = recurring({ cadence: "monthly", startDate: "2026-01-05" });
    assert.equal(nextChargeDate(r, "2026-09-09"), "2026-10-05");
  });

  it("acha a próxima de uma anual daqui a meses", () => {
    const r = recurring({ cadence: "annual", startDate: "2026-03-20" });
    assert.equal(nextChargeDate(r, "2026-09-09"), "2027-03-20");
  });

  it("devolve null para cancelada e para terminada", () => {
    assert.equal(nextChargeDate(recurring({ status: "cancelled" }), "2026-09-09"), null);
    assert.equal(nextChargeDate(recurring({ endDate: "2026-05-01" }), "2026-09-09"), null);
  });

  it("a que ainda não começou aponta para o próprio início", () => {
    const r = recurring({ cadence: "monthly", startDate: "2027-01-10" });
    assert.equal(nextChargeDate(r, "2026-09-09"), "2027-01-10");
  });
});
