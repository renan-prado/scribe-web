export function SummarySkeleton() {
  return (
    <div role="status" aria-label="Gerando resumo" className="flex flex-col gap-3">
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
      <div className="h-4 w-11/12 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
      <div className="h-4 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:360ms]" />
    </div>
  );
}

export function TranscriptSkeleton() {
  return (
    <div
      role="status"
      aria-label="Transcrevendo"
      className="flex w-full flex-col items-center gap-2 pt-1"
    >
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
      <div className="h-4 w-4/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:150ms]" />
      <div className="h-4 w-2/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:300ms]" />
    </div>
  );
}

export function ListeningDots() {
  return (
    <div
      role="status"
      aria-label="Escutando"
      className="flex items-center justify-center gap-1.5 pt-2"
    >
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
    </div>
  );
}
