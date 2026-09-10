"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { resolveAnchor } from "@/features/tour/lib/anchors";
import type { TourStep } from "@/lib/domain/tour";
import { cn } from "@/lib/utils";

/**
 * O overlay: o véu com um furo por cima do elemento, e o balão que fala dele.
 *
 * ## O furo é UMA sombra, não quatro divs
 *
 * O jeito óbvio de escurecer a tela em volta de um retângulo é desenhar quatro
 * faixas em volta dele. O jeito que funciona é um retângulo do tamanho do alvo
 * com uma sombra de espalhamento maior que a tela
 * (`box-shadow: 0 0 0 9999px …`): o "de fora" da sombra é o véu, e o "de
 * dentro" é o furo, que assim pode ter canto arredondado e mudar de posição
 * com transição, coisas que as quatro faixas nunca dão de graça.
 *
 * ## Ele vai para o `body`, num portal
 *
 * `position: fixed` é relativo ao viewport ATÉ um ancestral ter `transform`,
 * `filter` ou `backdrop-filter`, e aí passa a ser relativo a ele. O layout de
 * `(app)` tem o `PageTransition`, que anima deslocamento a cada troca de rota;
 * sem o portal, o véu ficaria preso na caixa da página animada e o furo
 * apontaria para o lugar errado durante meio segundo, só nas navegações.
 *
 * ## Medir é contínuo, não uma vez
 *
 * A posição do alvo muda por rolagem, por rotação do aparelho, por imagem que
 * carregou depois e empurrou o conteúdo. O retângulo é remedido a cada
 * `scroll` e `resize` (com `requestAnimationFrame` no meio, senão são dezenas
 * de medições por gesto), e mais duas vezes por tempo depois de cada troca de
 * passo, que é o que cobre a rolagem suave até o alvo.
 *
 * ## O celular NÃO tem balão flutuante
 *
 * Numa tela estreita, um balão de 360px ancorado ao alvo cobre metade da
 * página e o próprio alvo na metade das vezes. Ali ele encosta no rodapé, e é
 * a PÁGINA que rola para o alvo caber acima dele, uma vez por passo. No
 * desktop o balão nasce abaixo do alvo, sobe para cima dele quando não há
 * espaço, e só então recorre ao centro.
 */

type Props = {
  steps: TourStep[];
  /** `step` é o índice em que o tour terminou, 0-based. */
  onClose: (step: number, outcome: "completed" | "dismissed") => void;
};

type Rect = { top: number; left: number; width: number; height: number };

