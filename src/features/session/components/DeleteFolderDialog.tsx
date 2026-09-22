"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";

const log = createLogger("delete-folder-dialog");

/**
 * Excluir uma pasta pede uma segunda decisão que o `ConfirmDialog` não tem
 * vocabulário para fazer: o que acontece com o que estava DENTRO dela. Duas
 * opções, mutuamente exclusivas, e a primeira é o padrão — apagar sessão é
 * ação rara e cara de desfazer; mover para a raiz não perde nada, só desfaz a
 * organização.
 *
 * **As SUBPASTAS vão sempre, e a escolha não as alcança.** `parent_id` é
 * `on delete cascade` (migração 0069): não há "apagar esta e manter as filhas",
 * porque uma subpasta sem mãe não teria por onde ser alcançada na tela. Daí o
 * `subfolderCount` ser um AVISO no texto e não uma terceira opção — e daí
 * `sessionCount` contar a subárvore inteira, não só o primeiro nível: a
 * pergunta "o que fazer com elas?" tem de valer para tudo que o gesto alcança.
 */
export type DeleteFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  /** As sessões da SUBÁRVORE, não só as do primeiro nível. */
  sessionCount: number;
  /** Quantas subpastas somem por cascata junto com esta. */
  subfolderCount?: number;
  onConfirm: (deleteSessions: boolean) => Promise<void> | void;
};

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  sessionCount,
  subfolderCount = 0,
  onConfirm,
}: DeleteFolderDialogProps) {
  const [deleteSessions, setDeleteSessions] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm(deleteSessions);
      onOpenChange(false);
    } catch (err) {
      log.warn("delete folder failed", { error: String(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
          if (next) setDeleteSessions(false);
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir “{folderName}”?</DialogTitle>
          <DialogDescription>{describe(sessionCount, subfolderCount)}</DialogDescription>
        </DialogHeader>

        {sessionCount > 0 ? (
          <div className="flex flex-col gap-2">
            <OptionRow
              label="Mover para a raiz"
              description="As sessões continuam na Biblioteca, sem pasta."
              selected={!deleteSessions}
              onSelect={() => setDeleteSessions(false)}
            />
            <OptionRow
              label="Excluir também as sessões"
              description="O conteúdo é apagado permanentemente, junto com a pasta."
              selected={deleteSessions}
              onSelect={() => setDeleteSessions(true)}
              destructive
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleConfirm}>
            {pending ? "Excluindo…" : "Excluir pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A frase do cabeçalho. Ela diz o ALCANCE do gesto antes de perguntar o que
 *  fazer com o conteúdo: com subpastas, "esta pasta está vazia" seria verdade
 *  sobre o primeiro nível e mentira sobre o que vai ser apagado. */
function describe(sessions: number, subfolders: number): string {
  const subPart =
    subfolders > 0
      ? `${subfolders} ${subfolders === 1 ? "subpasta" : "subpastas"} ${
          subfolders === 1 ? "também será apagada" : "também serão apagadas"
        }.`
      : "";
  if (sessions === 0) {
    return subPart ? `Sem resumos dentro. ${subPart}` : "Esta pasta está vazia.";
  }
  const scope = subfolders > 0 ? "Ela e as subpastas têm" : "Esta pasta tem";
  const noun = sessions === 1 ? "resumo" : "resumos";
  const pronoun = sessions === 1 ? "ele" : "eles";
  return `${scope} ${sessions} ${noun}. O que fazer com ${pronoun}? ${subPart}`.trim();
}

function OptionRow({
  label,
  description,
  selected,
  onSelect,
  destructive,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    // Rádio de verdade (`sr-only`), não um `<button role="radio">`: é
    // exatamente o que a semântica nativa já resolve — grupo exclusivo,
    // navegação por seta, leitor de tela anunciando "1 de 2".
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
        selected
          ? destructive
            ? "border-destructive/60 bg-destructive/10"
            : "border-scriba-blue/60 bg-scriba-blue-soft/40"
          : "border-scriba-hairline hover:bg-scriba-blue-soft/20"
      )}
    >
      <input
        type="radio"
        name="delete-folder-mode"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected
            ? destructive
              ? "border-destructive bg-destructive"
              : "border-scriba-blue bg-scriba-blue"
            : "border-scriba-ink-mute"
        )}
      >
        {selected ? <Check className="size-2.5 text-white" strokeWidth={3} /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-[13px] font-medium",
            destructive && selected ? "text-destructive" : "text-scriba-ink"
          )}
        >
          {label}
        </span>
        <span className="text-[12px] font-light text-scriba-ink-soft">{description}</span>
      </span>
    </label>
  );
}
