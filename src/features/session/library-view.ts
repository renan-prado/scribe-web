"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Como a Biblioteca desenha o acervo. Escolha da PESSOA, guardada no aparelho.
 *
 * ## Por que existem três, e não um
 *
 * O mural de post-its é o desenho do produto: cor por sessão, alturas
 * escalonadas, cara de anotação em vez de lista de resultados. Ele funciona
 * para quem tem vinte sermões e olha a parede toda de uma vez, e trabalha
 * contra quem tem duzentos e está PROCURANDO — ali o escalonamento vira ruído,
 * a ordem coluna-a-coluna atrapalha, e quatro cores piscando não ajudam a
 * varrer títulos.
 *
 * - `postit`: o mural, o padrão, o que o produto sempre teve.
 * - `list`: uma linha por sermão, título, trecho e data. É a varredura.
 * - `card`: uma GRADE de cartões iguais — mesma altura, mesma largura, mesmo
 *   cinza. É o meio termo: preserva a ordem cronológica linha a linha, que o
 *   masonry não preserva, e ainda mostra o trecho.
 *
 * ## Por que no `localStorage`, e não no banco
 *
 * É preferência de APARELHO, não de conta: a mesma pessoa quer o mural no
 * celular e a lista no monitor, e uma coluna no banco daria a ela uma escolha
 * só para os dois. Também não vale uma ida ao servidor nem uma coluna nova
 * numa tabela que nada mais consulta por isso.
 *
 * ## O primeiro quadro é SEMPRE o padrão
 *
 * O HTML do servidor não sabe o que está guardado neste navegador, então ler o
 * `localStorage` durante o render faria o cliente desenhar uma coisa e o
 * servidor outra: divergência de hidratação, e o React descarta a árvore
 * inteira. O valor guardado entra num efeito, um quadro depois — o mesmo
 * caminho que a lista do acervo já percorre (ver `LibraryBrowser`).
 */
export const LIBRARY_VIEWS = ["postit", "list", "card"] as const;

export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export const DEFAULT_LIBRARY_VIEW: LibraryView = "postit";

const STORAGE_KEY = "scriba:library-view";

function isView(value: unknown): value is LibraryView {
  return typeof value === "string" && (LIBRARY_VIEWS as readonly string[]).includes(value);
}

export function useLibraryView(): [LibraryView, (view: LibraryView) => void] {
  const [view, setView] = useState<LibraryView>(DEFAULT_LIBRARY_VIEW);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isView(saved)) setView(saved);
    } catch {
      // Aba anônima, cota, navegador que bloqueia armazenamento. O padrão vale.
    }
  }, []);

  const choose = useCallback((next: LibraryView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A escolha vale para esta sessão de tela mesmo sem poder ser guardada.
    }
  }, []);

  return [view, choose];
}
