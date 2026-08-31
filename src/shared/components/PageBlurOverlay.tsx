"use client";

/**
 * Overlay full-screen com fundo branco translúcido + backdrop-blur usado
 * durante ações pesadas como "Gerar estudo" e "Reprocessar" — dá feedback
 * visual claro de que a página está bloqueada esperando o servidor, sem
 * exigir um Dialog.
 *
 * Renderizado condicionalmente pelo consumidor. Mesmo z-index (z-50) e
 * mesmo tratamento visual da FinalizingOverlay usada ao encerrar uma
 * gravação, para manter o app coeso.
 */
type PageBlurOverlayProps = {
  open: boolean;
  title: string;
  subtitle?: string;
};

export function PageBlurOverlay({ open, title, subtitle }: PageBlurOverlayProps) {
  if (!open) return null;
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
          {title}
        </p>
        {subtitle ? (
          <p className="max-w-sm text-sm font-light leading-relaxed text-scriba-ink-soft">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
