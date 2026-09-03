import "server-only";

import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";

const log = createLogger("fx");

/**
 * Current USD→BRL rate. Preferred source is AwesomeAPI
 * (economia.awesomeapi.com.br) — free, keyless, Brazilian. Cached at the
 * edge for 1h via Next.js fetch revalidation.
 *
 * When the upstream fails (network, non-ok, invalid payload), fall back
 * to a value the admin previously entered by hand and persisted in a
 * server-readable cookie (`MANUAL_FX_COOKIE`). If no manual value has
 * ever been set, return null and the UI shows an input form.
 */

export type UsdBrlRate = {
  rate: number;
  fetchedAt: string;
  source: "awesomeapi" | "manual";
};

const URL = "https://economia.awesomeapi.com.br/last/USD-BRL";

export const MANUAL_FX_COOKIE = "scriba_fx_usd_brl_manual";

type ApiResponse = {
  USDBRL?: {
    bid?: string;
    ask?: string;
    create_date?: string;
    timestamp?: string;
  };
};

type ManualCookiePayload = {
  rate: number;
  setAt: string;
};

async function readManualCookie(): Promise<UsdBrlRate | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(MANUAL_FX_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManualCookiePayload;
    if (typeof parsed.rate !== "number" || !Number.isFinite(parsed.rate) || parsed.rate <= 0) {
      return null;
    }
    return {
      rate: parsed.rate,
      fetchedAt: parsed.setAt ?? new Date().toISOString(),
      source: "manual",
    };
  } catch {
    return null;
  }
}

export async function getUsdToBrl(): Promise<UsdBrlRate | null> {
  try {
    const res = await fetch(URL, {
      next: { revalidate: 3600, tags: ["fx-usd-brl"] },
    });
    if (!res.ok) {
      log.warn("USD-BRL fetch non-ok", { status: res.status });
      return readManualCookie();
    }
    const body = (await res.json()) as ApiResponse;
    const bid = body.USDBRL?.bid;
    const rate = bid ? Number.parseFloat(bid) : Number.NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      log.warn("USD-BRL invalid payload", { bid });
      return readManualCookie();
    }
    return {
      rate,
      fetchedAt: body.USDBRL?.create_date ?? new Date().toISOString(),
      source: "awesomeapi",
    };
  } catch (err) {
    log.warn("USD-BRL fetch failed", { error: (err as Error).message });
    return readManualCookie();
  }
}
