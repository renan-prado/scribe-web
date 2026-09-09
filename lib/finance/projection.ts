/**
 * Projeção financeira — CLIENT-SAFE, pura e determinística.
 *
 * O que este arquivo NÃO faz é a parte importante: ele não projeta "receita de
 * hoje × número de meses". Essa conta é a que todo mundo escreve primeiro e é
 * a que não serve para decidir nada, porque ela ignora as duas forças que de
 * fato movem um SaaS — a base entra e a base sai.
 *
 * ============================================================================
 * O MODELO
 * ============================================================================
 *
 *   clientes[n] = clientes[n-1] · (1 + crescimento − churn) + novos_absolutos
 *
 * Crescimento e churn incidem sobre a base do mês ANTERIOR, na mesma
 * composição, porque é assim que os dois competem: 10% de crescimento com 5%
 * de churn não é 5% de crescimento líquido sobre a base inicial, é 5% ao mês
 * COMPOSTO — e a diferença entre as duas leituras, em doze meses, é o dobro.
 *
 * Os novos absolutos existem à parte porque nem toda aquisição é proporcional
 * à base: uma campanha traz N pessoas, não N%. Com a base pequena — que é o
 * caso do Scriba hoje — o termo percentual sozinho projeta estagnação eterna,
 * porque 10% de 30 clientes é 3.
 *
 *   receita[n]  = clientes[n] · ticket
 *   taxa[n]     = receita[n] · taxa_de_pagamento
 *   variável[n] = clientes[n] · custo_variável_por_cliente
 *   fixo[n]     = custo_fixo_mensal + fixo_extra_do_cenário
 *   imposto[n]  = receita[n] · alíquota
 *   lucro[n]    = receita − taxa − variável − fixo − imposto
 *
 * ============================================================================
 * DE ONDE VÊM OS NÚMEROS, e por que isso é o que separa projeção de chute
 * ============================================================================
 *
 * As PREMISSAS (crescimento, churn, novos por mês) são hipóteses do cenário —
 * alguém digitou. A BASE é medida:
 *
 *   clientes                → assinaturas vivas (`subscriptions`)
 *   ticket                  → ARPU real das assinaturas vivas
 *   custo variável/cliente  → custo de IA medido ÷ assinantes ativos
 *   custo fixo              → equivalente mensal das recorrências fixas
 *   taxa de pagamento       → `lib/partners/economics.ts` sobre a receita
 *
 * Nenhum desses cinco é digitado. É por isso que a projeção do Scriba pode
 * dizer "o custo por cliente é R$ X" com um número que veio de `llm_usage_
 * events` em vez de um palpite — e é por isso que ela vale alguma coisa.
 *
 * ============================================================================
 * O ARREDONDAMENTO
 * ============================================================================
 *
 * Clientes andam em FRAÇÃO dentro do laço e só são arredondados na saída.
 * Arredondar a cada mês trava a projeção de uma base pequena: 30 clientes com
 * 10% de crescimento e 5% de churn viram 31,5 → arredondado para 31 → 32,5 →
 * 32… e o erro de meio cliente por mês vira um mês inteiro de receita em doze.
 * Valores em centavos são arredondados uma vez, no fim de cada mês.
 */

import { applyBps, marginRatio } from "./money";
import { addMonthsToKey } from "./recurrence";

/** O ponto de partida MEDIDO. Nada aqui é hipótese. */
export type ProjectionBasis = {
  /** Assinantes ativos hoje. */
  customers: number;
  /** ARPU medido, em centavos de BRL. */
  arpuCents: number;
  /** Custo fixo mensal (equivalente das recorrências fixas), em centavos. */
  fixedCostCents: number;
  /**
   * Custo variável por cliente por mês, em centavos. Medido: o custo de IA do
   * período dividido pelos assinantes ativos. Quando não há assinante, é 0 —
   * e a projeção diz isso em vez de inventar um custo por cliente.
   */
  variableCostPerCustomerCents: number;
  /** Taxa de pagamento sobre a receita, em basis points. */
  paymentFeeBps: number;
  /** Alíquota padrão sobre a receita, em basis points. */
  taxBps: number;
  cashBalanceCents: number;
  /** `YYYY-MM` do primeiro mês projetado (normalmente o mês seguinte). */
  startMonth: string;
};

/** As hipóteses. Espelha `finance_scenarios`. */
export type ProjectionAssumptions = {
  growthBps: number;
  churnBps: number;
  newCustomersPerMonth: number;
  /** Sobrescreve o ARPU medido. `null` = usar o medido. */
  ticketCents: number | null;
  extraFixedCostCents: number;
  /** Sobrescreve a alíquota das configurações. `null` = herdar. */
  taxBps: number | null;
  horizonMonths: number;
};

export type ProjectedMonth = {
  month: string;
  /** Índice a partir de 1 — "mês 1", "mês 2". */
  index: number;
  customers: number;
  revenueCents: number;
  paymentFeeCents: number;
  variableCostCents: number;
  fixedCostCents: number;
  taxCents: number;
  totalCostCents: number;
  profitCents: number;
  marginRatio: number | null;
  /** Lucro acumulado desde o início da projeção. */
  cumulativeProfitCents: number;
  /** Caixa projetado: saldo de hoje + lucro acumulado. */
  cashCents: number;
};

