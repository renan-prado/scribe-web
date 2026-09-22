import type { DragEvent } from "react";

/**
 * Arrastar um cartão da Biblioteca até uma pasta, no DESKTOP.
 *
 * Um `dataTransfer` de tipo próprio, e não o padrão `text/plain` que um link
 * carregaria sozinho: soltar um cartão sobre a barra de endereço ou sobre
 * outro app não deve funcionar como se fosse um link comum, e um MIME
 * inventado é o que faz um alvo que não seja pasta simplesmente ignorar o
 * gesto.
 *
 * Isto é só o requisito de PRODUTO "arrastar no desktop" (ver `tasks/task-22.md`
 * §Prod). A via de teclado é a mesma coisa que resolve o celular, onde não há
 * arrastar: "Mover para pasta" no menu do resumo aberto (`SessionMenu` →
 * `MoveToFolderDialog`).
 */
export const SESSION_DRAG_MIME = "application/x-scriba-session-id";

export function sessionDragProps(sessionId: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(SESSION_DRAG_MIME, sessionId);
      e.dataTransfer.effectAllowed = "move";
    },
  } as const;
}

export function readSessionDragId(e: DragEvent): string | null {
  if (!e.dataTransfer.types.includes(SESSION_DRAG_MIME)) return null;
  return e.dataTransfer.getData(SESSION_DRAG_MIME) || null;
}

/** Para `onDragOver`: `getData` é bloqueado nesse evento por segurança do
 *  navegador, só `types` está disponível — o bastante para decidir se o alvo
 *  aceita o gesto (`preventDefault`) antes de o `drop` acontecer. */
export function isSessionDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(SESSION_DRAG_MIME);
}
