"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/** Quanto o disco pode descer, em px. Além disso o arrasto não move mais nada. */
const MAX_PULL = 96;
/** A partir daqui, soltar ATUALIZA. É também onde o disco para enquanto atualiza. */
const TRIGGER = 64;
/**
 * O dedo anda mais que o disco, e de propósito: sem a borracha, 64px de dedo é
 * um gesto que dispara sem querer toda vez que alguém rola uma lista que já
 * estava no topo.
 */
const RESISTANCE = 0.45;
/** O piso do indicador. Abaixo disso, atualizar vira um piscar sem explicação. */
const MIN_VISIBLE_MS = 600;

/**
 * Puxar a tela para baixo e ATUALIZAR, no celular.
 *
 * ## Por que escrevemos o gesto em vez de deixar o navegador fazer
 *
 * Porque o navegador só faz em metade dos aparelhos. O Chrome do Android tem o
 * gesto nativo; o Safari do iPhone **não tem nenhum** quando o app está
 * instalado na tela inicial, que é justamente como o Scriba é usado. Deixar
 * como estava seria o mesmo gesto existindo num aparelho e não existindo no
 * outro, com o iPhone sem NENHUM jeito de pedir dados novos, porque no modo
 * standalone também não há barra de endereço com o botão de recarregar.
 *
 * E o gesto nativo do Android, mesmo onde existe, recarrega a página inteira:
 * nova navegação, tudo remontado, o app piscando branco. O que este componente
 * faz é bem menos violento e chega ao mesmo lugar.
 *
 * ## O que "atualizar" significa aqui
 *
 * Exatamente o que o `ReconnectWatcher` já faz quando a rede volta, e pelos
 * mesmos motivos (o cabeçalho dele explica um a um):
 *
 * - `invalidateQueries()` marca o cache do TanStack como velho, e as queries
 *   ATIVAS (as da tela em que a pessoa está) são refeitas;
 * - `resumePausedMutations()` destrava escritas que tenham ficado presas;
 * - `router.refresh()` é a metade SERVIDOR, sem a qual o saldo de moedas da
 *   barra e tudo que veio no HTML continuariam com os números de antes.
 *
 * O `startTransition` em volta do `refresh()` não é enfeite: é dele que sai o
 * `isPending`, e é o `isPending` que diz quando o servidor terminou. Sem isso o
 * indicador teria que adivinhar um tempo fixo e mentiria nas duas pontas.
 *
 * ## Quando o gesto NÃO vale
 *
 * O gesto só nasce se o dedo desce a partir do topo da página, e morre antes de
 * mexer em qualquer coisa nos casos abaixo. A lista é a diferença entre um
 * gesto e uma armadilha:
 *
 * - **Na gravação.** Ali o aparelho fica na mão durante a pregação e o toque
 *   acidental é a regra, não a exceção; e uma tela que não tem nada a buscar do
 *   servidor não tem por que responder a um pedido de buscar.
 * - **Com um diálogo aberto.** A busca global e os seletores do editor são
 *   telas cheias no celular: puxar dentro deles é rolar o conteúdo deles.
 * - **Dentro de qualquer caixa que role sozinha.** Se existe um ancestral com
 *   rolagem própria, o gesto é dele.
 * - **Se o movimento é mais horizontal que vertical**, que é o carrossel de
 *   cartões do resumo (`SummaryDeck`) pedindo passagem.
 *
 * ## O `overscroll-behavior` no `<html>`
 *
 * Ele desliga o gesto NATIVO do Chrome e o efeito elástico do iOS enquanto o
 * app está montado, para não haver dois indicadores respondendo ao mesmo dedo.
 * Fica aqui, em JS, e não no `globals.css`, pela mesma razão do `ZoomLock` ao
 * lado: a trava vale para o APP, e o CSS global pegaria a landing junto.
 *
 * Ela vale mesmo onde o nosso gesto não vale (a gravação), e é de propósito:
 * ali o recarregar do navegador não é redundante, é destrutivo.
 *
 * ## Onde ele mora
 *
 * No layout de `(shell)`, junto do `OfflineBadge` e do `ReconnectWatcher`: o
 * gesto é do APARELHO, não da página, e repetido em sete telas bastaria
 * esquecer uma para ele sumir justamente onde alguém esperava por ele.
 */
