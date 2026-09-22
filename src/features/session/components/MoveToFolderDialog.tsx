"use client";

import { Check, Folder as FolderIcon, FolderMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FOLDER_ICON_INK, type Folder, flattenFolderTree } from "@/lib/domain/folder";
import { cn } from "@/lib/utils";

/** O recuo de cada nível, em classe LITERAL: o Tailwind não gera a regra de
 *  uma classe montada por template (`` `pl-${n}` ``), e a linha apareceria sem
 *  recuo nenhum, sem erro em lugar nenhum. */
const DEPTH_PADDING = ["pl-3", "pl-7", "pl-11"] as const;

/**
 * "Mover para pasta", pedida pela tela de LEITURA (`SessionMenu` →
 * `SavedSessionView`), onde não há como arrastar o cartão até uma pasta — é a
 * via de teclado e de celular que o arrastar (ver `folder-dnd.ts`) não
 * cobre, e a Biblioteca fica um toque de distância, não zero.
 *
 * Uma lista de linhas em que escolher JÁ move — não há um segundo
 * "Confirmar", porque mover É a ação inteira deste diálogo, ao contrário de
 * excluir uma pasta, que ainda perguntaria o destino do conteúdo.
 *
 * **Aqui a árvore aparece inteira, com recuo por nível** (`flattenFolderTree`),
 * e não um nível por vez como na grade da Biblioteca. São duas perguntas
 * diferentes: lá a pessoa está NAVEGANDO e o caminho está na migalha de pão;
 * aqui ela está ESCOLHENDO um destino, e um destino que exige três toques para
 * ser visto é um destino que ela não vai achar. Com o teto de três níveis a
 * lista achatada continua curta.
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
            /* `FolderMinus` e não o glifo de pasta: com a árvore desenhada
               abaixo, uma pasta cinza na primeira linha leria como mais uma
               pasta, só sem cor. */
            icon={<FolderMinus className="size-4 text-scriba-ink-mute" strokeWidth={1.75} />}
          />
          {folders.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12.5px] font-light text-scriba-ink-soft">
              Nenhuma pasta ainda. Crie uma na Biblioteca.
            </p>
          ) : (
            flattenFolderTree(folders).map(({ folder, depth }) => (
              <Row
                key={folder.id}
                label={folder.name}
                indent={DEPTH_PADDING[depth - 1] ?? DEPTH_PADDING[2]}
                selected={currentFolderId === folder.id}
                pending={pendingId === folder.id}
                disabled={pendingId !== undefined}
                onClick={() => pick(folder.id)}
                icon={
                  <FolderIcon
                    aria-hidden
                    strokeWidth={1.75}
                    className={cn("size-4 shrink-0", FOLDER_ICON_INK[folder.color ?? "mist"])}
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
  indent = "pl-3",
  selected,
  pending,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  indent?: string;
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
        "flex items-center gap-2.5 rounded-lg py-2.5 pr-3 text-left text-[13px] font-medium text-scriba-ink outline-none transition-colors",
        indent,
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
