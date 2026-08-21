export default function SummaryLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-40 animate-skeleton-shimmer rounded-md bg-muted" />
          <div className="h-8 w-64 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms] sm:h-9" />
          <div className="h-3 w-32 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
        </div>
        <div className="size-8 shrink-0 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
      </div>

      <div className="h-px w-full bg-border" />

      <div role="status" aria-label="Carregando sessão" className="flex flex-col gap-3">
        <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
        <div className="h-4 w-11/12 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
        <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
        <div className="h-4 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:360ms]" />
      </div>
    </main>
  );
}
