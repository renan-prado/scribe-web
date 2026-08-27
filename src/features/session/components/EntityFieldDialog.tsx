"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/features/session/components/EntityCombobox";
import type { EntitySuggestion } from "@/features/session/lib/api";

/**
 * Single-field edit dialog used by the speaker AND location "Adicionar / Editar"
 * flows. Each field owns its own dialog instance so the combobox dropdown only
 * shows entries relevant to that field.
 *
 * `initialValue` should already be normalized (empty when the caller detected
 * a placeholder like "Autor desconhecido") — the dialog does not do any
 * placeholder scrubbing itself.
 */
type EntityFieldDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  initialValue: string;
  fetchSuggestions: (q: string) => Promise<EntitySuggestion[]>;
  onSave: (value: string) => Promise<void> | void;
};

export function EntityFieldDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  initialValue,
  fetchSuggestions,
  onSave,
}: EntityFieldDialogProps) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <EntityCombobox
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          fetchSuggestions={fetchSuggestions}
          onEnter={handleSave}
          autoFocus
          disabled={saving}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
