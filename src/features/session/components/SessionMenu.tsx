"use client";

import { MoreVertical, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COIN_COSTS } from "@/features/coins/pricing";
import { useCoinsStore } from "@/features/coins/store";
import { cn } from "@/lib/utils";

type SessionMenuProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  onReprocess?: () => void;
  reprocessing?: boolean;
  /** Abre o alerta de alucinação ("Algo está errado"). */
  onReportHallucination?: () => void;
  /**
   * Descartar a gravação EM ANDAMENTO, apaga a sessão sem gerar resumo. O
   * chamador é quem abre a confirmação; este menu só dispara.
   *
   * Existe apesar de a barra do gravador já ter uma lixeira, e não é
   * duplicação inútil: aquela lixeira é um ícone de 14px numa barra que se
   * apaga sozinha depois de alguns segundos parada. Quem procura "como
   * cancelar isto" abre o menu de três pontos.
   *
   * Diferente de `onDelete`: aquele apaga um resumo já salvo.
   */
  onDiscard?: () => void;
  /**
   * A sessão foi escrita à mão? Só o NOME do item de excluir muda com isto.
   *
   * Aqui morava um `editHref`, e o "Editar o texto" que ele desenhava: era a
   * ação mais usada deste menu, no meio das mais raras, e virou um botão no
   * cabeçalho do `/summary` (ver `SavedSessionView`). Dois caminhos para a
   * mesma tela seria um a mais.
   */
  written?: boolean;
};

const REPROCESS_COST = COIN_COSTS.reprocessSummary;

export function SessionMenu({
  onEdit,
  onDelete,
  onReprocess,
  reprocessing,
  onReportHallucination,
  onDiscard,
  written = false,
}: SessionMenuProps) {
  const balance = useCoinsStore((s) => s.balance);
  const insufficient = balance !== null && balance < REPROCESS_COST;
  const reprocessDisabled = !onReprocess || reprocessing || insufficient;
  const hasLeadingItem = Boolean(onEdit || onReprocess);
  const hasItemAboveDiscard = hasLeadingItem || Boolean(onReportHallucination);
  const hasItemAboveDelete = hasItemAboveDiscard || Boolean(onDiscard);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-scriba-ink-mute transition-colors outline-none",
          "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        aria-label="Mais opções"
        // Alvo do passo "Transcrição e mais opções" do tour do resumo salvo. O
        // mesmo menu aparece na tela de gravação, que não tem tour nenhum.
        data-tour="session-menu"
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
                ? `Gerar novamente (moedas insuficientes, custa ${REPROCESS_COST})`
                : `Gerar novamente (custa ${REPROCESS_COST} moedas)`
            }
          >
            <RefreshCw className={cn("size-4", reprocessing && "animate-spin")} />
            <span className="flex-1">{reprocessing ? "Gerando…" : "Gerar novamente"}</span>
            <span
              aria-hidden
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-scriba-yellow/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-scriba-gold-ink"
            >
              <span className="coin-hex block h-[9px] w-[8px] bg-scriba-yellow" />
              {REPROCESS_COST}
            </span>
          </DropdownMenuItem>
        ) : null}
        {/* Aqui morava o "Ler transcrição". A transcrição virou o SEGUNDO
            SLIDE do `/summary` (ver `SummaryDeck`), a um deslize do resumo, e
            um item de menu apontando para o que está ao lado na tela seria um
            segundo caminho para o mesmo lugar. */}
        {onReportHallucination ? (
          <>
            {hasLeadingItem ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onClick={onReportHallucination} className="gap-2">
              <TriangleAlert className="size-4" />
              Algo está errado
            </DropdownMenuItem>
          </>
        ) : null}
        {onDiscard ? (
          <>
            {hasItemAboveDiscard ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant="destructive" onClick={onDiscard} className="gap-2">
              <Trash2 className="size-4" />
              Descartar gravação
            </DropdownMenuItem>
          </>
        ) : null}
        {onDelete ? (
          <>
            {hasItemAboveDelete ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant="destructive" onClick={onDelete} className="gap-2">
              <Trash2 className="size-4" />
              {/* "Excluir resumo" seria errado no texto escrito à mão: ali não
                  há um resumo DE alguma coisa, o texto é a coisa. O mesmo item
                  apaga a mesma linha nos dois casos; só o nome muda, e ele
                  muda porque quem lê a tela chama aquilo de nomes diferentes. */}
              {written ? "Excluir este documento" : "Excluir resumo"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
