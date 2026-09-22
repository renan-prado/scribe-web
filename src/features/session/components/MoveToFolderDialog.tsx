"use client";

import { Check, Folder as FolderIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FOLDER_SWATCH_BG, type Folder } from "@/lib/domain/folder";
import { cn } from "@/lib/utils";

/**
 * "Mover para pasta", pedida pela tela de LEITURA (`SessionMenu` →
 * `SavedSessionView`), onde não há como arrastar o cartão até uma pasta — é a
 * via de teclado e de celular que o arrastar (ver `folder-dnd.ts`) não
 * cobre, e a Biblioteca fica um toque de distância, não zero.
 *
 * Uma lista de radio-buttons disfarçados de linha, o mesmo desenho do
 * `DeleteFolderDialog`: cada linha é um `<button role="radio">`, e escolher
 * já move — não há um segundo "Confirmar", porque mover É a ação inteira
 * deste diálogo, ao contrário de excluir uma pasta, que ainda perguntaria o
 * destino do conteúdo.
 */
export type MoveToFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => Promise<void> | void;
};

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onMove,
}: MoveToFolderDialogProps) {
  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined);

  async function pick(folderId: string | null) {
    if (pendingId !== undefined) return;
    setPendingId(folderId);
    try {
      await onMove(folderId);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível mover. Tente novamente.");
    } finally {
      setPendingId(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => pendingId === undefined && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mover para pasta</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          <Row
            label="Sem pasta"
            selected={currentFolderId === null}
            pending={pendingId === null}
            disabled={pendingId !== undefined}
            onClick={() => pick(null)}
            icon={<FolderIcon className="size-4 text-scriba-ink-mute" strokeWidth={1.75} />}
          />
          {folders.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12.5px] font-light text-scriba-ink-soft">
              Nenhuma pasta ainda. Crie uma na Biblioteca.
            </p>
          ) : (
            folders.map((f) => (
              <Row
                key={f.id}
                label={f.name}
                selected={currentFolderId === f.id}
                pending={pendingId === f.id}
                disabled={pendingId !== undefined}
                onClick={() => pick(f.id)}
                icon={
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      FOLDER_SWATCH_BG[f.color ?? "mist"]
                    )}
                  />
                }
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  selected,
  pending,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-scriba-ink outline-none transition-colors",
        "hover:bg-scriba-blue-soft/50 focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected && "bg-scriba-blue-soft/60"
      )}
    >
      {icon}
      <span className="flex-1 truncate">{pending ? "Movendo…" : label}</span>
      {selected ? <Check className="size-4 text-scriba-blue-ink" strokeWidth={2.5} /> : null}
    </button>
  );
}
