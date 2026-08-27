"use client";

import { MoreVertical, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCoinsStore } from "@/features/coins/store";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

type DeepeningMenuProps = {
  sessionId: string;
};

const REPROCESS_COST = COIN_COSTS.reprocessDeepening;

/**
 * Menu compacto no cabeçalho da página de estudo. Hoje só oferece
 * "Reprocessar estudo" — refazer a chamada de LLM sobreescrevendo o payload
 * salvo, cobrando `reprocess_deepening` moedas.
 */
export function DeepeningMenu({ sessionId }: DeepeningMenuProps) {
  const router = useRouter();
  const [reprocessing, setReprocessing] = useState(false);
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);
  const insufficient = balance !== null && balance < REPROCESS_COST;
  const disabled = reprocessing || insufficient;

  async function handleReprocess() {
    if (disabled) return;
    setReprocessing(true);
    try {
      const res = await fetch("/api/deepening/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 402 || body.error === "insufficient_balance") {
        toast.error("Moedas insuficientes para reprocessar.");
        return;
      }
      if (!res.ok) {
        toast.error("Não consegui reprocessar o estudo. Tente novamente.");
        return;
      }
      void refresh();
      toast.success("Estudo atualizado.");
      router.refresh();
    } catch {
      toast.error("Falha de conexão ao reprocessar.");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-scriba-ink-mute transition-colors outline-none",
          "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        aria-label="Mais opções"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          disabled={disabled}
          onClick={handleReprocess}
          className="gap-2"
          aria-label={
            insufficient
              ? `Reprocessar (moedas insuficientes — custa ${REPROCESS_COST})`
              : `Reprocessar (custa ${REPROCESS_COST} moedas)`
          }
        >
          <RefreshCw className={cn("size-4", reprocessing && "animate-spin")} />
          <span className="flex-1">{reprocessing ? "Reprocessando…" : "Reprocessar estudo"}</span>
          <span
            aria-hidden
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-scriba-yellow/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-scriba-gold-ink"
          >
            <span className="coin-hex block h-[9px] w-[8px] bg-scriba-yellow" />
            {REPROCESS_COST}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
