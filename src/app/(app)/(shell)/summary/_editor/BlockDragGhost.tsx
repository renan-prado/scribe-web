"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * # A prévia do bloco que está sendo arrastado
 *
 * O arrastar do NAVEGADOR desenha um bitmap translúcido do elemento, e é isso
 * que quase todo site mostra. Aqui não há como usá-lo — o gesto é de ponteiro,
 * não de `dragstart` (ver `useBlockDrag`) —, e a troca é boa: em vez de uma
 * fotografia apagada que o sistema tira e nós não escolhemos, a prévia é um nó
 * do DOM, com a largura do bloco de origem, o tom de superfície do produto, uma
 * sombra que o levanta da página e uma inclinação de grau e meio, que é o que
 * faz um cartão parecer NA MÃO em vez de colado na tela.
 *
 * ## Ela é um CLONE, e o clone precisa de um conserto
 *
 * O conteúdo sai de `cloneNode(true)` sobre a caixa de verdade, e não de um
 * cartão montado à parte com o tipo e as primeiras palavras: uma passagem
 * bíblica com sete versículos, uma frase de destaque com a faixa amarela e um
 * bloco de Informação com o rótulo são coisas que só se reconhecem pela cara
 * delas. O que se arrasta tem de ser o que se vê.
 *
 * **O conserto é que `cloneNode` não copia o que a pessoa digitou.** O texto de
 * uma `textarea` (e de um `input`) é PROPRIEDADE do nó, não atributo: um clone
 * cru vem com todas as caixas do editor vazias, e a prévia de um parágrafo
 * seria um retângulo em branco. Cada caixa do clone é trocada por uma `div` com
 * a mesma classe, o mesmo texto e a mesma altura — o que estava escrito, como
 * estava escrito, sem ser editável.
 *
 * A altura vem do `offsetHeight` da caixa VIVA, e não do conteúdo: as caixas
 * deste editor têm altura escrita à mão pela `AutoTextarea`, e um parágrafo de
 * seis linhas remontado do zero quebraria noutro lugar.
 *
 * ## `aria-hidden`, e sem eventos
 *
 * Ela é a sombra de um bloco que continua na página, apagado, e existe por dois
 * quadros. Anunciá-la leria o texto duas vezes; deixá-la receber o ponteiro
 * poria o alvo do arrasto debaixo do próprio arrasto.
 */

/**
 * O clone com as caixas de texto achatadas. Ver "Ela é um CLONE" acima.
 */
function flatten(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  // A superfície do bloco tem margem NEGATIVA (`BLOCK_SURFACE`), que é o que a
  // faz avançar para fora da coluna de texto. Dentro da prévia isso puxaria o
  // conteúdo para fora dela.
  clone.style.margin = "0";

  const live = source.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>("textarea,input");
  const copied = clone.querySelectorAll("textarea,input");
  copied.forEach((node, i) => {
    const field = live[i];
    if (!field) {
      node.remove();
      return;
    }
    const flat = document.createElement("div");
    flat.className = node.className;
    flat.style.whiteSpace = "pre-wrap";
    flat.style.overflow = "hidden";
    flat.style.height = `${field.offsetHeight}px`;
    if (field.value) {
      flat.textContent = field.value;
    } else {
      // Um bloco vazio também se arrasta, e um retângulo sem nada dentro não
      // diz qual dos vazios é. O rascunho dele responde isso.
      flat.textContent = field.placeholder;
      flat.style.opacity = "0.45";
    }
    node.replaceWith(flat);
  });

  return clone;
}

export function BlockDragGhost({
  source,
  width,
  elementRef,
}: {
  source: HTMLElement;
  width: number;
  /** Quem move a prévia é o `transform`, escrito direto. Ver `useBlockDrag`. */
  elementRef: (el: HTMLElement | null) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const slot = host.current;
    if (!slot) return;
    slot.replaceChildren(flatten(source));
    return () => slot.replaceChildren();
  }, [source]);

  return createPortal(
    <div
      ref={elementRef}
      aria-hidden
      style={{ width }}
      className="pointer-events-none fixed top-0 left-0 z-50 rotate-[1.5deg] rounded-[20px] bg-scriba-surface opacity-95 shadow-[0_18px_44px_var(--scriba-shadow)] ring-1 ring-scriba-hairline ring-inset"
    >
      <div ref={host} />
    </div>,
    document.body
  );
}
