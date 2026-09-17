"use client";

import { Check, Copy, Plus } from "lucide-react";
import { type RefObject, useCallback, useEffect, useState } from "react";

/**
 * A barrinha que aparece sobre um TRECHO SELECIONADO da conversa: leva para o
 * resumo, ou copia.
 *
 * ## Por que selecionar, se já existem o "+" e a oferta
 *
 * Porque os dois trabalham em unidades que alguém escolheu por você. O "+" leva
 * a passagem inteira; a `offer` leva a resposta inteira, reescrita pelo modelo.
 * O que não tinha caminho era o pedaço: a frase do meio do segundo parágrafo, a
 * definição de três linhas dentro de uma explicação de dez. Sem isto, esse
 * pedaço só sai daqui por copiar e colar — e quem copia e cola sai do produto
 * para voltar a ele.
 *
 * É também o gesto que o texto já convida: um parágrafo selecionável com um
 * menu do sistema por cima que só sabe copiar é uma promessa pela metade.
 *
 * ## Copiar está aqui, e com o mesmo peso
 *
 * A mesma razão do `CopyButton` da resposta: nem tudo vira bloco. O trecho vai
 * para o caderno, para o WhatsApp do grupo, para um slide. Fazer do copiar o
 * caminho de segunda classe é empurrar para dentro do texto o que a pessoa
 * queria levar para fora.
 *
 * ## Três detalhes que não são detalhe
 *
 * **`preventDefault` no `pointerdown` da barra.** Sem ele, encostar num botão
 * desfaz a seleção antes de o `click` acontecer, e o botão age sobre um trecho
 * que não existe mais. É o motivo de a barra nunca receber foco.
 *
 * **A rolagem FECHA a barra.** A posição é medida uma vez, em coordenadas de
 * tela; a lista rola por baixo e a barra ficaria apontando para o lugar errado.
 * Refazer a conta a cada quadro de rolagem seria trabalho para manter na tela
 * algo que a pessoa deixou de olhar.
 *
 * **Ela é `fixed`, acima da gaveta (z-50 contra o z-40 dela).** A gaveta ocupa
 * o rodapé inteiro, e uma barra dentro do fluxo dela seria cortada pela própria
 * rolagem da conversa, que é justamente onde o texto está.
 */

/**
 * Menos que isto não é um trecho, é um toque que arrastou.
 *
 * O texto da conversa é selecionável e o dedo esbarra nele o tempo todo; sem um
 * piso, a barra pisca por cima de duas letras a cada rolagem malsucedida.
 */
const MIN_SELECTION_CHARS = 12;

type Spot = { text: string; top: number; left: number; below: boolean };

export function BibloSelection({
  listRef,
  onAdd,
}: {
  listRef: RefObject<HTMLElement | null>;
  /** `undefined` na tela que não sabe editar: sobra o copiar, que serve sempre. */
  onAdd?: (text: string) => void;
}) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [copied, setCopied] = useState(false);

  const dismiss = useCallback(() => {
    setSpot(null);
    setCopied(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    function read() {
      const list = listRef.current;
      const selection = window.getSelection();
      if (!list || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSpot(null);
        return;
      }
      const range = selection.getRangeAt(0);
      // Só o que foi selecionado DENTRO da conversa. Uma seleção na página
      // atrás da gaveta não tem nada a ver com o Biblo.
      if (!list.contains(range.commonAncestorContainer)) {
        setSpot(null);
        return;
      }
      const text = selection.toString().trim();
      if (text.length < MIN_SELECTION_CHARS) {
        setSpot(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSpot(null);
        return;
      }
      // Seleção que começa colada no topo não tem espaço acima: a barra desce
      // para baixo dela em vez de sair da tela.
      const below = rect.top < 72;
      setSpot({
        text,
        top: below ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2,
        below,
      });
      setCopied(false);
    }

    function clearIfGone() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setSpot(null);
    }

    const list = listRef.current;
    document.addEventListener("pointerup", read);
    document.addEventListener("keyup", read);
    document.addEventListener("selectionchange", clearIfGone);
    list?.addEventListener("scroll", dismiss);
    return () => {
      document.removeEventListener("pointerup", read);
      document.removeEventListener("keyup", read);
      document.removeEventListener("selectionchange", clearIfGone);
      list?.removeEventListener("scroll", dismiss);
    };
  }, [listRef, dismiss]);

  if (!spot) return null;

  return (
    <div
      // O `pointerdown` é engolido para a seleção sobreviver ao toque. Ver o
      // cabeçalho: sem isto o botão age sobre um trecho já desfeito.
      onPointerDown={(event) => event.preventDefault()}
      style={{
        top: spot.top,
        left: spot.left,
        transform: `translate(-50%, ${spot.below ? "0" : "-100%"})`,
      }}
      className="fixed z-50 flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full bg-scriba-ink p-1 shadow-[0_8px_24px_var(--scriba-shadow)]"
    >
      {onAdd && (
        <button
          type="button"
          onClick={() => {
            onAdd(spot.text);
            dismiss();
          }}
          // O rótulo é "Adicionar" e o nome acessível é inteiro: a barra é
          // estreita e nasce colada no trecho, então o "ao resumo" é o contexto
          // que o olho já tem e o leitor de tela não.
          aria-label="Adicionar o trecho ao resumo"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[12px] text-scriba-paper transition-colors hover:bg-scriba-paper/15"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={2} />
          Adicionar
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            .writeText(spot.text)
            .then(() => {
              setCopied(true);
              window.setTimeout(dismiss, 900);
            })
            // Área de transferência bloqueada: nada acontece, e a barra fica.
            // Um erro na tela para um copiar que falhou custa mais atenção do
            // que vale — mesma régua do `CopyButton` da resposta.
            .catch(() => {});
        }}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[12px] text-scriba-paper transition-colors hover:bg-scriba-paper/15"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5" strokeWidth={2} />
        ) : (
          <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
        )}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
