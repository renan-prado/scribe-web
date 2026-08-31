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

/**
 * Busca em voo, compartilhada entre chamadores concorrentes.
 *
 * O chip do header e o diálogo de créditos costumam pedir o resumo no mesmo
 * instante. Antes, a segunda chamada devolvia o valor VELHO na hora (`return
 * get().summary`, quase sempre `null`) — quem esperava por ela montava a tela
 * com plano "free" e corrigia meio segundo depois, trocando os cards de plano
 * na frente do usuário. Devolver a mesma promise faz todo mundo acordar junto,
 * já com o dado fresco, e continua fazendo só um request.
 */
let inflight: Promise<BillingSummary | null> | null = null;

export const useBillingStore = create<BillingStoreState>((set) => ({
  summary: null,
  loading: false,

  refresh: () => {
    if (inflight) return inflight;
    set({ loading: true });
    inflight = (async () => {
      try {
        const res = await fetch("/api/billing/summary", { cache: "no-store" });
        if (!res.ok) return null;
        const body = (await res.json()) as BillingSummary;
        set({ summary: body });
        return body;
      } catch {
        return null;
      } finally {
        inflight = null;
        set({ loading: false });
      }
    })();
    return inflight;
  },
}));

export const getBillingState = () => useBillingStore.getState();

/** Plano corrente com fallback seguro para "free" enquanto carrega. */
export function planOf(summary: BillingSummary | null): PlanKey {
  return summary?.plan ?? "free";
}
