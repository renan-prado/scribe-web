"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/backstage", label: "Visão geral", exact: true },
  { href: "/backstage/users", label: "Usuários" },
  { href: "/backstage/usage", label: "Uso & custos" },
];

export function BackstageNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <nav
      className="flex items-center gap-1 border-b border-border"
      aria-label="Navegação do backstage"
    >
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" /> : null}
          </Link>
        );
      })}

      <button
        type="button"
        aria-label="Atualizar dados"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        className={cn(
          "ml-auto mb-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed"
        )}
      >
        <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
      </button>
    </nav>
  );
}
