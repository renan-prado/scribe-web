"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/backstage", label: "Visão geral", exact: true },
  { href: "/backstage/users", label: "Usuários" },
  { href: "/backstage/usage", label: "Uso & custos" },
];

export function BackstageNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Navegação do backstage">
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
    </nav>
  );
}
