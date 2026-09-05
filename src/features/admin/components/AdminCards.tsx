import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Cartões compartilhados das telas de admin.
 *
 * Nasceram dentro de `app/admin/page.tsx` e saíram de lá quando a segunda tela
 * (`/admin/metricas`) precisou dos mesmos blocos. Extrair em vez de copiar
 * mantém uma decisão visual só: mudar o raio, a sombra ou a escala de tom
 * acerta as duas telas de uma vez.
 */

export type Tone = "blue" | "rose" | "mint" | "cream";
export type KpiTile = {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  icon?: React.ReactNode;
};

const TONE_CLASSES: Record<Tone, { badge: string; label: string }> = {
  blue: { badge: "bg-scriba-blue-soft", label: "text-scriba-blue-ink" },
  rose: { badge: "bg-scriba-rose", label: "text-scriba-rose-accent" },
  mint: { badge: "bg-scriba-mint", label: "text-scriba-mint-accent" },
  cream: { badge: "bg-scriba-cream", label: "text-scriba-cream-accent" },
};

export function KpiCard({ label, value, hint, tone, icon }: KpiTile) {
  const c = TONE_CLASSES[tone];
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <div
        className={cn(
          "mb-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1",
          c.badge
        )}
      >
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", c.label)}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-scriba-ink-strong sm:text-[26px]">
        {icon}
        <span className="min-w-0 truncate tabular-nums" title={value}>
          {value}
        </span>
      </div>
      <p className="text-[12px] font-light text-scriba-ink-mute">{hint}</p>
    </div>
  );
}

export type ListCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ListCard({ title, subtitle, children }: ListCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">{title}</h2>
        {subtitle ? (
          <span className="text-[11px] font-light uppercase tracking-[0.1em] text-scriba-ink-mute">
            {subtitle}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-light text-scriba-ink-mute">{children}</p>;
}

export type QuickLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function QuickLink({ href, children }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft px-3.5 py-2 text-[12px] font-semibold text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-blue"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
