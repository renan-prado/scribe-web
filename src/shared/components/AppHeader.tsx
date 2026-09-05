"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { cn } from "@/lib/utils";
import { ScribaLogo } from "@/shared/brand";

// As três telas com fundo `scriba-surface` (ver seus `page.tsx`) — o header
// precisa da mesma cor aqui para não deixar costura entre ele e o conteúdo.
const SURFACE_ROUTES = ["/feed", "/list", "/studies"];

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();
  const hasSurfaceBg = pathname !== null && SURFACE_ROUTES.includes(pathname);

  return (
    <header className={cn("w-full", hasSurfaceBg && "bg-scriba-surface")}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-8 pb-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/feed"
            aria-label="Scriba"
            className="flex items-center gap-2 rounded-full text-scriba-ink-strong transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ScribaLogo size={22} textClassName="text-[19px]" />
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-scriba-hairline sm:block" />
          <AppNav />
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
