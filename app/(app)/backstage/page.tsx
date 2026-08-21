import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { listUsers } from "@/lib/db/admin/users";

export const metadata: Metadata = { title: "Backstage" };
export const dynamic = "force-dynamic";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD_FINE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const INT = new Intl.NumberFormat("pt-BR");

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function BackstageOverviewPage() {
  const cutoff30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [users, summary30d, summaryAll] = await Promise.all([
    listUsers(),
    loadAdminUsageSummary({ from: cutoff30 }),
    loadAdminUsageSummary(),
  ]);

  const activeUsers = users.filter((u) => u.isActive).length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{INT.format(users.length)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {INT.format(activeUsers)} ativos · {INT.format(adminUsers)} admins
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Custo total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {USD.format(summaryAll.totals.totalCostUsd)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {INT.format(summaryAll.totals.totalEvents)} chamadas ao total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {USD.format(summary30d.totals.totalCostUsd)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {INT.format(summary30d.totals.totalEvents)} chamadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              $/min gravado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summaryAll.overallCostPerMinuteUsd != null
                ? USD_FINE.format(summaryAll.overallCostPerMinuteUsd)
                : "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Média sobre sessões com duração</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top usuários (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary30d.byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {summary30d.byUser.slice(0, 8).map((u) => (
                  <li key={u.userId} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">
                      {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                    </span>
                    <span className="font-mono text-xs">{USD.format(u.totalCostUsd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Custo por rota (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary30d.byRoute.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {summary30d.byRoute.map((r) => (
                  <li key={r.route} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs">{r.route}</span>
                    <span className="font-mono text-xs">{USD.format(r.totalCostUsd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex gap-3">
        <Link
          href="/backstage/users"
          className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground/70"
        >
          Gerenciar usuários →
        </Link>
        <Link
          href="/backstage/usage"
          className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground/70"
        >
          Ver uso detalhado →
        </Link>
      </div>
    </div>
  );
}
