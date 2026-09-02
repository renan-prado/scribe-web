import type { Metadata } from "next";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  EmptyState,
  KpiCard,
  type KpiTile,
  ListCard,
  QuickLink,
} from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { listUsers } from "@/lib/db/admin/users";
import { makeCostPerThousandCoinsFormatter, makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

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
  const costPerThousandCoins = makeCostPerThousandCoinsFormatter(rate);
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
      label: "Custo por 1.000 moedas",
      value: costPerThousandCoins(summaryAll.overallCostPerCoinUsd),
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
          <QuickLink href="/admin/metricas">Métricas do produto</QuickLink>
          <QuickLink href="/admin/usage">Ver uso detalhado</QuickLink>
        </div>
        <FxRateBadge rate={rate} />
      </div>
    </div>
  );
}
