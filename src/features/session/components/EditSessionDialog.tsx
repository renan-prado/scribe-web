"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/features/session/components/EntityCombobox";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { normalizeLocationInput, normalizeSpeakerInput } from "@/features/session/lib/unknown";

type Fields = {
  title: string;
  speakerName: string;
  speakerLocation: string;
};

type EditSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Raw values from the session row. Placeholder labels ("Autor desconhecido",
   * etc) are stripped so the input opens blank instead of pre-filled. */
  initial: Fields;
  onSave: (fields: Fields) => Promise<void>;
};

export function EditSessionDialog({ open, onOpenChange, initial, onSave }: EditSessionDialogProps) {
  const [fields, setFields] = useState<Fields>(() => ({
    title: initial.title,
    speakerName: normalizeSpeakerInput(initial.speakerName),
    speakerLocation: normalizeLocationInput(initial.speakerLocation),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(fields);
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar sermão</DialogTitle>
          <DialogDescription>Ajuste o título, pregador e local.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="edit-title">
              Título
            </label>
            <input
              id="edit-title"
              className={inputClass}
              value={fields.title}
              onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
              placeholder="Título do sermão"
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="edit-speaker">
              Pregador
            </label>
            <EntityCombobox
              id="edit-speaker"
              value={fields.speakerName}
              onChange={(v) => setFields((f) => ({ ...f, speakerName: v }))}
              placeholder="Nome do pregador"
              disabled={saving}
              fetchSuggestions={requestSpeakerSuggestions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="edit-location">
              Local
            </label>
            <EntityCombobox
              id="edit-location"
              value={fields.speakerLocation}
              onChange={(v) => setFields((f) => ({ ...f, speakerLocation: v }))}
              placeholder="Igreja ou local"
              disabled={saving}
              fetchSuggestions={requestLocationSuggestions}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
