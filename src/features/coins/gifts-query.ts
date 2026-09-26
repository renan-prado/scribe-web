"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PendingGift = {
  id: string;
  amount: number;
  title: string;
  message: string;
  createdAt: string;
};

const KEY = ["coin-gifts", "pending"] as const;

/**
 * Presentes de moedas pendentes do usuário. Não guarda no IndexedDB como a
 * Biblioteca: é um evento raro, e vale mais uma busca de verdade a cada
 * abertura do app do que um cache que sobrevive dias mostrando um presente já
 * resgatado numa aba.
 */
export function usePendingGifts() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<PendingGift[]> => {
      const res = await fetch("/api/coins/gifts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { gifts: PendingGift[] };
      return body.gifts;
    },
    staleTime: 60_000,
  });
}

export function useRedeemGift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (giftId: string) => {
      const res = await fetch(`/api/coins/gifts/${giftId}/redeem`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
    },
  });
}
