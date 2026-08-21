import "server-only";

/**
 * Current USD→BRL rate from AwesomeAPI (economia.awesomeapi.com.br).
 * Free, keyless, Brazilian. Cached at the edge for 1h via Next.js
 * fetch revalidation — the rate moves through the day but hourly
 * refresh is plenty for an internal cost dashboard.
 *
 * If the upstream fails we return `null` and the UI falls back to
 * showing USD with a discreet notice — better than displaying wrong
 * numbers based on a stale hardcoded rate.
 */

export type UsdBrlRate = {
  rate: number;
  fetchedAt: string;
  source: "awesomeapi";
};

const URL = "https://economia.awesomeapi.com.br/last/USD-BRL";

type ApiResponse = {
  USDBRL?: {
    bid?: string;
    ask?: string;
    create_date?: string;
    timestamp?: string;
  };
};

export async function getUsdToBrl(): Promise<UsdBrlRate | null> {
  try {
    const res = await fetch(URL, {
      next: { revalidate: 3600, tags: ["fx-usd-brl"] },
    });
    if (!res.ok) {
      console.warn("[fx] USD-BRL fetch non-ok", { status: res.status });
      return null;
    }
    const body = (await res.json()) as ApiResponse;
    const bid = body.USDBRL?.bid;
    const rate = bid ? Number.parseFloat(bid) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      console.warn("[fx] USD-BRL invalid payload", { bid });
      return null;
    }
    return {
      rate,
      fetchedAt: body.USDBRL?.create_date ?? new Date().toISOString(),
      source: "awesomeapi",
    };
  } catch (err) {
    console.warn("[fx] USD-BRL fetch failed", { error: (err as Error).message });
    return null;
  }
}
