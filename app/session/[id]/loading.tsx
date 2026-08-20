export default function SessionLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <div className="h-6 w-20 animate-skeleton-shimmer rounded-md bg-muted" />
        <div className="h-8 w-8 animate-skeleton-shimmer rounded-full bg-muted [animation-delay:120ms]" />
      </div>

      <header className="flex flex-col gap-3">
        <div className="h-5 w-40 animate-skeleton-shimmer rounded-md bg-muted" />
        <div className="h-9 w-4/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms] sm:h-10" />
        <div className="h-4 w-32 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
      </header>

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
