"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

/**
 * Single-field edit dialog used by the speaker AND location "Adicionar / Editar"
 * flows. Each field owns its own dialog instance so the combobox dropdown only
 * shows entries relevant to that field.
 *
 * `initialValue` should already be normalized (empty when the caller detected
 * a placeholder like "Autor desconhecido"), the dialog does not do any
 * placeholder scrubbing itself.
 *
 * ## O miolo NÃO rola, e isso é o conserto
 *
 * O `DialogContent` recorta o corpo com `overflow-y-auto`, o certo para um
 * diálogo de texto longo, e errado para este, cujo único filho abre uma lista
 * ABSOLUTA por fora de si. A lista estourava a caixa do corpo, virava barra de
 * rolagem numa faixa de ~60px de altura, e o diálogo inteiro se contorcia a
 * cada tecla digitada: era essa a "responsividade vertical esquisita".
 *
 * Por isso as duas classes abaixo. `overflow-visible` no popup E no corpo
 * (o popup também recorta, então só o corpo não bastaria) deixam a lista
 * transbordar; quem cuida da altura dela é o próprio `EntityCombobox`, que a
 * limita em `42dvh` e a vira para cima quando não há espaço embaixo. O teto de
 * `90dvh` fica de pé para o caso de o erro de salvamento aparecer junto com a
 * lista num aparelho baixo.
 */
type EntityFieldDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pessoa ou lugar, desce até a lista de sugestões. */
  kind: "speaker" | "location";
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
  kind,
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
      <DialogContent
        className="max-h-[90dvh] overflow-visible sm:max-w-sm"
        bodyClassName="overflow-visible"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <EntityCombobox
          kind={kind}
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
