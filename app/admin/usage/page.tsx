import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CopyButton } from "@/features/admin/components/CopyButton";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { UsageFilters } from "@/features/admin/components/UsageFilters";
import { ADMIN_CARD_SURFACE, ADMIN_TABLE_SURFACE } from "@/features/admin/lib/surfaces";
import {
  type AdminUsageSummary,
  listUsersForFilter,
  loadAdminUsageSummary,
  type UsageFilters as UsageFiltersType,
} from "@/lib/db/admin/usage";
import { type MoneyFormatter, makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Uso & custos" };
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

export default async function AdminUsagePage({
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
      <AdminPageHeader
        title="Uso & custos"
        subtitle="Chamadas, tokens e áudio processados, com custo por rota, usuário e sessão."
      />
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
      <SessionsTable summary={summary} money={money} filters={sp} />
      <FxRateBadge rate={rate} />
    </div>
  );
}

const SURFACE_CARD = `flex flex-col gap-1 p-5 ${ADMIN_CARD_SURFACE}`;

const TABLE_SURFACE = ADMIN_TABLE_SURFACE;

const KPI_TONES = [
  { bg: "#EAF4FE", label: "#3E86C4" },
  { bg: "#FAEAE5", label: "#A8715C" },
  { bg: "#FDF3DD", label: "#C79B2A" },
  { bg: "#E4EFEA", label: "#4E8570" },
] as const;

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: (typeof KPI_TONES)[number];
}) {
  return (
    <div className={SURFACE_CARD}>
      <div
        className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ background: tone.bg }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: tone.label }}
        >
          {label}
        </span>
      </div>
      <div className="text-[22px] font-semibold tracking-tight text-[color:var(--scriba-ink-strong)]">
        {value}
      </div>
      {hint ? (
        <p className="text-[12px] font-light text-[color:var(--scriba-ink-mute)]">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--scriba-ink-mute)]">
      {children}
    </h2>
  );
}

function TotalsGrid({ summary, money }: { summary: AdminUsageSummary; money: MoneyFormatter }) {
  const { totals, overallCostPerMinuteUsd } = summary;
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        label="Custo no período"
        value={money(totals.totalCostUsd)}
        hint={`${INT.format(totals.totalEvents)} chamadas`}
        tone={KPI_TONES[0]}
      />
      <Kpi
        label="Tokens (in / out)"
        value={`${INT.format(totals.totalPromptTokens)} / ${INT.format(totals.totalCompletionTokens)}`}
        tone={KPI_TONES[1]}
      />
      <Kpi
        label="Áudio processado"
        value={
          totals.totalAudioSeconds > 0 ? `${(totals.totalAudioSeconds / 60).toFixed(1)} min` : "—"
        }
        tone={KPI_TONES[2]}
      />
      <Kpi
        label="Custo $/min"
        value={overallCostPerMinuteUsd != null ? money(overallCostPerMinuteUsd, "fine") : "—"}
        tone={KPI_TONES[3]}
      />
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
        <SectionLabel>Por rota</SectionLabel>
        <div className={TABLE_SURFACE}>
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
                    <TableCell className="font-mono text-xs text-[color:var(--scriba-ink)]">
                      {r.route}
                    </TableCell>
                    <TableCell className="text-right">{INT.format(r.events)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {money(r.totalCostUsd, "fine")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Por usuário</SectionLabel>
        <div className={TABLE_SURFACE}>
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
                        <span className="text-sm text-[color:var(--scriba-ink)]">
                          {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                        </span>
                        {u.email ? (
                          <span className="text-[0.7rem] text-[color:var(--scriba-ink-mute)]">
                            {u.email}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{INT.format(u.events)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {money(u.totalCostUsd, "fine")}
                    </TableCell>
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

function sessionFilterHref(filters: SearchParams, sessionId: string): string {
  const p = new URLSearchParams();
  if (filters.range && filters.range !== "30d") p.set("range", filters.range);
  if (filters.userId) p.set("userId", filters.userId);
  if (filters.route) p.set("route", filters.route);
  p.set("sessionId", sessionId);
  return `/admin/usage?${p.toString()}`;
}

function SessionsTable({
  summary,
  money,
  filters,
}: {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
  filters: SearchParams;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Sessões</SectionLabel>
      <div className={TABLE_SURFACE}>
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
                <TableRow key={s.sessionId} className="group">
                  <TableCell>
                    <Link
                      className="flex flex-col text-[color:var(--scriba-ink)] transition-colors hover:text-[color:var(--scriba-blue)]"
                      href={sessionFilterHref(filters, s.sessionId)}
                      title="Filtrar por esta sessão"
                    >
                      <span className="truncate font-medium">
                        {s.title?.trim() || "Sessão sem título"}
                      </span>
                      <span className="text-[0.7rem] font-light text-[color:var(--scriba-ink-mute)]">
                        {s.createdAt ? DATE_FMT.format(new Date(s.createdAt)) : ""}
                      </span>
                    </Link>
                    <span className="mt-0.5 flex items-center font-mono text-[0.65rem] text-[color:var(--scriba-ink-mute)]/70">
                      {s.sessionId.slice(0, 8)}…
                      <CopyButton value={s.sessionId} />
                    </span>
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
