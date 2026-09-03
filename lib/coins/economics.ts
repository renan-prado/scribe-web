/**
 * A conta que responde "este preço se paga?".
 *
 * De um lado, o custo MEDIDO: o que a OpenAI cobrou de fato, somado dos
 * eventos de `llm_usage_events` e convertido a real pelo câmbio do dia. Do
 * outro, a receita IMPLÍCITA: quanto vale a moeda que a ação debita. Nenhum
 * dos dois é constante no código — o custo é medição, e o valor da moeda é
 * ajustável no painel justamente para simular um preço que ainda não existe.
 *
 * O que é POR MOEDA é publicado por MILHEIRO. Uma moeda custa na casa do
 * centavo de centavo; em duas casas decimais toda ação empata em "R$ 0,00", e
 * é exatamente a diferença entre elas que a tela existe para mostrar. É a
 * mesma razão de `lib/fx/format.ts` já expor `COINS_PER_COST_UNIT`, e este
 * arquivo reusa aquela constante em vez de escolher a sua.
 *
 * **Há DUAS margens aqui, e confundi-las já produziu uma tela que se
 * contradizia.** `marginAtCurrentPrice` é a da decisão — custo de uma execução
 * contra o que a ação cobra hoje; `realizedMargin` é a histórica — custo
 * contra as moedas que o ledger de fato debitou. Elas empatam na operação
 * normal e divergem quando o período pega uma mudança de preço. A sugestão de
 * preço sai da primeira, e é por isso que a coluna "Margem" da tela também
 * tem de sair: duas colunas vizinhas em bases diferentes se contradizem sem
 * que nada esteja tecnicamente errado.
 *
 * Client-safe: o simulador recalcula a cada tecla.
 */

import { COINS_PER_COST_UNIT } from "@/lib/fx/format";

export { COINS_PER_COST_UNIT };

/**
 * Valor de venda da moeda, quando ninguém ajustou nada.
 *
 * É o pacote avulso (R$ 10,00 por 500 moedas = R$ 20,00 o milheiro), e não a
 * média dos planos, por duas razões: é o preço MARGINAL — o que o usuário
 * paga quando o saldo acaba, que é quando ele realmente compra — e é um
 * número fixo. Uma média ponderada do mix vendido mudaria sozinha a cada mês,
 * e duas medições de margem em meses diferentes deixariam de ser comparáveis.
 */
export const DEFAULT_COIN_PRICE_PER_THOUSAND_BRL = 20;

/**
 * Margem que a tela usa para sugerir um preço. Não é meta de empresa: é o
 * ponto de referência contra o qual a pergunta "continuo deixando por 5
 * moedas/min?" tem uma resposta numérica em vez de uma impressão.
 */
export const DEFAULT_TARGET_MARGIN_PCT = 70;

export type CoinEconomicsSettings = {
  /** Reais por 1.000 moedas. */
  pricePerThousandBrl: number;
  /** Margem alvo, em pontos percentuais (0–99). */
  targetMarginPct: number;
};

export const DEFAULT_COIN_ECONOMICS: CoinEconomicsSettings = {
  pricePerThousandBrl: DEFAULT_COIN_PRICE_PER_THOUSAND_BRL,
  targetMarginPct: DEFAULT_TARGET_MARGIN_PCT,
};

export type ActionEconomicsInput = {
  /** Custo medido no período, em dólar, já somado. */
  costUsd: number;
  /** Câmbio; null quando a cotação falhou e não há valor manual. */
  usdToBrl: number | null;
  /** Moedas debitadas no período por esta ação. */
  coins: number;
  /** Execuções no período (minutos iniciados, estudos gerados…). */
  executions: number;
  /** Moedas que UMA execução debita hoje. */
  coinsPerExecution: number;
  settings: CoinEconomicsSettings;
};

export type ActionEconomics = {
  /** Custo do milheiro de moeda desta ação, em real. */
  costPerThousandCoinsBrl: number | null;
  /** Receita do milheiro — igual para toda ação; é a régua. */
  revenuePerThousandCoinsBrl: number;
  /** Custo de uma execução, em real. */
  costPerExecutionBrl: number | null;
  /** Receita de uma execução ao preço configurado, em real. */
  revenuePerExecutionBrl: number;
  /**
   * A MARGEM DA DECISÃO: quanto sobra de uma execução ao preço que a ação
   * cobra HOJE. É a única que responde "continuo cobrando 7 moedas o minuto?",
   * e a única coerente com `suggestedCoinsPerExecution` — as duas saem do
   * mesmo custo por execução. 0–1; null sem câmbio ou sem execução medida.
   */
  marginAtCurrentPrice: number | null;
  /**
   * A margem que de fato SAIU: custo medido contra as moedas que o ledger
   * debitou no período. Responde outra pergunta — "as moedas que já vendi se
   * pagaram?" — e diverge da de cima sempre que as moedas debitadas não batem
   * com execuções × preço de hoje. Ver `ledgerCoinsPerExecution`.
   */
  realizedMargin: number | null;
  /**
   * Quanto o ledger cobrou, em média, por execução. Bate com o preço de hoje
   * na operação normal; diverge quando o período pega uma mudança de preço
   * (lançamentos antigos ao preço velho) ou quando houve cobrança sem execução
   * medida — e é a divergência que explica as duas margens não conversarem.
   */
  ledgerCoinsPerExecution: number | null;
  /** Moedas por execução que fechariam a margem alvo. Null nos mesmos casos. */
  suggestedCoinsPerExecution: number | null;
};

