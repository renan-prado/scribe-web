"use client";

import { create } from "zustand";
import type { ChargeReason } from "@/lib/coins/pricing";

/**
 * Central store for the current user's coin balance. Replaces the old
 * `scriba:coin-balance` CustomEvent bus — every consumer now subscribes to
 * this store, so a single refresh/charge propagates to the header chip, the
 * NewRecordingDialog gate, the DeepenButton state, etc. simultaneously.
 *
 * `balance === null` means "unknown yet" — used by consumers to distinguish
 * initial-loading from actually-zero when gating buttons.
 */

export type ChargeResponse =
  | { ok: true; balance: number; amount: number }
  | { ok: false; error: "insufficient_balance" | "network" | "server"; message?: string };

type CoinsStoreState = {
  balance: number | null;
  setBalance: (v: number | null) => void;
  /** GET /api/coins/balance. Returns the fetched balance or null on error. */
  refresh: () => Promise<number | null>;
  /** POST /api/coins/charge. Updates `balance` on success. */
  charge: (reason: ChargeReason, sessionId: string | null) => Promise<ChargeResponse>;
};

export const useCoinsStore = create<CoinsStoreState>((set) => ({
  balance: null,

  setBalance: (v) => set({ balance: v === null ? null : Math.max(0, v) }),

  refresh: async () => {
    try {
      const res = await fetch("/api/coins/balance", { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as { balance?: number };
      if (typeof body.balance !== "number") return null;
      const next = Math.max(0, body.balance);
      set({ balance: next });
      return next;
    } catch {
      return null;
    }
  },

  charge: async (reason, sessionId) => {
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
      const next = Math.max(0, body.balance);
      set({ balance: next });
      return { ok: true, balance: next, amount: body.amount ?? 0 };
    } catch (err) {
      return { ok: false, error: "network", message: (err as Error).message };
    }
  },
}));

/** Non-hook access for use inside effects/callbacks. */
export const getCoinsState = () => useCoinsStore.getState();
