"use client";

import { useCallback, useState } from "react";
import { useCoinsStore } from "@/features/coins/store";
import type { BibleAISearchResponse, BibleSearchApiResponse } from "@/lib/domain/bible-search";
import { createLogger } from "@/lib/log";

const log = createLogger("bible-search");

export type BibleSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: BibleAISearchResponse }
  | { status: "error"; message: string };

/**
 * A busca por sentido do painel da Bíblia: uma pergunta, um `POST`, uma
 * lista de passagens já ancoradas na NVI. Espelha `useBibloVoice.ts` — um
 * hook por chamada de uma tentativa só, sem React Query, porque não há nada
 * aqui para CACHEAR: a mesma pergunta feita duas vezes é uma pergunta nova,
 * ela custa moeda as duas vezes.
 *
 * **402 e 403 abrem o `BillingDialog`, não um texto de erro.** É a MESMA
 * decisão do `DeepenButton`: quem esbarrou num muro de plano ou de saldo não
 * precisa ler que esbarrou, precisa da porta de saída.
 */
export function useBibleSearch() {
  const [state, setState] = useState<BibleSearchState>({ status: "idle" });
  const [billingOpen, setBillingOpen] = useState(false);
  const setBalance = useCoinsStore((s) => s.setBalance);

  const ask = useCallback(
    async (question: string) => {
      setState({ status: "loading" });
      try {
        const res = await fetch("/api/bible-search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (res.status === 402 || res.status === 403) {
          setState({ status: "idle" });
          setBillingOpen(true);
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: "Não consegui buscar agora. Tente de novo." });
          return;
        }

        const body = (await res.json()) as BibleSearchApiResponse;
        if (typeof body.balance === "number") setBalance(body.balance);
        setState({ status: "ok", data: body });
      } catch (error) {
        log.error("busca falhou", { error: String(error) });
        setState({ status: "error", message: "Não consegui buscar agora. Tente de novo." });
      }
    },
    [setBalance]
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, ask, reset, billingOpen, setBillingOpen };
}
