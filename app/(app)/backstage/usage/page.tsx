import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { UsageFilters } from "@/features/admin/components/UsageFilters";
import {
  type AdminUsageSummary,
  listUsersForFilter,
  loadAdminUsageSummary,
  type UsageFilters as UsageFiltersType,
} from "@/lib/db/admin/usage";
import { type MoneyFormatter, makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Uso & custos — Backstage" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const RANGES = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
} as const;

function rangeToFrom(range: string | undefined): string | undefined {
  const key = (range ?? "30d") as keyof typeof RANGES;
  const days = RANGES[key];
  if (!days) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type SearchParams = {
  range?: string;
  userId?: string;
  route?: string;
  sessionId?: string;
};

export default async function BackstageUsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  const filters: UsageFiltersType = {
    from: rangeToFrom(range),
    userId: sp.userId || undefined,
    route: sp.route || undefined,
    sessionId: sp.sessionId?.trim() || undefined,
  };

  const [summary, users, rate] = await Promise.all([
    loadAdminUsageSummary(filters),
    listUsersForFilter(),
    getUsdToBrl(),
  ]);

  const money = makeMoneyFormatter(rate);
  const routeUniverse: string[] =
    summary.routes.length > 0
      ? summary.routes
      : ["transcribe", "extract", "suggest", "sermon-echo", "final-summary", "format-paragraphs"];

  return (
    <div className="flex flex-col gap-6">
      <UsageFilters
        users={users}
        routes={routeUniverse}
        current={{
          range,
          userId: sp.userId ?? "",
          route: sp.route ?? "",
          sessionId: sp.sessionId ?? "",
        }}
      />

      <TotalsGrid summary={summary} money={money} />
      <RouteAndUserTables summary={summary} money={money} />
      <SessionsTable summary={summary} money={money} />
      <FxRateBadge rate={rate} />
    </div>
  );
}

function TotalsGrid({ summary, money }: { summary: AdminUsageSummary; money: MoneyFormatter }) {
  const { totals, overallCostPerMinuteUsd } = summary;
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Custo no período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{money(totals.totalCostUsd)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {INT.format(totals.totalEvents)} chamadas
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Tokens (in / out)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold tabular-nums">
            {INT.format(totals.totalPromptTokens)} / {INT.format(totals.totalCompletionTokens)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Áudio processado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {totals.totalAudioSeconds > 0
              ? `${(totals.totalAudioSeconds / 60).toFixed(1)} min`
              : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Custo por minuto gravado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {overallCostPerMinuteUsd != null ? money(overallCostPerMinuteUsd, "fine") : "—"}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RouteAndUserTables({
  summary,
  money,
}: {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
          Por rota
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byRoute.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Sem eventos.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byRoute.map((r) => (
                  <TableRow key={r.route}>
                    <TableCell className="font-mono text-xs">{r.route}</TableCell>
                    <TableCell className="text-right">{INT.format(r.events)}</TableCell>
                    <TableCell className="text-right">{money(r.totalCostUsd, "fine")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
          Por usuário
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Sem eventos.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byUser.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                        </span>
                        {u.email ? (
                          <span className="text-[0.7rem] text-muted-foreground">{u.email}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{INT.format(u.events)}</TableCell>
                    <TableCell className="text-right">{money(u.totalCostUsd, "fine")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

function SessionsTable({ summary, money }: { summary: AdminUsageSummary; money: MoneyFormatter }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
        Sessões
      </h2>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sessão</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Chamadas</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Por minuto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.bySession.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão com eventos.
                </TableCell>
              </TableRow>
            ) : (
              summary.bySession.map((s) => (
                <TableRow key={s.sessionId}>
                  <TableCell>
                    <Link
                      className="flex flex-col hover:underline"
                      href={`/recording/${s.sessionId}/summary`}
                    >
                      <span className="truncate">{s.title?.trim() || "Sessão sem título"}</span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {s.createdAt ? DATE_FMT.format(new Date(s.createdAt)) : ""}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.ownerDisplayName || (s.userId ? s.userId.slice(0, 8) : "—")}
                  </TableCell>
                  <TableCell className="text-right">{formatDuration(s.durationMs)}</TableCell>
                  <TableCell className="text-right">{INT.format(s.events)}</TableCell>
                  <TableCell className="text-right">{money(s.totalCostUsd, "fine")}</TableCell>
                  <TableCell className="text-right">
                    {s.costPerMinuteUsd != null ? money(s.costPerMinuteUsd, "fine") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
