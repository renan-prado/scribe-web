import type { UsdBrlRate } from "./usd-brl";

/**
 * Money formatter — always renders with 2 decimal places for consistency
 * across the app. BRL when we have a live rate, USD as fallback.
 *
 * The `_precision` parameter is accepted for backward compatibility with
 * existing call sites but ignored — sub-cent precision was creating noise
 * in the dashboard and the user asked for uniform 2-decimal display.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type MoneyPrecision = "cents" | "fine";

export function makeMoneyFormatter(rate: UsdBrlRate | null) {
  return (usd: number, _precision: MoneyPrecision = "cents"): string => {
    if (rate) return BRL.format(usd * rate.rate);
    return USD.format(usd);
  };
}

export type MoneyFormatter = ReturnType<typeof makeMoneyFormatter>;

/**
 * Custo por moeda vive na casa dos R$ 0,003: dois decimais mostram "R$ 0,00" e
 * três ainda não dizem nada útil. A métrica é publicada por 1.000 moedas, que
 * cai numa faixa legível e na mesma ordem de grandeza dos pacotes vendidos.
 */
export const COINS_PER_COST_UNIT = 1000;

export function makeCostPerThousandCoinsFormatter(rate: UsdBrlRate | null) {
  const money = makeMoneyFormatter(rate);
  return (usdPerCoin: number | null): string =>
    usdPerCoin == null ? "—" : money(usdPerCoin * COINS_PER_COST_UNIT);
}

export type CostPerThousandCoinsFormatter = ReturnType<typeof makeCostPerThousandCoinsFormatter>;
