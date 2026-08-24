"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/home", label: "Início" },
  { href: "/list", label: "Gravações" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || (link.href !== "/home" && pathname?.startsWith(link.href));
        return (
          <NavLink
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-[color:var(--scriba-blue-soft)] text-[color:var(--scriba-blue)]"
                : "text-[color:var(--scriba-ink-soft)] hover:bg-[color:var(--scriba-blue-soft)]/60 hover:text-[color:var(--scriba-blue)]"
            )}
          >
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
