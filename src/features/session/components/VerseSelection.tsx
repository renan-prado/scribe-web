"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSummaryInsert } from "@/features/session/components/SummaryInsertContext";
import type { TranslationId } from "@/lib/bibles/translations";
import { formatPassageRange } from "@/lib/domain/reference";
import { cn } from "@/lib/utils";

/**
 * ESCOLHER versículos no meio de um capítulo e mandá-los para o resumo.
 *
 * O capítulo inteiro já ia com um botão, e era o único tamanho possível: quem
 * queria três versículos de Atos 16 levava os quarenta. O gesto que faltava é o
 * de qualquer app de Bíblia — segurar um versículo, ver as caixas aparecerem,
 * tocar nas que interessam.
 *
 * ## Por que o modo NASCE de um toque longo, e não de um botão sempre aceso
 *
 * Ler é o que se faz aqui noventa e nove vezes em cem, e uma coluna de caixas
 * permanente cobraria de toda leitura o preço de uma escrita rara. O toque
 * longo é o vocabulário que o celular já tem para "quero fazer algo com isto",
 * e não ocupa pixel nenhum enquanto ninguém o usa. Para o desktop — onde
 * segurar o botão do mouse não é gesto que se descubra sozinho — cada tela
 * acende um "Selecionar versículos" ao lado do botão que já tinha.
 *
 * ## Faixas CONTÍGUAS, e não uma referência por versículo
 *
 * Escolher 3, 4, 5 e 12 vira "Atos 16:3-5" e "Atos 16:12", dois blocos, e não
 * quatro. Um bloco por versículo transformaria um gesto num muro de cartões, e
 * a referência de uma pregação é a FAIXA, que é como quem ouviu vai procurá-la
 * depois. A quebra é literal: onde a numeração pula, o bloco acaba.
 *
 * **Os dois entram numa escrita só** (`addPassages`). Chamar o "adicionar" duas
 * vezes seguidas dispararia dois `POST` sobre o mesmo documento, e a ordem em
 * que eles chegam ao banco não é a ordem em que saíram — o segundo a chegar
 * grava a versão dele por cima, e um dos blocos some sem erro nenhum na tela.
 *
 * ## A tradução só viaja junto quando foi ESCOLHIDA
 *
 * `translation` aqui é a do TOQUE na pastilha, não a de quem lê. Gravar a
 * preferência no bloco a congelaria: o resumo passaria a citar Almeida para
 * sempre porque alguém leu em Almeida uma vez, e a preferência de quem abrisse
 * o texto depois deixaria de valer. Sem escolha explícita o bloco nasce sem
 * tradução, que é o que faz ele acompanhar quem lê. Ver `TranslationScope`.
 */
export type VerseSelection = {
  /** Há para onde inserir: fora de um `SummaryInsertProvider`, não há. */
  enabled: boolean;
  /** O modo está ligado, e as caixas estão na tela. */
  active: boolean;
  count: number;
  has: (verse: number) => boolean;
  /** O toque longo: liga o modo já com este versículo marcado. */
  begin: (verse: number) => void;
  toggle: (verse: number) => void;
  /** Liga o modo sem marcar nada — o caminho do botão, para o desktop. */
  start: () => void;
  cancel: () => void;
  commit: () => void;
};

/** As faixas contíguas de um conjunto de números. `[3,4,5,12] → [[3,5],[12,12]]`. */
export function contiguousRanges(verses: Iterable<number>): Array<[number, number]> {
  const sorted = [...verses].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const n of sorted) {
    const last = ranges.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}

