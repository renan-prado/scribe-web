"use client";

import { useEffect } from "react";

/**
 * Mede o teclado virtual e escreve a altura dele em `--kb-inset`, no `<html>`.
 *
 * **Nenhuma das duas plataformas resolve isto sozinha**, e é por isso que o
 * hook existe em vez de uma linha de CSS:
 *
 * - **Chrome/Android**, no padrão (`interactive-widget=resizes-visual`), não
 *   encolhe o viewport de LAYOUT quando o teclado abre. Um `fixed bottom-0`
 *   continua colado no fundo da página — ou seja, atrás do teclado.
 * - **iOS Safari** faz a mesma coisa e não entende `interactive-widget`, então
 *   nem a mudança no `viewport` do `app/layout.tsx` o alcançaria.
 *
 * A conta é robusta aos dois modos de viewport, e é isso que dispensa qualquer
 * `if` de plataforma: sem `resizes-content`, `innerHeight` fica cheio e o
 * `visualViewport` encolhe, então a diferença É a altura do teclado; com
 * `resizes-content`, os dois encolhem juntos, a diferença dá ~0 — e não precisa
 * dar outra coisa, porque ali o layout inteiro já subiu.
 *
 * Quem consome escreve, no `bottom`:
 *
 *     calc(1.25rem + max(env(safe-area-inset-bottom), var(--kb-inset, 0px)))
 *
 * **`max()` e não soma**: com o teclado aberto, a faixa do gesto do iPhone está
 * COBERTA por ele, e somar os dois empurraria o botão para o meio da tela.
 *
 * O hook mora em `shared/` porque o problema não é do Biblo: o `CreateDock` e o
 * `AdminMenu` somem atrás de um teclado exatamente do mesmo jeito. Hoje isso
 * não aparece porque nenhuma das duas telas tem campo de texto para abri-lo.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Arredonda: o `visualViewport` devolve fração de pixel durante a
      // animação de abertura, e escrever uma custom property a cada quadro
      // com 13 casas decimais é recalcular estilo sem nada mudar na tela.
      root.style.setProperty("--kb-inset", `${Math.round(inset)}px`);
    };

    update();
    vv.addEventListener("resize", update);
    // `scroll` do visual viewport: no iOS, rolar com o teclado aberto move o
    // `offsetTop`, e sem isto o botão desencosta do teclado no meio do gesto.
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb-inset");
    };
  }, []);
}
