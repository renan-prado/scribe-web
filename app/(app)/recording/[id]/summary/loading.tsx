import { SummarySkeleton } from "@/features/session/components/skeletons";

export default function SummaryLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
      <SB className="h-3 w-16" />

      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <SB className="size-6 rounded-full" />
            <SB className="h-3.5 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <SB className="h-6 w-16 rounded-full" />
            <SB className="size-8 rounded-full" />
          </div>
        </div>
        <SB className="h-8 w-4/5" />
        <SB className="h-3 w-40" />
        <SB className="h-3 w-56" />
      </header>

      <div className="h-px w-full bg-[color:var(--scriba-hairline)]" />

      <SummarySkeleton />
    </main>
  );
}

function SB({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-skeleton-shimmer rounded-md bg-[color:var(--scriba-hairline-soft)] ${className}`}
    />
  );
}
