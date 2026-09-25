"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Fechar uma gaveta que é ROTA: o "X", o Esc e o toque no fundo.
 *
 * ## `back()`, e não `push` nem `replace`
 *
 * A gaveta foi ABERTA com um `push` (é um `<Link>`), então o voltar do sistema
 * já a fecha sozinho — é de graça, e é a razão principal de ela ser uma rota.
 * Fechar pelo "X" tem de fazer a MESMA coisa, ou o histórico e a tela contam
 * histórias diferentes:
 *
 * - `push(pai)` empilha `/home` de novo, e o voltar REABRE a busca que a
 *   pessoa acabou de fechar.
 * - `replace(pai)` não reabre, mas deixa uma entrada morta a cada abre-fecha.
 *   Cinco consultas à busca viram cinco toques no voltar do Android para sair
 *   da Biblioteca, sem nada mudando na tela no caminho.
 *
 * `back()` desfaz exatamente o `push` que abriu, e o histórico fica do
 * tamanho que estava.
 *
 * ## O `pai` é para quando não há de onde voltar
 *
 * `/home/search` colado na barra de endereço, ou apontado pelo aplicativo num
 * carregamento duro, é a primeira entrada do histórico: ali `back()` sairia do
 * site (dentro do WebView, FECHA o aplicativo — é o mesmo defeito que o
 * `backHref` do `/profile` conserta). `history.length <= 1` é o sinal de que
 * não há para onde voltar, e aí a saída é trocar a entrada pela tela de baixo.
 */
export function useOverlayClose(parentHref: string) {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.replace(parentHref);
  }, [router, parentHref]);
}
