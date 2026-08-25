import { useEffect, useState } from "react";
import type { ChargeReason } from "@/lib/coins/pricing";

/**
 * Client-side coin helpers. `chargeCoinsRequest` calls POST /api/coins/charge
 * and, on success, broadcasts a `scriba:coin-balance` custom event so the
 * CoinBalance chip in the header updates instantly without a refetch.
 *
 * `refreshCoinBalance` is the read-side counterpart — the header calls it on
 * mount, and clients can call it after a full-page state change (e.g. after
 * navigating back from /summary) to guarantee the header reflects reality.
 */

export const COIN_BALANCE_EVENT = "scriba:coin-balance";

export type CoinBalanceEventDetail = { balance: number };

/**
 * React hook that returns the current coin balance, refetched on mount and
 * kept in sync via the `scriba:coin-balance` window event dispatched by
 * chargeCoinsRequest / refreshCoinBalance. Returns `null` while the initial
 * fetch is pending so callers can distinguish "unknown yet" from "actually
 * zero" (important for disabled-button gating).
 */
export function useCoinBalance(): number | null {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    function onUpdate(ev: Event) {
      const detail = (ev as CustomEvent<CoinBalanceEventDetail>).detail;
      if (detail && typeof detail.balance === "number") {
        setBalance(Math.max(0, detail.balance));
      }
    }
    window.addEventListener(COIN_BALANCE_EVENT, onUpdate);
    void refreshCoinBalance();
    return () => window.removeEventListener(COIN_BALANCE_EVENT, onUpdate);
  }, []);

  return balance;
}

export function broadcastCoinBalance(balance: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CoinBalanceEventDetail>(COIN_BALANCE_EVENT, { detail: { balance } })
  );
}

export type ChargeResponse =
  | { ok: true; balance: number; amount: number }
  | { ok: false; error: "insufficient_balance" | "network" | "server"; message?: string };

export async function chargeCoinsRequest(
  reason: ChargeReason,
  sessionId: string | null
): Promise<ChargeResponse> {
  try {
    const res = await fetch("/api/coins/charge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, sessionId }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      balance?: number;
      amount?: number;
      error?: string;
    };
    if (res.status === 402) {
      return { ok: false, error: "insufficient_balance" };
    }
    if (!res.ok || typeof body.balance !== "number") {
      return { ok: false, error: "server", message: body.error || `HTTP ${res.status}` };
    }
    broadcastCoinBalance(body.balance);
    return { ok: true, balance: body.balance, amount: body.amount ?? 0 };
  } catch (err) {
    return { ok: false, error: "network", message: (err as Error).message };
  }
}

export async function refreshCoinBalance(): Promise<number | null> {
  try {
    const res = await fetch("/api/coins/balance", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { balance?: number };
    if (typeof body.balance !== "number") return null;
    broadcastCoinBalance(body.balance);
    return body.balance;
  } catch {
    return null;
  }
}
