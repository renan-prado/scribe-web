"use client";

import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

export type RecordingViewTab<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
  /** `id` do elemento `role="tabpanel"` que este item controla. */
  panelId: string;
  /**
   * Novidades ainda não vistas na aba que está FECHADA. Só faz sentido no item
   * não selecionado, é o que impede a transcrição de esconder que chegou
   * cartão novo no feed.
   */
  badge?: number;
};

/**
 * O alternador de visão das telas de gravação. Duas abas, pílula clara, mora
 * dentro da `RecordingDock`.
 *
 * **Ele não recolhe junto com a barra do gravador**, e a assimetria é
 * deliberada: aquele apagamento existe para ninguém ENCERRAR um sermão
 * encostando na tela, e trocar de aba não destrói nada. Fazê-lo exigir dois
 * toques cobraria um preço sem comprar segurança nenhuma.
 *
 * Semântica de aba de verdade (`tablist`/`tab`/`tabpanel` + setas), e não dois
 * botões que parecem abas: quem navega por teclado ou leitor de tela precisa
 * saber que são duas visões do mesmo conteúdo, não dois destinos.
 */
export function RecordingViewTabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  tabs: RecordingViewTab<T>[];
  label: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const move = (delta: number) => {
    const i = tabs.findIndex((t) => t.value === value);
    if (i < 0) return;
    const next = tabs[(i + delta + tabs.length) % tabs.length];
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-scriba-hairline bg-scriba-paper/95 p-1",
        "shadow-[0_10px_24px_rgba(51,65,79,0.14)] backdrop-blur"
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const badge = !selected && tab.badge ? tab.badge : 0;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              if (el) refs.current.set(tab.value, el);
              else refs.current.delete(tab.value);
            }}
            type="button"
            role="tab"
            id={`${tab.panelId}-tab`}
            aria-selected={selected}
            aria-controls={tab.panelId}
            // Roving tabindex: o Tab entra na lista uma vez e cai na aba
            // aberta; as setas andam entre elas, como manda o padrão ARIA.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(-1);
              }
            }}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
              "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              "[&_svg]:size-3.5 [&_svg]:shrink-0",
              selected
                ? "bg-scriba-btn-muted text-scriba-ink-strong"
                : "text-scriba-ink-soft hover:bg-scriba-btn-muted/60 hover:text-scriba-ink"
            )}
          >
            {tab.icon}
            {/* O rótulo NÃO some no telefone. Ele já sumiu, quando as abas
                dividiam a linha com a barra do gravador, e duas caixinhas mudas
                não contam a ninguém que existe uma transcrição para ler, a
                largura para os dois é o que a faixa própria comprou. */}
            {tab.label}
            {badge > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-4 items-center justify-center rounded-full px-1",
                  "scriba-cta bg-[image:var(--scriba-cta)] text-[0.6rem] font-bold text-scriba-cta-ink"
                )}
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
