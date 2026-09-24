"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * # Arrastar um bloco para outro lugar do texto
 *
 * As duas setas da pílula movem UMA casa por toque, e isso é o suficiente para
 * um ajuste e insuficiente para tudo o mais: pôr o terceiro parágrafo depois do
 * décimo custa sete cliques com o olho perseguindo o bloco tela abaixo. Este
 * gesto é a resposta para "mover", e as setas passam a ser a resposta para
 * "corrigir um vizinho" — e o caminho de quem usa teclado, que não se arrasta.
 *
 * ## Não é o arrastar do NAVEGADOR, e isso é a decisão central
 *
 * A API nativa (`draggable`, `dragstart`, `setDragImage`) tem uma prévia pronta
 * e um defeito que não tem conserto: **ela não existe no toque.** Nenhum
 * `dragstart` sai de um dedo, em nenhum navegador de celular — e o celular é
 * onde este produto é usado. Sobre eventos de PONTEIRO o mesmo código serve aos
 * dois, e a prévia deixa de ser um bitmap que o sistema desenha para virar um
 * nó do DOM que é nosso (ver `BlockDragGhost`).
 *
 * São dois gestos com a mesma consequência, cada um no aparelho em que ele é
 * natural:
 *
 * - **o PUNHO**, no rato: o grip que aparece na margem esquerda ao passar o
 *   mouse. Pegar e arrastar, como em toda lista da web.
 * - **PRESSIONAR E SEGURAR**, no dedo: não há margem esquerda no celular (é a
 *   mesma razão pela qual a pílula flutua acima do bloco, e não ao lado dele),
 *   e um punho de 16px seria um alvo menor que a metade do mínimo. Segurar a
 *   linha por `LONG_PRESS_MS` é o gesto que todo app de lista do telefone já
 *   ensinou.
 *
 * ## O que cancela a espera do toque, e por quê
 *
 * O dedo que ROLA a página pousa sobre uma linha exatamente como o dedo que
 * quer movê-la. A única diferença entre os dois é o MOVIMENTO, e é por isso que
 * a espera morre quando o dedo anda mais que `PRESS_SLOP`, ou quando ele sobe
 * antes da hora.
 *
 * **O que NÃO cancela é a página rolar**, e a tentação de usar isso custou uma
 * volta: tocar numa linha dá foco à caixa, o teclado do celular sobe e o
 * navegador rola a página para manter o cursor visível — ou seja, a rolagem
 * acontece justamente no primeiro toque de todo bloco, e a espera morria antes
 * de nascer em cima do gesto mais comum do editor. O movimento do dedo já
 * responde a mesma pergunta, e responde sem falso positivo.
 *
 * ## Enquanto arrasta, a rolagem é NOSSA
 *
 * `touch-action: none` é lido pelo navegador no início do gesto, e o nosso
 * começa 320ms depois — mudá-lo no meio não desfaz uma decisão já tomada. Quem
 * segura a página é um `touchmove` não-passivo com `preventDefault`, que
 * funciona porque um arrasto que nasce de pressionar e segurar nasce de um dedo
 * PARADO: não há rolagem em curso para cancelar.
 *
 * E como a página deixa de rolar sozinha, alguém tem de rolá-la: o laço de
 * quadro empurra o documento quando o ponteiro chega a `EDGE` pixels de uma das
 * bordas, que é o que permite arrastar um bloco para fora da tela em que ele
 * está.
 *
 * ## As contas são feitas UMA vez, e ficam em ref
 *
 * As caixas de todos os blocos são medidas no início do arrasto, em coordenadas
 * de PÁGINA (`+ scrollY`): nada muda de lugar durante o gesto — o bloco de
 * origem fica onde está, apagado — e coordenadas de página sobrevivem à rolagem
 * automática, que é a única coisa que se move.
 *
 * **A posição do ponteiro não é estado.** Um `setState` por `pointermove`
 * repintaria o documento inteiro sessenta vezes por segundo para mover uma
 * prévia; quem a move é uma escrita direta no `transform` dela (`ghostRef`). O
 * estado guarda só o que MUDA de verdade — o índice de destino e a linha que o
 * mostra —, e isso acontece quando o ponteiro cruza o meio de um bloco.
 */

