import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoinMark } from "@/components/icons/CoinMark";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { listUsers } from "@/lib/db/admin/users";
import { makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl, type UsdBrlRate } from "@/lib/fx/usd-brl";
import { cn } from "@/lib/utils";

const BRL_FINE = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const USD_FINE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
function formatCostPerCoin(usd: number, rate: UsdBrlRate | null): string {
  if (rate) return BRL_FINE.format(usd * rate.rate);
  return USD_FINE.format(usd);
}

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminOverviewPage() {
  const cutoff30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [users, summary30d, summaryAll, rate] = await Promise.all([
    listUsers(),
    loadAdminUsageSummary({ from: cutoff30 }),
    loadAdminUsageSummary(),
    getUsdToBrl(),
  ]);

  const money = makeMoneyFormatter(rate);
  const activeUsers = users.filter((u) => u.isActive).length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  const tiles: KpiTile[] = [
    {
      label: "Usuários",
      value: INT.format(users.length),
      hint: `${INT.format(activeUsers)} ativos · ${INT.format(adminUsers)} admins`,
      tone: "blue",
    },
    {
      label: "Custo total",
      value: money(summaryAll.totals.totalCostUsd),
      hint: `${INT.format(summaryAll.totals.totalEvents)} chamadas ao total`,
      tone: "rose",
    },
    {
      label: "Últimos 30 dias",
      value: money(summary30d.totals.totalCostUsd),
      hint: `${INT.format(summary30d.totals.totalEvents)} chamadas`,
      tone: "mint",
    },
    {
      label: "Custo por moeda",
      value:
        summaryAll.overallCostPerCoinUsd != null
          ? formatCostPerCoin(summaryAll.overallCostPerCoinUsd, rate)
          : "—",
      hint: `${INT.format(summaryAll.totals.totalCoins)} moedas debitadas`,
      tone: "cream",
      icon: <CoinMark size={22} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Visão geral"
        subtitle="Panorama de custos, uso e usuários da plataforma."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Top usuários" subtitle="Últimos 30 dias">
          {summary30d.byUser.length === 0 ? (
            <EmptyState>Sem eventos no período.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-scriba-hairline">
              {summary30d.byUser.slice(0, 8).map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="truncate text-scriba-ink">
                    {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
                    {money(u.totalCostUsd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ListCard>

        <ListCard title="Custo por rota" subtitle="Últimos 30 dias">
          {summary30d.byRoute.length === 0 ? (
            <EmptyState>Sem eventos no período.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-scriba-hairline">
              {summary30d.byRoute.map((r) => (
                <li
                  key={r.route}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-scriba-ink">{r.route}</span>
                  <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
                    {money(r.totalCostUsd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/admin/users">Gerenciar usuários</QuickLink>
          <QuickLink href="/admin/usage">Ver uso detalhado</QuickLink>
        </div>
        <FxRateBadge rate={rate} />
      </div>
    </div>
  );
}

type Tone = "blue" | "rose" | "mint" | "cream";
type KpiTile = {
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

function KpiCard({ label, value, hint, tone, icon }: KpiTile) {
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
      <div className="flex items-center gap-2 text-[26px] font-semibold tracking-tight text-scriba-ink-strong">
        {icon}
        <span>{value}</span>
      </div>
      <p className="text-[12px] font-light text-scriba-ink-mute">{hint}</p>
    </div>
  );
}

type ListCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function ListCard({ title, subtitle, children }: ListCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <div className="flex items-baseline justify-between gap-3">
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-light text-scriba-ink-mute">{children}</p>;
}

type QuickLinkProps = {
  href: string;
  children: React.ReactNode;
};

function QuickLink({ href, children }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft px-3.5 py-2 text-[12px] font-semibold text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/70"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
