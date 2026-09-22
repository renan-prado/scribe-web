"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * O NOME de uma pasta, criação e renomeação no mesmo diálogo — a mesma decisão
 * do `TitleDialog`: o valor inicial vazio É o modo de criação, sem um `mode`
 * separado para os dois casos dizerem a mesma coisa duas vezes.
 *
 * ## A COR saiu, e o diálogo é um campo de texto
 *
 * Ele teve um seletor de quatro faces (`--v2-note-*`, as mesmas do post-it) e
 * ele foi removido. Escolher cor é uma decisão que o produto pedia e não usava:
 * a pasta não é um post-it — ela não mora num mural de cores sorteadas, mora
 * numa grade de cartões cinzas iguais, onde a cor entrava só como a tinta de um
 * ícone de 20px. Ali quatro opções compravam um enfeite e cobravam um passo,
 * no único diálogo do produto que existe para receber uma palavra e sair da
 * frente.
 *
 * Duas consequências que valem ser ditas em voz alta:
 *
 * - **a coluna `folders.color` continua no banco** (migração 0068) e a API
 *   continua aceitando `color`, opcional. Nada na tela a manda, e nada a lê
 *   além do `?? "mist"` de `FOLDER_ICON_INK`. É o seam por onde a cor volta se
 *   um dia ela tiver trabalho a fazer, e não vale uma migração para derrubar.
 * - **o problema do `slate` deixou de existir por não ter mais onde
 *   aparecer.** Ele é `#2F3035`, a mesma cor de `--v2-card` e de `bg-popover`,
 *   e como pastilha de 28px dentro do diálogo lia como um buraco em vez de uma
 *   opção. A correção foi um fio de borda; a correção da correção foi tirar o
 *   seletor.
 */
export type FolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  /** A pasta mãe, quando a nova nasce DENTRO de outra. Vira a linha "Dentro
   *  de …" do cabeçalho: com três níveis, nada mais no diálogo diria em que
   *  altura da árvore a pasta está sendo criada, e descobrir errado custa um
   *  excluir e um criar de novo. */
  parentName?: string | null;
  onSave: (name: string) => Promise<void> | void;
};

export function FolderDialog({
  open,
  onOpenChange,
  initialName = "",
  parentName,
  onSave,
}: FolderDialogProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a pasta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initialName ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          {!initialName && parentName ? (
            <DialogDescription>Dentro de “{parentName}”.</DialogDescription>
          ) : null}
        </DialogHeader>
        <input
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Nome da pasta"
          disabled={saving}
          autoFocus
          maxLength={80}
        />
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-medium text-scriba-ink-soft transition-colors",
              "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/30",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-5 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] transition-colors",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30",
              "disabled:cursor-not-allowed disabled:opacity-70"
            )}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
