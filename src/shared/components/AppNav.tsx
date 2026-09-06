"use client";

import { BookOpen, List, Rss } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { activeNavKey } from "@/shared/nav";

const LINKS = [
  { key: "feed" as const, href: "/feed", label: "Feed", icon: Rss, tone: "blue" as const },
  { key: "list" as const, href: "/list", label: "Gravações", icon: List, tone: "blue" as const },
  {
    key: "studies" as const,
    href: "/studies",
    label: "Estudos",
    icon: BookOpen,
    tone: "green" as const,
  },
];

const TONES = {
  blue: {
    active: "bg-scriba-blue-soft text-scriba-blue-ink",
    idle: "text-scriba-ink-soft hover:bg-scriba-blue-soft/60 hover:text-scriba-blue-ink",
  },
  green: {
    active: "bg-scriba-green-soft text-scriba-green-ink",
    idle: "text-scriba-ink-soft hover:bg-scriba-green-soft/60 hover:text-scriba-green-ink",
  },
};

export function AppNav() {
  const pathname = usePathname();
  // Quem decide é `activeNavKey`, compartilhado com a `MobileBottomNav`. A
  // comparação que morava aqui era `pathname.startsWith(href)`, e por isso a
  // página de uma gravação ou de um estudo não acendia item nenhum: elas
  // moram em `/recording/:id/*`, que não começa com `/list` nem `/studies`.
  const current = activeNavKey(pathname ?? "");
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {LINKS.map(({ key, href, label, icon: Icon, tone }) => {
        const active = current === key;
        const toneClasses = TONES[tone];
        return (
          <NavLink
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? toneClasses.active : toneClasses.idle
            )}
          >
            <Icon size={14} strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
