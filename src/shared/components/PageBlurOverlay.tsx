"use client";

import { useEffect, useState } from "react";

/**
 * Overlay full-screen com fundo branco translúcido + backdrop-blur usado
 * durante ações pesadas como "Gerar estudo" e "Reprocessar" — dá feedback
 * visual claro de que a página está bloqueada esperando o servidor, sem
 * exigir um Dialog.
 *
 * Renderizado condicionalmente pelo consumidor. Mesmo z-index (z-50) e
 * mesmo tratamento visual da FinalizingOverlay usada ao encerrar uma
 * gravação, para manter o app coeso.
 *
 * ## Fases
 *
 * Quando a espera é longa e tem etapas nomeáveis (o estudo leva ~2 minutos e
 * passa por perguntar → responder → escrever), passe `phases` em vez de
 * `title`/`subtitle`: o overlay avança sozinho conforme o tempo previsto de
 * cada etapa.
 *
 * ⚠️ **É cronômetro, não telemetria.** O servidor não reporta progresso — não
 * há SSE no app, e é uma ausência deliberada. As durações em `holdMs` são
 * estimativas calibradas pelas latências que aparecem no log de cada etapa.
 * Duas consequências assumidas: se o servidor responder antes, o consumidor
 * simplesmente fecha o overlay no meio de uma fase; se demorar mais, a última
 * fase fica de pé indefinidamente. Por isso a última precisa ser uma frase que
 * envelhece bem parada.
 */

export type OverlayPhase = {
  title: string;
  subtitle?: string;
  /** Quanto tempo esta fase fica na tela antes de dar lugar à próxima. */
  holdMs: number;
};

type PageBlurOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  /** Quando presente, ignora `title`/`subtitle` e avança pelas fases. */
  phases?: OverlayPhase[];
};

export function PageBlurOverlay({ open, title, subtitle, phases }: PageBlurOverlayProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!open || !phases || phases.length === 0) {
      setPhaseIndex(0);
      return;
    }
    // Um timer por transição, e não um intervalo fixo: cada etapa do pipeline
    // dura o que dura, e um passo constante faria "escrevendo" aparecer
    // enquanto o servidor ainda está perguntando.
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      if (index >= phases.length - 1) return;
      timer = setTimeout(() => {
        index += 1;
        setPhaseIndex(index);
        advance();
      }, phases[index].holdMs);
    };
    setPhaseIndex(0);
    advance();
    return () => clearTimeout(timer);
  }, [open, phases]);

  if (!open) return null;

  const current = phases?.[phaseIndex];
  const shownTitle = current?.title ?? title ?? "";
  const shownSubtitle = current?.subtitle ?? subtitle;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-scriba-paper/85 px-8 text-center backdrop-blur-md"
    >
      <span className="relative flex size-4 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-scriba-blue/55" />
        <span className="size-4 rounded-full bg-scriba-blue" />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-heading text-xl font-semibold tracking-tight text-scriba-ink-strong">
          {shownTitle}
        </p>
        {shownSubtitle ? (
          <p className="max-w-sm text-sm font-light leading-relaxed text-scriba-ink-soft">
            {shownSubtitle}
          </p>
        ) : null}
      </div>

      {phases && phases.length > 1 ? (
        <ol aria-hidden className="mt-1 flex items-center gap-1.5">
          {phases.map((phase, i) => (
            <li
              key={phase.title}
              className={
                i <= phaseIndex
                  ? "h-1 w-6 rounded-full bg-scriba-blue transition-colors"
                  : "h-1 w-6 rounded-full bg-scriba-ink-mute/20 transition-colors"
              }
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
