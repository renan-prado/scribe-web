import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinanceEntry } from "@/lib/domain/finance";
import {
  applyBps,
  entryAmountBrlCents,
  entryRemainingBrlCents,
  formatBrlCents,
  formatPercent,
  marginRatio,
  parseMoneyToCents,
  sumBrlCents,
  toBrlCents,
} from "./money";

function entry(patch: Partial<FinanceEntry> = {}): FinanceEntry {
  return {
    id: "e1",
    kind: "expense",
    description: "teste",
    counterparty: null,
    categoryId: null,
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

describe("toBrlCents", () => {
  it("devolve o próprio valor quando já é real", () => {
    assert.equal(toBrlCents(1234, "BRL", 5.4), 1234);
    assert.equal(toBrlCents(1234, "BRL", null), 1234);
  });

  it("converte dólar pela cotação", () => {
    assert.equal(toBrlCents(10_000, "USD", 5.5), 55_000);
  });

  it("devolve null — e não zero — sem cotação", () => {
    assert.equal(toBrlCents(10_000, "USD", null), null);
    assert.equal(toBrlCents(10_000, "USD", 0), null);
    assert.equal(toBrlCents(10_000, "USD", Number.NaN), null);
  });

  it("arredonda uma vez só", () => {
    // 1 centavo × 5,555 = 5,555 → 6, não 5.
    assert.equal(toBrlCents(1, "USD", 5.555), 6);
  });
});

describe("entryAmountBrlCents", () => {
  it("liquidado usa o câmbio CONGELADO, não o vivo", () => {
    const paid = entry({ status: "paid", settledAt: "2026-07-10", currency: "USD", fxRate: 5.0 });
    assert.equal(entryAmountBrlCents(paid, { usdBrl: 6.0 }), 50_000);
  });

  it("pendente usa o câmbio VIVO — é hoje que ele seria pago", () => {
    const pending = entry({ status: "pending", currency: "USD", fxRate: 5.0 });
    assert.equal(entryAmountBrlCents(pending, { usdBrl: 6.0 }), 60_000);
  });

  it("liquidado sem câmbio gravado cai no vivo", () => {
    const paid = entry({ status: "paid", settledAt: "2026-07-10", currency: "USD", fxRate: null });
    assert.equal(entryAmountBrlCents(paid, { usdBrl: 5.5 }), 55_000);
  });
});

describe("entryRemainingBrlCents", () => {
  it("desconta o que já foi pago", () => {
    const partial = entry({ amountCents: 10_000, paidCents: 3_000 });
    assert.equal(entryRemainingBrlCents(partial, { usdBrl: null }), 7_000);
  });

  it("nunca fica negativo", () => {
    const over = entry({ amountCents: 10_000, paidCents: 10_000 });
    assert.equal(entryRemainingBrlCents(over, { usdBrl: null }), 0);
  });

  it("converte o pago pelo mesmo câmbio do total", () => {
    const usd = entry({ currency: "USD", amountCents: 50_000, paidCents: 20_000 });
    assert.equal(entryRemainingBrlCents(usd, { usdBrl: 5 }), 150_000);
  });
});

describe("sumBrlCents", () => {
  it("ignora o inconvertível e o CONTA", () => {
    const { total, unconvertible } = sumBrlCents([100, null, 250, null]);
    assert.equal(total, 350);
    assert.equal(unconvertible, 2);
  });
});

describe("applyBps", () => {
  it("10.000 bps é 100%", () => {
    assert.equal(applyBps(12_345, 10_000), 12_345);
  });
  it("aplica e arredonda uma vez", () => {
    assert.equal(applyBps(10_000, 1_050), 1_050);
    assert.equal(applyBps(333, 1_000), 33);
  });
});

describe("marginRatio", () => {
  it("recusa dividir por zero", () => {
    assert.equal(marginRatio(0, 100), null);
    assert.equal(marginRatio(-10, 100), null);
  });
  it("aceita margem negativa", () => {
    assert.equal(marginRatio(100, 150), -0.5);
  });
});

describe("parseMoneyToCents", () => {
  it("lê o formato brasileiro", () => {
    assert.equal(parseMoneyToCents("1.234,56"), 123_456);
    assert.equal(parseMoneyToCents("R$ 1.234,56"), 123_456);
    assert.equal(parseMoneyToCents("0,07"), 7);
  });

  it("lê o formato americano", () => {
    assert.equal(parseMoneyToCents("1234.56"), 123_456);
    assert.equal(parseMoneyToCents("1.23"), 123);
  });

  it("trata ponto com três dígitos como milhar", () => {
    assert.equal(parseMoneyToCents("1.200"), 120_000);
  });

  it("aceita inteiro puro", () => {
    assert.equal(parseMoneyToCents("200"), 20_000);
  });

  it("devolve null — nunca zero — para o que não é número", () => {
    assert.equal(parseMoneyToCents(""), null);
    assert.equal(parseMoneyToCents("   "), null);
    assert.equal(parseMoneyToCents("abc"), null);
  });
});

describe("formatação", () => {
  it("null vira travessão, não R$ 0,00", () => {
    assert.equal(formatBrlCents(null), "—");
    assert.equal(formatPercent(null), "—");
  });
  it("zero continua sendo zero", () => {
    assert.match(formatBrlCents(0), /0,00/);
  });
});