function brl(costUsd: number, usdToBrl: number | null): number | null {
  return usdToBrl == null ? null : costUsd * usdToBrl;
}

export function computeActionEconomics(input: ActionEconomicsInput): ActionEconomics {
  const { costUsd, usdToBrl, coins, executions, coinsPerExecution, settings } = input;
  const coinPriceBrl = settings.pricePerThousandBrl / COINS_PER_COST_UNIT;

  const revenuePerThousandCoinsBrl = settings.pricePerThousandBrl;
  const revenuePerExecutionBrl = coinsPerExecution * coinPriceBrl;

  const totalCostBrl = brl(costUsd, usdToBrl);
  const costPerThousandCoinsBrl =
    totalCostBrl != null && coins > 0 ? (totalCostBrl / coins) * COINS_PER_COST_UNIT : null;
  const costPerExecutionBrl =
    totalCostBrl != null && executions > 0 ? totalCostBrl / executions : null;

  // DUAS margens, porque são duas perguntas — e por muito tempo houve só a
  // segunda, o que produzia uma tela que se contradizia.
  //
  // O caso que revelou: o estudo custava R$ 0,2361 por execução e cobrava 50
  // moedas (R$ 1,00 à régua) — 76% de margem, ótimo. Mas o ledger do período
  // trazia 180 moedas em 18 execuções, 10 por lançamento, porque metade das
  // linhas era anterior à subida de 5 para 50. A margem do milheiro saía −18%
  // e a mesma linha sugeria BAIXAR o preço para 40. As duas estavam certas
  // sobre coisas diferentes, e juntas não diziam nada.
  //
  // A de cima decide preço: ela e a sugestão saem do mesmo custo por execução,
  // então nunca podem se contradizer. A de baixo é histórica, e a divergência
  // entre as duas é informação — não ruído a esconder.
  const marginAtCurrentPrice =
    costPerExecutionBrl != null && revenuePerExecutionBrl > 0
      ? 1 - costPerExecutionBrl / revenuePerExecutionBrl
      : null;

  const realizedMargin =
    costPerThousandCoinsBrl != null && revenuePerThousandCoinsBrl > 0
      ? 1 - costPerThousandCoinsBrl / revenuePerThousandCoinsBrl
      : null;

  const ledgerCoinsPerExecution = executions > 0 ? coins / executions : null;

  // Preço que fecharia a margem alvo. Margem alvo de 100% não tem solução
  // (receita infinita), então o campo é clampeado antes de chegar aqui e a
  // divisão fica protegida de qualquer jeito.
  const targetRatio = 1 - settings.targetMarginPct / 100;
  const suggestedCoinsPerExecution =
    costPerExecutionBrl != null && targetRatio > 0 && coinPriceBrl > 0
      ? costPerExecutionBrl / targetRatio / coinPriceBrl
      : null;

  return {
    costPerThousandCoinsBrl,
    revenuePerThousandCoinsBrl,
    costPerExecutionBrl,
    revenuePerExecutionBrl,
    marginAtCurrentPrice,
    realizedMargin,
    ledgerCoinsPerExecution,
    suggestedCoinsPerExecution,
  };
}

/**
 * O ledger cobrou algo diferente do preço de hoje? Acima de 2% de diferença a
 * tela mostra a margem realizada ao lado da de decisão — abaixo disso é
 * arredondamento de um lançamento estornado, e poluiria toda linha.
 */
export function ledgerDivergesFromPrice(
  ledgerCoinsPerExecution: number | null,
  coinsPerExecution: number
): boolean {
  if (ledgerCoinsPerExecution == null || coinsPerExecution <= 0) return false;
  return Math.abs(ledgerCoinsPerExecution - coinsPerExecution) / coinsPerExecution > 0.02;
}

/** Clamps que valem tanto no formulário quanto na leitura do cookie. */
export function normalizeCoinEconomics(raw: Partial<CoinEconomicsSettings>): CoinEconomicsSettings {
  const price = Number(raw.pricePerThousandBrl);
  const margin = Number(raw.targetMarginPct);
  return {
    pricePerThousandBrl:
      Number.isFinite(price) && price > 0
        ? Math.min(price, 100_000)
        : DEFAULT_COIN_PRICE_PER_THOUSAND_BRL,
    targetMarginPct:
      Number.isFinite(margin) && margin >= 0 && margin < 100 ? margin : DEFAULT_TARGET_MARGIN_PCT,
  };
}
