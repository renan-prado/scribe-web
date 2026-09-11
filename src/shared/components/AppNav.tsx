"use client";

import { usePathname } from "next/navigation";
import { FeedGlyph, ListGlyph, StudyGlyph } from "@/components/icons/NavGlyphs";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { activeNavKey } from "@/shared/nav";

/**
 * Os MESMOS glifos da barra inferior do celular (`@/components/icons/NavGlyphs`),
 * e não os `Rss` / `List` / `BookOpen` do lucide que estavam aqui. Feed,
 * Biblioteca e Estudos passam a ter um desenho só nas duas barras; quem usa o
 * app no celular e no navegador via dois ícones diferentes para o mesmo lugar.
 *
 * O `profile` do conjunto não entra: no desktop aquele lugar é o avatar do
 * `UserMenu`, não um item desta barra.
 */
const LINKS = [
  { key: "feed" as const, href: "/feed", label: "Feed", icon: FeedGlyph, tone: "blue" as const },
  {
    key: "recordings" as const,
    href: "/recordings",
    label: "Biblioteca",
    icon: ListGlyph,
    tone: "blue" as const,
  },
  {
    key: "studies" as const,
    href: "/studies",
    label: "Estudos",
    icon: StudyGlyph,
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
  // moram em `/recording/:id/*`, que não começa com `/recordings` nem
  // `/studies`.
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
            {/* 12px, e não os 14 que o lucide usava aqui. Os glifos são
                PREENCHIDOS e ocupam o `viewBox` de 24 quase inteiro, enquanto
                o lucide reserva ~2px de margem de cada lado: no mesmo `size` o
                glifo lê como um ícone maior e mais pesado que o traço que ele
                substituiu. 24/20 é a razão, e 14 ÷ 1,2 ≈ 12.

                É o mesmo diagnóstico que a `MobileBottomNav` já tinha
                registrado quando misturava as duas famílias, ver o cabeçalho
                de `NavGlyphs`. Eles também não aceitam `strokeWidth`, não têm
                traço, e o `aria-hidden` já vem de dentro do componente. */}
            <Icon className="size-3" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
