import type { UsdBrlRate } from "./usd-brl";

/**
 * Money formatter that renders in BRL when we have a live rate, and
 * falls back to USD otherwise. `precision` controls decimal places:
 * "cents" for headline sums, "fine" for tiny per-call values.
 */

const BRL_CENTS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_FINE = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const USD_CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_FINE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export type MoneyPrecision = "cents" | "fine";

export function makeMoneyFormatter(rate: UsdBrlRate | null) {
  return (usd: number, precision: MoneyPrecision = "cents"): string => {
    if (rate) {
      const brl = usd * rate.rate;
      return (precision === "fine" ? BRL_FINE : BRL_CENTS).format(brl);
    }
    return (precision === "fine" ? USD_FINE : USD_CENTS).format(usd);
  };
}

export type MoneyFormatter = ReturnType<typeof makeMoneyFormatter>;