/** Quanto tempo o dedo fica parado sobre a linha antes de ela se soltar. */
const LONG_PRESS_MS = 320;
/** O que o dedo pode andar nesse meio-tempo sem virar rolagem. */
const PRESS_SLOP = 10;
/** A faixa de cada borda da janela em que a página rola sozinha. */
const EDGE = 76;
/** A velocidade máxima dessa rolagem, em pixels por quadro. */
const EDGE_SPEED = 18;

export type BlockDrag = {
  /** De onde o bloco saiu. */
  from: number;
  /** Onde ele entra: um índice de INSERÇÃO, de 0 a `count`. */
  to: number;
  /** A largura da caixa de origem — a prévia tem o tamanho do que se arrasta. */
  width: number;
  /** A altura do vão onde ele vai cair, para o indicador ocupar o lugar dele. */
  indicatorTop: number;
};

type Options = {
  count: number;
  /**
   * Nada entra depois disto. É a CONCLUSÃO: ela fecha a folha, e a regra de que
   * nada vive abaixo do fecho (`insertionIndex`) não pode ser furada por um
   * gesto que não passa pelo menu. Sem conclusão, o teto é o fim da lista.
   */
  ceiling: number;
  canDrag: (index: number) => boolean;
  /** A caixa VISÍVEL do bloco (a superfície), que é o que se mede e se clona. */
  nodeAt: (index: number) => HTMLElement | null;
  /** O contêiner da lista, a que o indicador é relativo. */
  container: () => HTMLElement | null;
  onDrop: (from: number, to: number) => void;
  onStart?: () => void;
};

