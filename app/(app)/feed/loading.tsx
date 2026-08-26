export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <SB className="h-3 w-32" />

      <div className="flex flex-col gap-2">
        <SB className="h-7 w-56" />
        <SB className="h-3.5 w-40" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Reflection card */}
        <div className="flex flex-col gap-4 rounded-6 border border-scriba-hairline-soft bg-white p-6 shadow-[0_6px_22px_rgba(79,168,240,0.13)]">
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

        {/* Practice card (mint) */}
        <div className="flex flex-col gap-3.5 rounded-6 bg-scriba-mint p-5">
          <div className="flex items-center justify-between gap-2">
            <SB className="h-3 w-32 !bg-scriba-mint-accent/25" />
            <SB className="h-6 w-24 rounded-full !bg-white/60" />
          </div>
          <SB className="h-4 w-full !bg-scriba-mint-accent/25" />
          <SB className="h-4 w-4/5 !bg-scriba-mint-accent/25" />
          <div className="flex items-center justify-between gap-3">
            <SB className="h-8 w-40 !bg-scriba-mint-accent/25" />
            <SB className="h-9 w-24 rounded-full !bg-scriba-blue-soft" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Connection card (blue) */}
          <div className="flex flex-col gap-3.5 rounded-6 bg-scriba-blue p-5">
            <SB className="h-3 w-32 !bg-white/25" />
            <SB className="h-5 w-full !bg-white/25" />
            <SB className="h-5 w-3/5 !bg-white/25" />
            <div className="flex flex-col gap-2">
              <SB className="h-11 w-full rounded-2xl !bg-white/20" />
              <SB className="h-11 w-full rounded-2xl !bg-white/20" />
            </div>
            <SB className="h-10 rounded-full !bg-scriba-yellow/60" />
          </div>

          {/* Memory card (cream) */}
          <div className="flex flex-col gap-2.5 rounded-6 bg-scriba-cream p-5">
            <SB className="h-3 w-32 !bg-scriba-cream-accent/30" />
            <SB className="h-5 w-full !bg-scriba-cream-accent/30" />
            <SB className="h-3 w-2/3 !bg-scriba-cream-accent/30" />
            <SB className="h-3.5 w-full !bg-scriba-cream-accent/30" />
            <SB className="h-3.5 w-3/4 !bg-scriba-cream-accent/30" />
            <SB className="mt-1 h-8 w-28 rounded-full !bg-white/70" />
          </div>
        </div>

        {/* Bible re-read (rose) */}
        <div className="flex flex-col gap-2 rounded-6 bg-scriba-rose p-5">
          <SB className="h-3 w-28 !bg-scriba-rose-accent/30" />
          <SB className="h-4 w-24 !bg-scriba-rose-accent/30" />
          <SB className="h-4 w-full !bg-scriba-rose-accent/30" />
          <SB className="h-4 w-3/4 !bg-scriba-rose-accent/30" />
          <SB className="mt-2 h-8 w-32 rounded-full !bg-white/70" />
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
