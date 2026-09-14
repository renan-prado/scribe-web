import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANS, TOPUP } from "@/lib/billing/plans";
import {
  aggregateAiCostByMonth,
  aggregateMeasuredRevenue,
  revenueCentsForCredit,
} from "./measured";

describe("revenueCentsForCredit", () => {
  it("casa um crédito de assinatura com o preço do plano", () => {
    assert.equal(
      revenueCentsForCredit("subscription_grant", PLANS.pessoal.coins),
      PLANS.pessoal.priceCents
    );
    assert.equal(
      revenueCentsForCredit("subscription_grant", PLANS.estudioso.coins),
      PLANS.estudioso.priceCents
    );
  });

  it("multiplica o pacote avulso pela quantidade", () => {
    assert.equal(revenueCentsForCredit("topup_pack", TOPUP.coins), TOPUP.priceCents);
    assert.equal(revenueCentsForCredit("topup_pack", TOPUP.coins * 3), TOPUP.priceCents * 3);
  });

  it("não CHUTA valor proporcional para quantidade desconhecida", () => {
    assert.equal(revenueCentsForCredit("subscription_grant", 777), null);
    assert.equal(revenueCentsForCredit("topup_pack", TOPUP.coins + 1), null);
  });

  it("ignora motivos que não são dinheiro entrando", () => {
    assert.equal(revenueCentsForCredit("partner_allowance", 1_000), null);
    assert.equal(revenueCentsForCredit("live_minute", 7), null);
  });
});

describe("aggregateMeasuredRevenue", () => {
  it("agrupa por mês do crédito", () => {
    const result = aggregateMeasuredRevenue([
      {
        reason: "subscription_grant",
        amount: PLANS.pessoal.coins,
        createdAt: "2026-08-03T10:00:00Z",
      },
      {
        reason: "subscription_grant",
        amount: PLANS.pessoal.coins,
        createdAt: "2026-09-03T10:00:00Z",
      },
      { reason: "topup_pack", amount: TOPUP.coins, createdAt: "2026-09-20T10:00:00Z" },
    ]);
    assert.equal(result.byMonthCents["2026-08"], PLANS.pessoal.priceCents);
    assert.equal(result.byMonthCents["2026-09"], PLANS.pessoal.priceCents + TOPUP.priceCents);
    assert.equal(result.totalCents, PLANS.pessoal.priceCents * 2 + TOPUP.priceCents);
    assert.equal(result.unmapped, 0);
  });

  it("conta o que não casou em vez de somar um palpite", () => {
    const result = aggregateMeasuredRevenue([
      { reason: "subscription_grant", amount: 12_345, createdAt: "2026-09-03T10:00:00Z" },
    ]);
    assert.equal(result.totalCents, 0);
    assert.equal(result.unmapped, 1);
  });

  it("estorno debita o mês em que aconteceu", () => {
    const result = aggregateMeasuredRevenue([
      {
        reason: "subscription_grant",
        amount: PLANS.pessoal.coins,
        createdAt: "2026-08-03T10:00:00Z",
      },
      { reason: "refund", amount: -PLANS.pessoal.coins, createdAt: "2026-09-05T10:00:00Z" },
    ]);
    assert.equal(result.byMonthCents["2026-08"], PLANS.pessoal.priceCents);
    assert.equal(result.byMonthCents["2026-09"], -PLANS.pessoal.priceCents);
    assert.equal(result.totalCents, 0);
  });

  it("gasto de moeda não é receita negativa", () => {
    const result = aggregateMeasuredRevenue([
      { reason: "live_minute", amount: -7, createdAt: "2026-09-05T10:00:00Z" },
    ]);
    assert.deepEqual(result.byMonthCents, {});
    assert.equal(result.unmapped, 0);
  });
});

describe("aggregateAiCostByMonth", () => {
  it("converte e agrupa", () => {
    const out = aggregateAiCostByMonth(
      [
        { createdAt: "2026-09-01T00:00:00Z", costUsd: 1.5 },
        { createdAt: "2026-09-20T00:00:00Z", costUsd: 0.5 },
        { createdAt: "2026-08-20T00:00:00Z", costUsd: 2 },
      ],
      5
    );
    assert.equal(out["2026-09"], 1_000); // US$ 2 × 5 = R$ 10
    assert.equal(out["2026-08"], 1_000);
  });

  it("soma em ponto flutuante e arredonda UMA vez no fim", () => {
    // Três centavos de dólar a 5,00: 0,01×3×5 = 0,15 → 15 centavos. Arredondar
    // linha a linha daria 5+5+5 = 15 aqui, mas a 5,555 daria 6+6+6 = 18 contra
    // os 17 corretos, é esse o caso que o arredondamento único protege.
    const out = aggregateAiCostByMonth(
      [
        { createdAt: "2026-09-01T00:00:00Z", costUsd: 0.01 },
        { createdAt: "2026-09-02T00:00:00Z", costUsd: 0.01 },
        { createdAt: "2026-09-03T00:00:00Z", costUsd: 0.01 },
      ],
      5.555
    );
    assert.equal(out["2026-09"], 17);
  });

  it("sem cotação devolve vazio em vez de zeros", () => {
    const out = aggregateAiCostByMonth([{ createdAt: "2026-09-01T00:00:00Z", costUsd: 1 }], null);
    assert.deepEqual(out, {});
  });
});