export type ProjectionResult = {
  months: ProjectedMonth[];
  /** Somas no horizonte de 6 e de 12 meses, para a tabela de comparação. */
  totals: {
    revenue6mCents: number;
    profit6mCents: number;
    revenue12mCents: number;
    profit12mCents: number;
    customersAtEnd: number;
    mrrAtEndCents: number;
  };
  /**
   * Primeiro mês em que o caixa projetado fica negativo. `null` quando nunca
   * fica. É o número que a projeção existe para produzir: não "quanto vamos
   * lucrar", e sim "quando o dinheiro acaba, se acabar".
   */
  cashOutMonth: string | null;
  /** Primeiro mês com lucro positivo. `null` se nunca. */
  breakEvenMonth: string | null;
};

export function project(
  basis: ProjectionBasis,
  assumptions: ProjectionAssumptions
): ProjectionResult {
  const ticket = assumptions.ticketCents ?? basis.arpuCents;
  const taxBps = assumptions.taxBps ?? basis.taxBps;
  const fixedCents = basis.fixedCostCents + assumptions.extraFixedCostCents;
  const growth = assumptions.growthBps / 10_000;
  const churn = assumptions.churnBps / 10_000;

  const months: ProjectedMonth[] = [];
  let customers = basis.customers;
  let cumulative = 0;
  let cashOutMonth: string | null = null;
  let breakEvenMonth: string | null = null;

  for (let i = 1; i <= assumptions.horizonMonths; i += 1) {
    // A base do mês anterior sofre as duas forças; a aquisição absoluta entra
    // depois, porque um cliente que chegou este mês não pode dar churn neste
    // mesmo mês — ele ainda não completou um ciclo de cobrança.
    customers = Math.max(0, customers * (1 + growth - churn) + assumptions.newCustomersPerMonth);

    const revenueCents = Math.round(customers * ticket);
    const paymentFeeCents = applyBps(revenueCents, basis.paymentFeeBps);
    const variableCostCents = Math.round(customers * basis.variableCostPerCustomerCents);
    const taxCents = applyBps(revenueCents, taxBps);
    const totalCostCents = paymentFeeCents + variableCostCents + fixedCents + taxCents;
    const profitCents = revenueCents - totalCostCents;

    cumulative += profitCents;
    const month = addMonthsToKey(basis.startMonth, i - 1);
    const cashCents = basis.cashBalanceCents + cumulative;

    if (cashOutMonth === null && cashCents < 0) cashOutMonth = month;
    if (breakEvenMonth === null && profitCents > 0) breakEvenMonth = month;

    months.push({
      month,
      index: i,
      customers: Math.round(customers),
      revenueCents,
      paymentFeeCents,
      variableCostCents,
      fixedCostCents: fixedCents,
      taxCents,
      totalCostCents,
      profitCents,
      marginRatio: marginRatio(revenueCents, totalCostCents),
      cumulativeProfitCents: cumulative,
      cashCents,
    });
  }

  const sum = (list: ProjectedMonth[], pick: (m: ProjectedMonth) => number) =>
    list.reduce((acc, m) => acc + pick(m), 0);
  const first6 = months.slice(0, 6);
  const first12 = months.slice(0, 12);
  const last = months[months.length - 1];

  return {
    months,
    totals: {
      revenue6mCents: sum(first6, (m) => m.revenueCents),
      profit6mCents: sum(first6, (m) => m.profitCents),
      revenue12mCents: sum(first12, (m) => m.revenueCents),
      profit12mCents: sum(first12, (m) => m.profitCents),
      customersAtEnd: last?.customers ?? basis.customers,
      mrrAtEndCents: last?.revenueCents ?? 0,
    },
    cashOutMonth,
    breakEvenMonth,
  };
}

/**
 * Em quantos meses um investimento se paga, ao lucro projetado.
 *
 * Responde à pergunta do §10 da especificação ("em quanto tempo determinadas
 * despesas ou investimentos serão recuperados?"). Devolve `null` quando o
 * lucro acumulado não alcança o valor dentro do horizonte — e `null` é a
 * resposta honesta: "mais de 12 meses" não é a mesma coisa que "nunca", e
 * inventar uma extrapolação além do horizonte projetado seria projetar sobre
 * projeção.
 */
export function monthsToRecover(result: ProjectionResult, investmentCents: number): number | null {
  if (investmentCents <= 0) return 0;
  for (const month of result.months) {
    if (month.cumulativeProfitCents >= investmentCents) return month.index;
  }
  return null;
}

/**
 * Custo variável por cliente, MEDIDO.
 *
 * Sai daqui e não de dentro de `project` porque ele é uma leitura do passado,
 * não uma premissa — e porque a tela precisa mostrar o número separado, para
 * quem lê saber que ele foi medido e não digitado.
 */
export function measuredVariableCostPerCustomer(
  aiCostCents: number,
  activeSubscribers: number
): number {
  if (activeSubscribers <= 0) return 0;
  return Math.round(aiCostCents / activeSubscribers);
}

/**
 * Taxa de pagamento efetiva em basis points, a partir do que já se mede.
 *
 * `lib/partners/economics.ts` calcula a taxa do Stripe em centavos sobre um
 * valor; aqui ela vira um percentual para poder incidir sobre uma receita
 * projetada que ainda não existe. Sem MRR medido, devolve 0 — um percentual
 * inventado entraria em toda linha da projeção.
 */
export function measuredPaymentFeeBps(stripeFeeCents: number, mrrCents: number): number {
  if (mrrCents <= 0) return 0;
  return Math.round((stripeFeeCents / mrrCents) * 10_000);
}
