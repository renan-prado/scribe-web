import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-8 pb-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/feed"
            className="flex items-center gap-2 rounded-md font-heading text-lg font-semibold leading-none tracking-tight text-[color:var(--scriba-ink-strong)] transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-lg bg-[color:var(--scriba-blue)] text-white text-sm font-bold"
            >
              S
            </span>
            <span>Scriba</span>
          </Link>
          <AppNav />
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
