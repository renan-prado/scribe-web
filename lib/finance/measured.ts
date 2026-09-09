/**
 * A ponte entre o ledger de moedas e a RECEITA em reais — client-safe e pura.
 *
 * O Scriba não guarda um histórico de faturas em reais. O que ele guarda, com
 * data e por conta, é o CRÉDITO de moedas que cada pagamento confirmado gerou
 * (`coin_transactions`, motivos `subscription_grant` e `topup_pack`, escritos
 * por `lib/billing/fulfill.ts` a partir do Price que o Stripe confirmou como
 * pago). Esse é o único sinal datado de "entrou dinheiro" que existe no banco.
 *
 * Este módulo faz o caminho de volta: quantas moedas → qual item do catálogo →
 * quanto ele custa. E ele faz isso pelo MESMO `PLANS`/`TOPUP` que a tela de
 * preços usa, não por uma tabela paralela.
 *
 * ============================================================================
 * O QUE ISTO NÃO É, e a limitação precisa estar dita
 * ============================================================================
 *
 * É o preço de TABELA, não o valor cobrado. Um cupom, um upgrade rateado pelo
 * Stripe ou uma mudança de preço no meio do caminho fariam o valor real
 * divergir. Hoje o Scriba não tem cupom nem preço promocional, então os dois
 * coincidem — mas é coincidência de configuração, não garantia estrutural.
 *
 * O caminho para eliminá-la, quando fizer diferença, é gravar `amount_paid` do
 * invoice numa coluna de `coin_transactions` no momento do fulfill. É uma
 * migração com backfill impossível (o passado não tem o dado), e por isso não
 * foi feita agora: ela não conserta o histórico, só o futuro.
 *
 * Quando uma quantidade de moedas não casa com nenhum item do catálogo, este
 * módulo NÃO chuta um valor proporcional — ele conta o evento e o devolve em
 * `unmapped`. Um crédito de origem desconhecida virando receita estimada é
 * exatamente o tipo de número que ninguém audita depois.
 */

import { PLANS, TOPUP } from "@/lib/billing/plans";

/** Motivos de `coin_transactions` que representam dinheiro entrando. */
export const REVENUE_CREDIT_REASONS = ["subscription_grant", "topup_pack"] as const;
export type RevenueCreditReason = (typeof REVENUE_CREDIT_REASONS)[number];

export function isRevenueCreditReason(value: string): value is RevenueCreditReason {
  return (REVENUE_CREDIT_REASONS as readonly string[]).includes(value);
}

/** Motivos que DEVOLVEM dinheiro. Entram na receita com sinal negativo. */
export const REVENUE_REVERSAL_REASONS = ["refund", "chargeback"] as const;

export function isRevenueReversalReason(value: string): boolean {
  return (REVENUE_REVERSAL_REASONS as readonly string[]).includes(value);
}

/**
 * Quanto vale, em centavos de BRL, um crédito de `coins` moedas com este
 * motivo. `null` quando não casa com nada do catálogo — ver o cabeçalho.
 *
 * Assinatura: a quantidade creditada é exatamente `PLANS[plano].coins` (uma
 * fatura, uma unidade), então a busca é por igualdade. Pacote avulso: pode vir
 * multiplicado pela quantidade comprada, então a busca é por divisibilidade.
 */
export function revenueCentsForCredit(reason: string, coins: number): number | null {
  if (coins <= 0) return null;

  if (reason === "subscription_grant") {
    for (const plan of Object.values(PLANS)) {
      if (plan.coins > 0 && plan.coins === coins) return plan.priceCents;
    }
    return null;
  }

  if (reason === "topup_pack") {
    if (TOPUP.coins <= 0 || coins % TOPUP.coins !== 0) return null;
    return (coins / TOPUP.coins) * TOPUP.priceCents;
  }

  return null;
}

export type CoinCreditRow = { reason: string; amount: number; createdAt: string };

export type MeasuredRevenue = {
  /** `YYYY-MM` → centavos de BRL. */
  byMonthCents: Record<string, number>;
  totalCents: number;
  /** Créditos que não casaram com o catálogo. Vira aviso na tela. */
  unmapped: number;
};

/**
 * Agrega as linhas do ledger em receita medida por mês.
 *
 * Estornos (`refund`, `chargeback`) chegam com `amount` NEGATIVO e são
 * debitados do mês em que aconteceram, não do mês da venda original. É a
 * convenção de caixa, e é a única possível: a linha do estorno não guarda para
 * qual fatura ela aponta.
 */
export function aggregateMeasuredRevenue(rows: CoinCreditRow[]): MeasuredRevenue {
  const byMonthCents: Record<string, number> = {};
  let totalCents = 0;
  let unmapped = 0;

  for (const row of rows) {
    const month = row.createdAt.slice(0, 7);
    if (isRevenueReversalReason(row.reason)) {
      // O estorno devolve moedas com sinal negativo; o valor em reais espelha
      // o crédito que o originou, então o mapeamento usa o módulo.
      const cents = revenueCentsForCredit("subscription_grant", Math.abs(row.amount));
      if (cents === null) continue;
      byMonthCents[month] = (byMonthCents[month] ?? 0) - cents;
      totalCents -= cents;
      continue;
    }
    if (!isRevenueCreditReason(row.reason)) continue;
    const cents = revenueCentsForCredit(row.reason, row.amount);
    if (cents === null) {
      unmapped += 1;
      continue;
    }
    byMonthCents[month] = (byMonthCents[month] ?? 0) + cents;
    totalCents += cents;
  }

  return { byMonthCents, totalCents, unmapped };
}

export type UsageCostRow = { createdAt: string; costUsd: number };

/**
 * Custo de IA por mês, em centavos de BRL.
 *
 * A conversão usa UMA cotação para toda a série, e isso é uma escolha: o
 * histórico de câmbio não existe no banco, e reconverter tudo pela cotação de
 * hoje ao menos deixa os meses comparáveis entre si. Um mês convertido pela
 * cotação da época e outro pela de hoje seria pior — a variação do dólar
 * apareceria como variação de custo do produto.
 */
export function aggregateAiCostByMonth(
  rows: UsageCostRow[],
  usdBrl: number | null
): Record<string, number> {
  const out: Record<string, number> = {};
  if (usdBrl === null || usdBrl <= 0) return out;
  for (const row of rows) {
    const month = row.createdAt.slice(0, 7);
    out[month] = (out[month] ?? 0) + row.costUsd * usdBrl * 100;
  }
  for (const key of Object.keys(out)) out[key] = Math.round(out[key]);
  return out;
}
