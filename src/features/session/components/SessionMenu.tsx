"use client";

import { FileText, MoreVertical, Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCoinsStore } from "@/features/coins/store";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

type SessionMenuProps = {
  hasTranscript: boolean;
  hasLiveFeed: boolean;
  onOpenTranscript: () => void;
  onOpenLiveFeed: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReprocess?: () => void;
  reprocessing?: boolean;
};

const REPROCESS_COST = COIN_COSTS.reprocessSummary;

export function SessionMenu({
  hasTranscript,
  hasLiveFeed,
  onOpenTranscript,
  onOpenLiveFeed,
  onEdit,
  onDelete,
  onReprocess,
  reprocessing,
}: SessionMenuProps) {
  const balance = useCoinsStore((s) => s.balance);
  const insufficient = balance !== null && balance < REPROCESS_COST;
  const reprocessDisabled = !onReprocess || reprocessing || insufficient;

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
        {onEdit ? (
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
        ) : null}
        {onReprocess ? (
          <DropdownMenuItem
            disabled={reprocessDisabled}
            onClick={onReprocess}
            className="gap-2"
            aria-label={
              insufficient
                ? `Reprocessar (moedas insuficientes — custa ${REPROCESS_COST})`
                : `Reprocessar (custa ${REPROCESS_COST} moedas)`
            }
          >
            <RefreshCw className={cn("size-4", reprocessing && "animate-spin")} />
            <span className="flex-1">{reprocessing ? "Reprocessando…" : "Reprocessar"}</span>
            <span
              aria-hidden
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-scriba-yellow/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-scriba-gold-ink"
            >
              <span className="coin-hex block h-[9px] w-[8px] bg-scriba-yellow" />
              {REPROCESS_COST}
            </span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={!hasLiveFeed} onClick={onOpenLiveFeed} className="gap-2">
          <Sparkles className="size-4" />
          Ver conteúdo do live
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasTranscript} onClick={onOpenTranscript} className="gap-2">
          <FileText className="size-4" />
          Ler transcrição
        </DropdownMenuItem>
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete} className="gap-2">
              <Trash2 className="size-4" />
              Excluir resumo
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
