export function FinalizingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
    >
      <span className="relative flex size-10 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="size-3 rounded-full bg-primary" />
      </span>
      <div className="flex flex-col items-center gap-1 px-6 text-center">
        <p className="text-base font-semibold text-foreground">Gerando a conclusão</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Ajustando os últimos pontos e amarrando a ideia central.
        </p>
      </div>
    </div>
  );
}
