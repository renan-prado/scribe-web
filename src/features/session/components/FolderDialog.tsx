"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_COLORS, type FolderColor } from "@/lib/domain/folder";
import { cn } from "@/lib/utils";

/**
 * Nome e cor de uma pasta, criação e renomeação no mesmo diálogo — a mesma
 * decisão do `TitleDialog`: o valor inicial vazio É o modo de criação, sem um
 * `mode` separado para os dois casos dizerem a mesma coisa duas vezes.
 */
export type FolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialColor?: FolderColor | null;
  onSave: (name: string, color: FolderColor) => Promise<void> | void;
};

/** As quatro faces do post-it, na MESMA ordem que `PostItNote.NOTES` — é o
 *  mesmo par bg/ink que pinta o mural, então uma pasta "lemon" e um post-it
 *  sorteado "lemon" precisam ler como a mesma cor. */
const SWATCHES: Record<FolderColor, { bg: string; ring: string; ink: string }> = {
  mist: { bg: "bg-v2-note-mist", ring: "ring-v2-note-mist-ink", ink: "text-v2-note-mist-ink" },
  sage: { bg: "bg-v2-note-sage", ring: "ring-v2-note-sage-ink", ink: "text-v2-note-sage-ink" },
  slate: { bg: "bg-v2-note-slate", ring: "ring-v2-note-slate-mute", ink: "text-v2-note-slate-ink" },
  lemon: { bg: "bg-v2-note-lemon", ring: "ring-v2-note-lemon-ink", ink: "text-v2-note-lemon-ink" },
};

export function FolderDialog({
  open,
  onOpenChange,
  initialName = "",
  initialColor,
  onSave,
}: FolderDialogProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<FolderColor>(initialColor ?? FOLDER_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor ?? FOLDER_COLORS[0]);
    }
  }, [open, initialName, initialColor]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed, color);
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
        <div className="flex items-center gap-3 pt-1">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={color === c}
              disabled={saving}
              onClick={() => setColor(c)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full outline-none transition-transform",
                SWATCHES[c].bg,
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                color === c ? cn("ring-2 ring-offset-2 ring-offset-popover", SWATCHES[c].ring) : ""
              )}
            >
              {color === c ? (
                <Check className={cn("size-3.5", SWATCHES[c].ink)} strokeWidth={3} />
              ) : null}
            </button>
          ))}
        </div>
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
