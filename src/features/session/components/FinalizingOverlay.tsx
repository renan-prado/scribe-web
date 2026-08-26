export function FinalizingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white/85 px-8 text-center backdrop-blur-md"
    >
      <span className="relative flex size-4 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-scriba-blue/55" />
        <span className="size-4 rounded-full bg-scriba-blue" />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-heading text-xl font-semibold tracking-tight text-scriba-ink-strong">
          Gerando o resumo
        </p>
        <p className="max-w-sm text-sm font-light leading-relaxed text-scriba-ink-soft">
          Ajustando os últimos pontos e amarrando a ideia central.
        </p>
      </div>
    </div>
  );
}
