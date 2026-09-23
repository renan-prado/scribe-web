"use client";

import { create } from "zustand";

/**
 * O estado da busca GLOBAL: só o `open`, e nada do que se digita dentro dela.
 *
 * Ele é uma store e não um `SearchScope` de contexto porque quem abre a busca
 * não está mais só dentro da árvore da Biblioteca — o gatilho mora na
 * `MobileActionBar` (`/home`, `/summary`, `/escrever`), no chip da `TopBar`
 * (desktop) e no atalho Ctrl+K, escutado dentro do próprio
 * `GlobalSearchDialog`. Um `Provider` teria de subir até o layout de
 * `(barra)` de qualquer jeito; a store evita o Provider e deixa qualquer
 * botão, em qualquer galho da árvore, abrir a MESMA busca.
 *
 * Zustand, o mesmo padrão do `useCoinsStore`: estado pequeno, lido por
 * componentes que não têm por que estar na mesma sub-árvore.
 */
type GlobalSearchState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useGlobalSearchStore = create<GlobalSearchState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
