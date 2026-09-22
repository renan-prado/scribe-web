import type { DragEvent } from "react";

/**
 * Arrastar até uma pasta, no DESKTOP. Duas cargas diferentes, dois MIME
 * próprios:
 *
 * - **um cartão da Biblioteca** (`SESSION_DRAG_MIME`), que move a SESSÃO;
 * - **um cartão de pasta** (`FOLDER_DRAG_MIME`), que move a PASTA para dentro
 *   da outra — é o que torna os três níveis da migração 0069 utilizáveis sem
 *   recriar pasta nenhuma.
 *
 * Tipos inventados, e não o padrão `text/plain` que um link carregaria
 * sozinho: soltar um cartão sobre a barra de endereço ou sobre outro app não
 * deve funcionar como se fosse um link comum, e um MIME próprio é o que faz um
 * alvo que não seja pasta simplesmente ignorar o gesto. Serem DOIS é o que
 * permite ao mesmo alvo aceitar as duas coisas e fazer coisas diferentes com
 * cada uma, em vez de um payload com um campo "tipo" dentro.
 *
 * A via de TECLADO é outra, e é a mesma que resolve o celular, onde não há
 * arrastar: "Mover para pasta" no menu do resumo aberto (`SessionMenu` →
 * `MoveToFolderDialog`) para a sessão, e "Editar pasta" (que escolhe a mãe)
 * para a pasta.
 */
export const SESSION_DRAG_MIME = "application/x-scriba-session-id";
export const FOLDER_DRAG_MIME = "application/x-scriba-folder-id";

export function sessionDragProps(sessionId: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(SESSION_DRAG_MIME, sessionId);
      e.dataTransfer.effectAllowed = "move";
    },
  } as const;
}

export function folderDragProps(folderId: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      // `stopPropagation` porque um cartão de pasta pode estar dentro de
      // outro alvo de arrastar amanhã, e dois `dataTransfer` no mesmo gesto
      // fariam o alvo ler a carga do ancestral.
      e.stopPropagation();
      e.dataTransfer.setData(FOLDER_DRAG_MIME, folderId);
      e.dataTransfer.effectAllowed = "move";
    },
  } as const;
}

export function readSessionDragId(e: DragEvent): string | null {
  if (!e.dataTransfer.types.includes(SESSION_DRAG_MIME)) return null;
  return e.dataTransfer.getData(SESSION_DRAG_MIME) || null;
}

export function readFolderDragId(e: DragEvent): string | null {
  if (!e.dataTransfer.types.includes(FOLDER_DRAG_MIME)) return null;
  return e.dataTransfer.getData(FOLDER_DRAG_MIME) || null;
}

/** Para `onDragOver`: `getData` é bloqueado nesse evento por segurança do
 *  navegador, só `types` está disponível — o bastante para decidir se o alvo
 *  aceita o gesto (`preventDefault`) antes de o `drop` acontecer. É também o
 *  motivo de o alvo não poder recusar o arrastar de uma pasta SOBRE ELA MESMA
 *  aqui: o id só aparece no `drop`. */
export function isSessionDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(SESSION_DRAG_MIME);
}

export function isFolderDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(FOLDER_DRAG_MIME);
}
