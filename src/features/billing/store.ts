"use client";

import { create } from "zustand";
import type { BillingSummary, PlanKey } from "@/lib/billing/plans";

/**
 * Estado de cobrança compartilhado (plano, status, se o Stripe está ligado).
 * Espelha o desenho do `useCoinsStore`: uma única fonte para o diálogo de
 * moedas, o card do /profile e o overlay de saldo esgotado.
 *
 * `summary === null` significa "ainda não carregado" — os consumidores usam
 * isso para mostrar esqueleto em vez de assumir plano gratuito.
 *
 * Este store é APENAS leitura de estado. Nada aqui muda plano ou saldo; toda
 * mudança acontece no Stripe e volta pelo webhook.
 */

type BillingStoreState = {
  summary: BillingSummary | null;
  loading: boolean;
  refresh: () => Promise<BillingSummary | null>;
};

export const useBillingStore = create<BillingStoreState>((set, get) => ({
  summary: null,
  loading: false,

  refresh: async () => {
    if (get().loading) return get().summary;
    set({ loading: true });
    try {
      const res = await fetch("/api/billing/summary", { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as BillingSummary;
      set({ summary: body });
      return body;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));

export const getBillingState = () => useBillingStore.getState();

/** Plano corrente com fallback seguro para "free" enquanto carrega. */
export function planOf(summary: BillingSummary | null): PlanKey {
  return summary?.plan ?? "free";
}
