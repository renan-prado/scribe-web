type Props = {
  /** Sobrescreve a copy padrão (resumo). O modo transcrição só está salvando
   * texto — prometer "gerando o resumo" ali seria mentira. */
  title?: string;
  subtitle?: string;
};

export function FinalizingOverlay({
  title = "Gerando o resumo",
  subtitle = "Ajustando os últimos pontos e amarrando a ideia central.",
}: Props = {}) {
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
        <p className="max-w-sm text-sm font-light leading-relaxed text-scriba-ink-soft">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
