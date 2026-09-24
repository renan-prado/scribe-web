"use client";

import { create } from "zustand";
import type { ChargeReason } from "@/features/coins/pricing";

/** O ciclo, como o cliente o recebe. Espelha `lib/db/coins.ts#CycleUsage`. */
export type CycleUsage = { grant: number; spent: number; since: string };

/**
 * Central store for the current user's coin balance. Replaces the old
 * `scriba:coin-balance` CustomEvent bus, every consumer now subscribes to
 * this store, so a single refresh/charge propagates to the header chip, the
 * create-action gates, etc. simultaneously.
 *
 * `balance === null` means "unknown yet", used by consumers to distinguish
 * initial-loading from actually-zero when gating buttons.
 */

export type ChargeResponse =
  | { ok: true; balance: number; amount: number }
  | { ok: false; error: "insufficient_balance" | "network" | "server"; message?: string };

type CoinsStoreState = {
  balance: number | null;
  /**
   * O ciclo de crédito de quem assina: franquia, gasto e quando ela chegou.
   *
   * `null` tem DOIS significados aqui, e os dois levam ao mesmo desenho: "ainda
   * não sei" e "esta conta não tem franquia". A distinção que importa é a do
   * `balance` — ali `null` é "não sei" e trava os gates; aqui a ausência só faz
   * o chip cair no modo do saldo absoluto, que é o certo para a conta gratuita
   * de qualquer jeito. Ver `docs/creditos-na-tela.md`.
   */
  cycle: CycleUsage | null;
  /**
   * Conta de Backoffice: o saldo não significa nada e nada trava por causa
   * dele (migração 0073). A UI desenha ∞ no lugar do número e nenhum gate
   * fecha.
   *
   * Ele é um TERCEIRO estado ao lado de `balance`, e não um `balance = Infinity`
   * disfarçado: o número continua sendo o que está em `profiles`, e um
   * `Infinity` atravessaria `Odometer`, `Math.min` do anel e o `toLocaleString`
   * do chip — três lugares que passariam a desenhar "∞" por acidente em vez
   * de por decisão.
   */
  unlimited: boolean;
  setBalance: (v: number | null) => void;
  setCycle: (v: CycleUsage | null) => void;
  setUnlimited: (v: boolean) => void;
  /** GET /api/coins/balance. Returns the fetched balance or null on error. */
  refresh: () => Promise<number | null>;
  /** POST /api/coins/charge. Updates `balance` on success. */
  charge: (reason: ChargeReason, sessionId: string | null) => Promise<ChargeResponse>;
};

export const useCoinsStore = create<CoinsStoreState>((set) => ({
  balance: null,
  cycle: null,
  unlimited: false,

  setBalance: (v) => set({ balance: v === null ? null : Math.max(0, v) }),

  setCycle: (v) => set({ cycle: v }),

  setUnlimited: (v) => set({ unlimited: v }),

  refresh: async () => {
    try {
      const res = await fetch("/api/coins/balance", { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        balance?: number;
        cycle?: CycleUsage | null;
        unlimited?: boolean;
      };
      if (typeof body.balance !== "number") return null;
      set({ unlimited: body.unlimited === true });
      // O ciclo entra na MESMA atualização do saldo: os dois envelhecem pelo
      // mesmo débito, e gravá-los separado faria o anel e o número discordarem
      // por um instante a cada gasto.
      set({ cycle: body.cycle ?? null });
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
        // A chave é OMITIDA quando não há sessão, nunca mandada como `null`:
        // o schema da rota é `OptionalUuidSchema`, que aceita ausente e recusa
        // nulo. O gravador do v2 cobra ANTES de a sessão existir (ela nasce no
        // stop), então mandava `sessionId: null` todo minuto e levava 400 em
        // todos — a gravação inteira saía de graça, sem sinal nenhum na tela.
        body: JSON.stringify(sessionId ? { reason, sessionId } : { reason }),
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

/**
 * "Esta conta pode pagar `cost`?" — `null` enquanto o saldo é desconhecido.
 *
 * Os três estados são o ponto: `true` libera, `false` fecha, e `null` é "ainda
 * não sei", que NUNCA deve fechar nada (um saldo lento não pode transformar
 * uma conta paga numa parede — o mesmo princípio de `requireBalance` no
 * servidor). Existe para que cada gate não reescreva a condição e esqueça o
 * `unlimited` da conta de Backoffice, que foi exatamente o que aconteceu nos
 * quatro lugares que a liam à mão.
 */
export function useCanAfford(cost: number): boolean | null {
  return useCoinsStore((s) => {
    if (s.unlimited) return true;
    if (s.balance === null) return null;
    return s.balance >= cost;
  });
}
