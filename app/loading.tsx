export default function HomeLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-40 animate-skeleton-shimmer rounded-md bg-muted" />
          <div className="h-4 w-64 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
        </div>
        <div className="h-10 w-36 animate-skeleton-shimmer rounded-full bg-muted [animation-delay:240ms]" />
      </header>
      <ul className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div
                className="h-4 w-1/2 animate-skeleton-shimmer rounded-md bg-muted"
                style={{ animationDelay: `${i * 120}ms` }}
              />
              <div
                className="h-3 w-4/5 animate-skeleton-shimmer rounded-md bg-muted"
                style={{ animationDelay: `${i * 120 + 100}ms` }}
              />
            </div>
            <div className="size-9 shrink-0 animate-skeleton-shimmer rounded-full bg-muted" />
          </li>
        ))}
      </ul>
    </main>
  );
}
