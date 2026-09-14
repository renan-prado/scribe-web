"use client";

import { type ReactNode, useState } from "react";
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

const log = createLogger("confirm-dialog");

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  /**
   * Cor do botão de confirmação. O padrão é `destructive` porque o diálogo
   * nasceu para excluir, mas ele também confirma uma ação CARA (gerar o resumo
   * de uma transcrição, que debita moedas), e vermelho ali anunciaria perigo
   * onde só há preço.
   */
  confirmVariant?: "destructive" | "default";
  /** Runs on confirm. If it returns a promise, the confirm button shows a
   * pending state until it settles; a thrown error just clears the pending
   * state and leaves the dialog open (the handler should surface its own toast). */
  onConfirm: () => void | Promise<void>;
};

/**
 * Minimal confirmation dialog for an action worth a second thought, destrutiva
 * por padrão, ou apenas cara (ver `confirmVariant`). Both CTAs live in the footer;
 * the close (X) affordance is hidden so the only ways out are Cancelar or
 * confirm. While the confirm handler is in flight the dialog can't be
 * dismissed.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmVariant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      // FECHA no sucesso. Até aqui quem fechava era o `router.push` de cada
      // chamador, e por isso nenhum deles fechava de propósito: todos saíam da
      // página logo depois de confirmar. O primeiro que FICA (apagar uma
      // gravação pendente, em `/recording`) revelou que o diálogo nunca
      // soube se fechar sozinho — o botão apagava a gravação e a caixa
      // continuava lá, parecendo que nada aconteceu.
      onOpenChange(false);
    } catch (err) {
      // Continua aberto para uma nova tentativa; o handler mostra o próprio
      // aviso (é o contrato descrito em `onConfirm`). O log existe para o erro
      // não sumir junto com a exceção.
      log.warn("confirm failed", { title, error: String(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" variant={confirmVariant} disabled={pending} onClick={handleConfirm}>
            {pending ? (pendingLabel ?? "Excluindo…") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
