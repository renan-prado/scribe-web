export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <SB className="h-3 w-32" />

      <div className="flex flex-col gap-2">
        <SB className="h-7 w-56" />
        <SB className="h-3.5 w-40" />
      </div>

      <div className="flex flex-col gap-4 rounded-[24px] border border-scriba-hairline-soft bg-white p-6 shadow-[0_6px_22px_rgba(79,168,240,0.13)]">
        <div className="flex items-center gap-2">
          <SB className="h-1.5 w-6 rounded-full" />
          <SB className="h-3 w-32" />
        </div>
        <SB className="h-5 w-full" />
        <SB className="h-5 w-4/5" />
        <div className="flex flex-col gap-1 border-t border-scriba-hairline pt-3">
          <SB className="h-3.5 w-52" />
          <SB className="h-3 w-36" />
        </div>
        <div className="flex gap-2">
          <SB className="h-10 flex-1 rounded-full" />
          <SB className="h-10 flex-1 rounded-full" />
        </div>
      </div>
    </main>
  );
}

function SB({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft ${className}`}
    />
  );
}
