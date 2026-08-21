export default function HomeLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 animate-skeleton-shimmer rounded-md bg-muted" />
          <div className="h-7 w-7 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
        </div>
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4"
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
                <div
                  className="h-3 w-2/5 animate-skeleton-shimmer rounded-md bg-muted"
                  style={{ animationDelay: `${i * 120 + 200}ms` }}
                />
              </div>
              <div className="size-8 shrink-0 animate-skeleton-shimmer rounded-md bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
