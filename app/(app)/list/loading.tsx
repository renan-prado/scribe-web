export default function ListLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <SB className="h-7 w-52" />
          <SB className="h-3.5 w-64" />
        </div>
        <SB className="h-9 w-9 rounded-full" />
      </div>

      <div className="flex flex-col gap-6">
        {["g0", "g1"].map((groupKey, g) => (
          <section key={groupKey} className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <SB className="h-3 w-24" />
              <SB className="h-px flex-1" />
              <SB className="h-3 w-6" />
            </div>
            <ul className="flex flex-col gap-3">
              {["a", "b", "c"].map((itemKey, i) => (
                <li
                  key={`${groupKey}-${itemKey}`}
                  className="rounded-3xl border border-[color:var(--scriba-hairline-soft)] bg-white p-5 shadow-[0_4px_14px_rgba(79,168,240,0.08)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <SB
                        className="h-4 w-3/4"
                        style={{ animationDelay: `${(g * 3 + i) * 80}ms` }}
                      />
                      <SB
                        className="h-3 w-full"
                        style={{ animationDelay: `${(g * 3 + i) * 80 + 60}ms` }}
                      />
                      <SB
                        className="h-3 w-4/5"
                        style={{ animationDelay: `${(g * 3 + i) * 80 + 120}ms` }}
                      />
                      <div className="flex gap-2 pt-1.5">
                        <SB className="h-3 w-24" />
                        <SB className="h-3 w-32" />
                      </div>
                    </div>
                    <SB className="size-8 rounded-full" />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--scriba-hairline)] pt-3">
                    <div className="flex items-center gap-2">
                      <SB className="h-3 w-16" />
                      <SB className="h-3 w-14" />
                    </div>
                    <SB className="h-7 w-24 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function SB({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={`animate-skeleton-shimmer rounded-md bg-[color:var(--scriba-hairline-soft)] ${className}`}
    />
  );
}
