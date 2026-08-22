import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-8 pb-4 sm:px-6">
        <Link
          href="/home"
          className="font-heading text-2xl font-bold leading-none tracking-tight text-foreground transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
        >
          scriba
        </Link>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
