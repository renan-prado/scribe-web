"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Renomeia uma sessão já salva. O save é assíncrono (PATCH na API), então o
 * botão fica em estado pendente até a resposta e a falha vira toast — a
 * variante do RecordingHeader é síncrona porque lá o título só vive no store
 * até o fim da gravação.
 */
export type TitleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  onSave: (value: string) => Promise<void> | void;
};

export function TitleDialog({ open, onOpenChange, initialValue, onSave }: TitleDialogProps) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);
  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o título.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar título</DialogTitle>
        </DialogHeader>
        <input
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          disabled={saving}
          autoFocus
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
            disabled={saving}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-full bg-scriba-blue px-5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,168,240,0.28)] transition-colors",
              "hover:bg-scriba-blue-hover",
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