/** Folga entre o alvo e o recorte: o furo colado no botão parece um erro. */
const HOLE_PADDING = 8;
/** Distância entre o recorte e o balão, e entre o balão e a borda da janela. */
const GAP = 12;
const MARGIN = 12;
const CARD_WIDTH = 360;
/** Abaixo disto o balão encosta no rodapé. Mesmo degrau do `sm:` do Tailwind. */
const NARROW_VIEWPORT = 640;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function TourRunner({ steps, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [card, setCard] = useState<{ top: number; left: number; width: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Guarda a correção de rolagem do celular: uma por passo, ou o ajuste
  // dispara a medição que dispara o ajuste.
  const scrolledForRef = useRef<number>(-1);
  const titleId = useId();
  const bodyId = useId();

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = resolveAnchor(step?.anchor);
    if (!el) {
      // Passo sem âncora, ou âncora que sumiu depois de o tour começar (o
      // botão virou spinner, a faixa fechou). Nos dois casos o balão vai para
      // o centro e fala da tela: melhor que apontar para o vazio.
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - HOLE_PADDING,
      left: r.left - HOLE_PADDING,
      width: r.width + HOLE_PADDING * 2,
      height: r.height + HOLE_PADDING * 2,
    });
  }, [step]);

  // Troca de passo: leva o alvo para o meio da tela e remede enquanto a
  // rolagem suave acontece.
  //
  // `useLayoutEffect`, e não `useEffect`, por causa do primeiro quadro: a
  // posição do balão é calculada a partir do retângulo, e um `setRect` depois
  // da pintura mostraria o balão centralizado por um quadro antes de ele
  // saltar para o alvo. Num efeito de layout o React refaz o render antes de
  // pintar, e o salto não existe.
  useLayoutEffect(() => {
    const el = resolveAnchor(step?.anchor);
    el?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    measure();
    const timers = [
      window.setTimeout(measure, 200),
      window.setTimeout(measure, 500),
      window.setTimeout(measure, 900),
    ];
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [measure, step]);

  // Rolagem, rotação, conteúdo que chegou depois.
  useEffect(() => {
    let frame = 0;
    const onMove = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [measure]);

  // Onde o balão fica. `useLayoutEffect` porque ele depende da ALTURA do
  // próprio balão, e medir depois da pintura faria ele aparecer no lugar
  // errado por um quadro.
  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CARD_WIDTH, vw - MARGIN * 2);
    const height = node.offsetHeight;

    if (!rect) {
      setCard({ width, left: (vw - width) / 2, top: Math.max(MARGIN, (vh - height) / 2) });
      return;
    }

    if (vw < NARROW_VIEWPORT) {
      const top = vh - height - MARGIN;
      // O alvo não pode ficar embaixo do balão. Uma correção por passo, ver
      // `scrolledForRef`.
      const limit = top - GAP;
      if (rect.top + rect.height > limit && scrolledForRef.current !== index) {
        scrolledForRef.current = index;
        window.scrollBy({
          top: rect.top + rect.height - limit + GAP,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
      setCard({ width, left: (vw - width) / 2, top });
      return;
    }

    const below = rect.top + rect.height + GAP;
    const above = rect.top - height - GAP;
    const top =
      below + height <= vh - MARGIN
        ? below
        : above >= MARGIN
          ? above
          : Math.max(MARGIN, (vh - height) / 2);
    const left = Math.min(
      Math.max(MARGIN, rect.left + rect.width / 2 - width / 2),
      vw - width - MARGIN
    );
    setCard({ width, left, top });
  }, [rect, index]);

  const dismiss = useCallback(() => onClose(index, "dismissed"), [index, onClose]);

  const next = useCallback(() => {
    if (isLast) {
      onClose(index, "completed");
      return;
    }
    setIndex((i) => i + 1);
  }, [index, isLast, onClose]);

  // O foco entra no balão e fica preso nele: com o resto da tela coberta por
  // um véu que engole cliques, um Tab que passeasse pela página levaria o
  // teclado para botões que o mouse não alcança.
  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>("[data-tour-primary]")?.focus();
  }, []);

  // O Escape é ouvido no DOCUMENTO, não só no balão. Um clique no véu tira o
  // foco do cartão e o devolve ao `body`, e a partir dali um `onKeyDown` da
  // nossa árvore não vê tecla nenhuma: a saída pelo teclado sumiria por causa
  // de um clique fora.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [dismiss]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!step || typeof document === "undefined") return null;

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: o véu não é um alvo de clique, ele só é o lugar onde o Tab é ouvido enquanto o foco está no balão.
    <div className="fixed inset-0 z-70 animate-in fade-in-0 duration-200" onKeyDown={onKeyDown}>
      {rect ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-2xl",
            !prefersReducedMotion() && "transition-all duration-200 ease-out"
          )}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 3px var(--scriba-tour-ring), 0 0 0 9999px var(--scriba-tour-scrim)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "var(--scriba-tour-scrim)" }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="absolute flex flex-col gap-3 rounded-[24px] bg-scriba-paper p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] ring-1 ring-scriba-hairline"
        style={{
          width: card?.width ?? CARD_WIDTH,
          top: card?.top ?? 0,
          left: card?.left ?? 0,
          visibility: card ? "visible" : "hidden",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
            {index + 1} de {steps.length}
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar o tour"
            className="-m-1 rounded-full p-1 text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-surface hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2
            id={titleId}
            className="font-heading text-base font-semibold leading-tight text-scriba-ink-strong"
          >
            {step.title}
          </h2>
          <p
            id={bodyId}
            className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft"
          >
            {step.body}
          </p>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          {/* "Pular" é um botão de verdade, do tamanho dos outros. Um tour cuja
              única saída visível é o X do canto ensina a procurar o X. */}
          <Button variant="ghost" size="lg" onClick={dismiss}>
            Pular
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button variant="secondary" size="lg" onClick={() => setIndex((i) => i - 1)}>
                Voltar
              </Button>
            ) : null}
            <Button size="lg" data-tour-primary onClick={next}>
              {isLast ? "Entendi" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
