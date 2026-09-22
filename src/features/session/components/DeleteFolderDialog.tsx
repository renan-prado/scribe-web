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
 */
export type DeleteFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  sessionCount: number;
  onConfirm: (deleteSessions: boolean) => Promise<void> | void;
};

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  sessionCount,
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
          <DialogDescription>
            {sessionCount > 0
              ? `Esta pasta tem ${sessionCount} ${sessionCount === 1 ? "sessão" : "sessões"}. O que fazer com ${
                  sessionCount === 1 ? "ela" : "elas"
                }?`
              : "Esta pasta está vazia."}
          </DialogDescription>
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