export function PullToRefresh() {
  const router = useRouter();
  const client = useQueryClient();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // O gesto é lido nos listeners, que não enxergam o estado do render. Tudo que
  // eles precisam saber mora em refs; o estado existe só para desenhar.
  const gesture = useRef({ startX: 0, startY: 0, tracking: false, engaged: false });
  const distanceRef = useRef(0);
  const busyRef = useRef(false);
  const startedAt = useRef(0);

  const enabled = !pathname.startsWith("/recording");

  const applyDistance = useCallback((value: number) => {
    distanceRef.current = value;
    setDistance(value);
  }, []);

  const run = useCallback(() => {
    busyRef.current = true;
    startedAt.current = Date.now();
    setRefreshing(true);
    applyDistance(TRIGGER);
    void client.invalidateQueries();
    void client.resumePausedMutations();
    startTransition(() => router.refresh());
  }, [applyDistance, client, router]);

  // A trava do gesto NATIVO, e ela não depende de `enabled`: onde o nosso gesto
  // não vale, o do navegador vale menos ainda. Justamente na gravação é que o
  // recarregar do Chrome seria destrutivo, e é a tela em que o aparelho passa
  // meia hora na mão de alguém.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    return () => {
      root.style.overscrollBehaviorY = previous;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (event: TouchEvent) => {
      const state = gesture.current;
      state.tracking = false;
      state.engaged = false;
      if (busyRef.current) return;
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      const touch = event.touches[0];
      if (!touch || isBlocked(touch.target)) return;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.tracking = true;
    };

    const onMove = (event: TouchEvent) => {
      const state = gesture.current;
      if (!state.tracking || busyRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;

      const dy = touch.clientY - state.startY;
      const dx = touch.clientX - state.startX;

      if (!state.engaged) {
        // Os primeiros pixels decidem de quem é o gesto. Subir, andar de lado
        // ou já ter saído do topo devolve o dedo para a rolagem normal, e uma
        // vez devolvido ele não volta até o próximo toque.
        if (dy < 6) {
          if (dy < -4 || Math.abs(dx) > 8) state.tracking = false;
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          state.tracking = false;
          return;
        }
        state.engaged = true;
        setDragging(true);
      }

      // Sem isto o navegador rola (ou dispara o gesto nativo dele) por baixo do
      // nosso. `passive: false` no registro é o que faz este `preventDefault`
      // valer; sem a opção ele é ignorado em silêncio.
      if (event.cancelable) event.preventDefault();
      applyDistance(Math.min(MAX_PULL, dy * RESISTANCE));
    };

    const onEnd = () => {
      const state = gesture.current;
      const wasEngaged = state.engaged;
      state.tracking = false;
      state.engaged = false;
      if (!wasEngaged) return;
      setDragging(false);
      if (distanceRef.current >= TRIGGER) run();
      else applyDistance(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [applyDistance, enabled, run]);

  // O fim: o servidor terminou (`isPending` caiu) e o indicador já ficou tempo
  // suficiente na tela para ter sido visto. Quando a resposta volta em 80ms, o
  // piso é o que impede um lampejo que a pessoa lê como "não fez nada".
  useEffect(() => {
    if (!refreshing || isPending) return;
    const remaining = Math.max(MIN_VISIBLE_MS - (Date.now() - startedAt.current), 0);
    const timer = setTimeout(() => {
      busyRef.current = false;
      setRefreshing(false);
      applyDistance(0);
    }, remaining);
    return () => clearTimeout(timer);
  }, [applyDistance, isPending, refreshing]);

  if (!enabled) return null;

  const progress = Math.min(1, distance / TRIGGER);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.25rem)] z-40 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-v2-card text-v2-ink-soft shadow-lg shadow-black/20 ring-1 ring-inset ring-v2-card-hover",
          // Enquanto o dedo está na tela o disco segue o dedo sem transição;
          // ao soltar, é a transição que faz o recolher (ou o parar no lugar).
          dragging ? null : "transition-transform duration-300 ease-out"
        )}
        style={{
          // Com distância zero o disco descansa acima da borda, fora da tela:
          // é o próprio arrasto que o traz, sem nada a esconder ou revelar.
          transform: `translate3d(0, ${distance - 48}px, 0)`,
        }}
      >
        <RefreshCw
          aria-hidden
          className={cn("size-4", refreshing && "animate-spin")}
          strokeWidth={2}
          // Antes de soltar, a seta gira com o quanto falta: é o que diz que
          // ainda não chegou, sem precisar de texto.
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
      <span className="sr-only">{refreshing ? "Atualizando" : ""}</span>
    </div>
  );
}

/**
 * O gesto é de quem já tem dono? Então não é nosso.
 *
 * Diálogo aberto na tela (a busca global, o seletor de passagem) tira o gesto
 * inteiro, mesmo que o dedo tenha pousado fora dele: no celular esses diálogos
 * ocupam a tela toda e o que está atrás não é para rolar. Fora isso, qualquer
 * ancestral com rolagem própria fica com o dedo.
 */
function isBlocked(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;

  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}