export function useVerseSelection({
  bookDisplay,
  chapter,
  translation,
  onCommitted,
}: {
  /** O livro e o capítulo QUE ESTÃO NA TELA. Nulos, não há o que selecionar. */
  bookDisplay: string | null;
  chapter: number | null;
  /** A tradução ESCOLHIDA no toque, ou nada. Ver o cabeçalho. */
  translation?: TranslationId;
  onCommitted?: () => void;
}): VerseSelection {
  const insert = useSummaryInsert();
  const [chosen, setChosen] = useState<Set<number> | null>(null);
  const enabled = insert !== null && bookDisplay !== null && chapter !== null;

  /**
   * O instante em que o toque longo ligou o modo.
   *
   * Soltar o dedo depois de um toque longo dispara um `click` no mesmo
   * elemento — que a essa altura já é a linha marcável —, e ele DESMARCARIA o
   * versículo que o gesto acabou de marcar. O sintoma seria "segurei, apareceu
   * marcado e desmarcou sozinho". A janela morta é o conserto; o único jeito
   * de errar nela é tocar duas vezes no mesmo versículo em menos de meio
   * segundo, que não é gesto de ninguém.
   */
  const bornAt = useRef(0);

  const cancel = () => setChosen(null);

  return {
    enabled,
    active: enabled && chosen !== null,
    count: chosen?.size ?? 0,
    has: (verse) => chosen?.has(verse) ?? false,
    begin: (verse) => {
      if (!enabled) return;
      bornAt.current = Date.now();
      setChosen(new Set([verse]));
    },
    start: () => {
      if (!enabled) return;
      setChosen(new Set());
    },
    toggle: (verse) => {
      if (Date.now() - bornAt.current < 500) return;
      setChosen((prev) => {
        if (!prev) return prev;
        const next = new Set(prev);
        if (next.has(verse)) next.delete(verse);
        else next.add(verse);
        return next;
      });
    },
    cancel,
    commit: () => {
      if (!insert || !bookDisplay || !chapter || !chosen || chosen.size === 0) return;
      const references = contiguousRanges(chosen).map(([from, to]) =>
        formatPassageRange(bookDisplay, chapter, from, to)
      );
      insert.addPassages(references, translation);
      cancel();
      onCommitted?.();
    },
  };
}

/**
 * O toque longo de um versículo, em pointer events para servir dedo e mouse
 * pelo mesmo caminho.
 *
 * **Ele CAI no primeiro arrasto**, e essa é a linha que separa "segurar" de
 * "rolar a tela": sem o cancelamento por movimento, toda rolagem que começasse
 * em cima de um versículo abriria o modo de seleção depois de meio segundo,
 * no meio da leitura.
 *
 * `onContextMenu` é barrado junto porque o Android dispara o menu de seleção de
 * texto no mesmo gesto, e ele apareceria por cima das caixas que acabaram de
 * nascer.
 */
function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  if (!enabled) return {};

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        // A vibração é o recibo do gesto: sem ela o dedo não sabe que pode
        // soltar, e quem está segurando segura mais um tanto. Nem todo
        // navegador a tem, e onde não tem o modo abre calado.
        navigator.vibrate?.(12);
        onLongPress();
      }, 420);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = from.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export { useLongPress };

/**
 * A barra do modo: o que está escolhido, o jeito de sair e o jeito de mandar.
 *
 * Ela ocupa o lugar do botão que ADICIONA O CAPÍTULO INTEIRO enquanto o modo
 * está ligado, e não se soma a ele: dois "adicionar ao resumo" na mesma tela,
 * um com o capítulo e outro com a escolha, é a pergunta "qual deles?" feita no
 * último toque do gesto.
 *
 * "Adicionar" nasce DESLIGADO com zero marcados, em vez de sumir: o botão
 * apagado é o que diz que falta escolher alguma coisa: um espaço vazio onde ele
 * estava deixaria a barra parecendo quebrada.
 */
export function VerseSelectionBar({
  selection,
  className,
}: {
  selection: VerseSelection;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {selection.count === 0
          ? "Toque nos versículos"
          : `${selection.count} ${selection.count === 1 ? "versículo" : "versículos"}`}
      </span>
      <span className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={selection.cancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={selection.count === 0} onClick={selection.commit}>
          <Plus className="size-3.5" />
          Adicionar ao resumo
        </Button>
      </span>
    </div>
  );
}