export function useBlockDrag(options: Options) {
  const [drag, setDrag] = useState<BlockDrag | null>(null);
  const [source, setSource] = useState<HTMLElement | null>(null);

  // O efeito que ouve a janela assina UMA vez por arrasto, e por isso não pode
  // fechar sobre props que mudam a cada render. Elas entram aqui.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const boxes = useRef<{ top: number; bottom: number }[]>([]);
  const containerTop = useRef(0);
  const grab = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });
  const from = useRef(-1);
  const to = useRef(-1);
  const ghost = useRef<HTMLElement | null>(null);
  const pending = useRef<(() => void) | null>(null);

  /** A prévia segue o ponteiro por `transform`, sem passar por render. */
  const place = useCallback(() => {
    const el = ghost.current;
    if (!el) return;
    el.style.transform = `translate3d(${pointer.current.x - grab.current.x}px, ${
      pointer.current.y - grab.current.y
    }px, 0)`;
  }, []);

  const ghostRef = useCallback(
    (el: HTMLElement | null) => {
      ghost.current = el;
      // A primeira posição é escrita ANTES do primeiro quadro: sem isto a
      // prévia nasce na quina superior esquerda e salta para o dedo.
      if (el) place();
    },
    [place]
  );

  const insertionFor = useCallback((pageY: number) => {
    const all = boxes.current;
    let index = all.length;
    for (let i = 0; i < all.length; i++) {
      if (pageY < (all[i].top + all[i].bottom) / 2) {
        index = i;
        break;
      }
    }
    return Math.min(index, latest.current.ceiling);
  }, []);

  const indicatorFor = useCallback((index: number) => {
    const all = boxes.current;
    if (all.length === 0) return 0;
    // O indicador fica no MEIO do vão entre dois blocos, e não colado na borda
    // de um deles: o vão é de 16px de superfície a superfície, e uma linha
    // encostada em cima parece a borda daquele bloco em vez do lugar do novo.
    const pageY =
      index <= 0
        ? all[0].top - 8
        : index >= all.length
          ? all[all.length - 1].bottom + 8
          : (all[index - 1].bottom + all[index].top) / 2;
    return pageY - containerTop.current;
  }, []);

  const begin = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const node = latest.current.nodeAt(index);
      if (!node) return;

      const measured: { top: number; bottom: number }[] = [];
      for (let i = 0; i < latest.current.count; i++) {
        const box = latest.current.nodeAt(i)?.getBoundingClientRect();
        measured.push(
          box
            ? { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY }
            : { top: 0, bottom: 0 }
        );
      }
      boxes.current = measured;
      const list = latest.current.container()?.getBoundingClientRect();
      containerTop.current = list ? list.top + window.scrollY : 0;

      const rect = node.getBoundingClientRect();
      grab.current = { x: clientX - rect.left, y: clientY - rect.top };
      pointer.current = { x: clientX, y: clientY };
      from.current = index;
      const target = insertionFor(clientY + window.scrollY);
      to.current = target;

      // O cursor sai da caixa: no celular ele abriria o teclado por cima do
      // documento que se está reorganizando, e no computador a seleção de texto
      // acompanharia o arrasto.
      (document.activeElement as HTMLElement | null)?.blur?.();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      setSource(node);
      setDrag({ from: index, to: target, width: rect.width, indicatorTop: indicatorFor(target) });
      latest.current.onStart?.();
    },
    [insertionFor, indicatorFor]
  );

  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;

    const sync = () => {
      const target = insertionFor(pointer.current.y + window.scrollY);
      if (target === to.current) return;
      to.current = target;
      setDrag((cur) => (cur ? { ...cur, to: target, indicatorTop: indicatorFor(target) } : cur));
    };

    const finish = (drop: boolean) => {
      const start = from.current;
      const target = to.current;
      // Os ouvintes só saem da janela no commit do `setDrag(null)`, e até lá um
      // segundo evento de fim (um `pointercancel` logo depois do `pointerup`)
      // ainda chegaria aqui — e moveria o bloco duas vezes.
      if (start < 0) return;
      from.current = -1;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setDrag(null);
      setSource(null);
      if (drop) latest.current.onDrop(start, target);
    };

    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      place();
      sync();
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    // Ver "Enquanto arrasta, a rolagem é NOSSA".
    const hold = (e: TouchEvent) => e.preventDefault();

    let frame = 0;
    const tick = () => {
      const y = pointer.current.y;
      const height = window.innerHeight;
      const above = EDGE - y;
      const below = y - (height - EDGE);
      // A velocidade cresce com a proximidade da borda: no limite da faixa ela
      // é um arrastar lento, encostado nela é um empurrão.
      const step =
        above > 0
          ? -Math.ceil((above / EDGE) * EDGE_SPEED)
          : below > 0
            ? Math.ceil((below / EDGE) * EDGE_SPEED)
            : 0;
      if (step !== 0) {
        window.scrollBy(0, step);
        // O ponteiro não se moveu, a PÁGINA se moveu: o destino muda mesmo com
        // o dedo parado na borda.
        sync();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("touchmove", hold, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", hold);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, place, insertionFor, indicatorFor]);

  /** O punho da margem esquerda: pegar e arrastar, sem espera nenhuma. */
  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent) => {
        // O foco não vai para o punho e o texto não é selecionado no caminho.
        e.preventDefault();
        if (drag) return;
        if (!latest.current.canDrag(index)) return;
        begin(index, e.clientX, e.clientY);
      },
    }),
    [begin, drag]
  );

  /** Pressionar e segurar a linha, no dedo. Ver o cabeçalho. */
  const pressProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent) => {
        // No rato quem arrasta é o punho: um arrasto que nascesse de segurar o
        // texto tiraria da pessoa o gesto de SELECIONAR uma frase com o mouse.
        if (e.pointerType === "mouse") return;
        if (drag || pending.current) return;
        if (!latest.current.canDrag(index)) return;
        // Um toque que começou num botão é daquele botão. A pílula inteira mora
        // dentro deste bloco.
        if ((e.target as HTMLElement).closest("button,a")) return;

        const startX = e.clientX;
        const startY = e.clientY;
        let timer = 0;

        const release = () => {
          window.clearTimeout(timer);
          pending.current = null;
          window.removeEventListener("pointermove", watch);
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        function watch(ev: PointerEvent) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > PRESS_SLOP) release();
        }

        timer = window.setTimeout(() => {
          release();
          begin(index, startX, startY);
        }, LONG_PRESS_MS);

        pending.current = release;
        window.addEventListener("pointermove", watch);
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
      },
    }),
    [begin, drag]
  );

  // Desmontar no meio de um arrasto (uma navegação, um salvamento que leva
  // embora a tela) deixaria a página sem seleção e com o cursor de mão.
  useEffect(
    () => () => {
      pending.current?.();
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    },
    []
  );

  return { drag, source, ghostRef, handleProps, pressProps };
}
