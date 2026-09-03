import type { Metadata } from "next";
import Link from "next/link";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminInsightsCard } from "@/features/admin/components/AdminInsightsCard";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CopyButton } from "@/features/admin/components/CopyButton";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { UsageFilters } from "@/features/admin/components/UsageFilters";
import { readAdminInsights } from "@/lib/admin/insights/store";
import {
  type AdminUsageSummary,
  listUsersForFilter,
  loadAdminUsageSummary,
  type UsageFilters as UsageFiltersType,
} from "@/lib/db/admin/usage";
import { SESSION_MODES, type SessionMode } from "@/lib/domain/session";
import {
  type CostPerThousandCoinsFormatter,
  type MoneyFormatter,
  makeCostPerThousandCoinsFormatter,
  makeMoneyFormatter,
} from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";
import { cn } from "@/lib/utils";

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
  mode?: string;
};

function parseModeFilter(value: string | undefined): SessionMode | undefined {
  return (SESSION_MODES as readonly string[]).includes(value ?? "")
    ? (value as SessionMode)
    : undefined;
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function AdminUsagePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  const filters: UsageFiltersType = {
    from: rangeToFrom(range),
    userId: sp.userId || undefined,
    route: sp.route || undefined,
    sessionId: sp.sessionId?.trim() || undefined,
    mode: parseModeFilter(sp.mode),
  };

  const [summary, users, rate, insights] = await Promise.all([
    loadAdminUsageSummary(filters),
    listUsersForFilter(),
    getUsdToBrl(),
    readAdminInsights("usage"),
  ]);

  const money = makeMoneyFormatter(rate);
  const costPerThousandCoins = makeCostPerThousandCoinsFormatter(rate);
  const routeUniverse: string[] =
    summary.routes.length > 0
      ? summary.routes
      : ["transcribe", "extract", "suggest", "sermon-echo", "final-summary", "format-paragraphs"];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Uso & custos"
        subtitle="Chamadas e áudio processados, com custo por rota, usuário e sessão."
      />
      <UsageFilters
        users={users}
        routes={routeUniverse}
        current={{
          range,
          userId: sp.userId ?? "",
          route: sp.route ?? "",
          sessionId: sp.sessionId ?? "",
          mode: sp.mode ?? "",
        }}
      />

      <TotalsGrid summary={summary} money={money} costPerThousandCoins={costPerThousandCoins} />
      <UnpricedNote summary={summary} />
      <AdminInsightsCard scope="usage" initial={insights} />
      <RouteAndUserTables summary={summary} money={money} />
      <SessionsTable
        summary={summary}
        money={money}
        costPerThousandCoins={costPerThousandCoins}
        filters={sp}
      />
      <FxRateBadge rate={rate} />
    </div>
  );
}

const SURFACE_CARD = "flex flex-col gap-1 p-5 admin-card-surface";

const TABLE_SURFACE = "admin-table admin-card-surface overflow-hidden";

const KPI_TONES = [
  { badge: "bg-scriba-blue-soft", label: "text-scriba-blue-ink" },
  { badge: "bg-scriba-rose", label: "text-scriba-rose-accent" },
  { badge: "bg-scriba-cream", label: "text-scriba-cream-accent" },
  { badge: "bg-scriba-mint", label: "text-scriba-mint-accent" },
] as const;

type KpiProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: (typeof KPI_TONES)[number];
  icon?: React.ReactNode;
};

function Kpi({ label, value, hint, tone, icon }: KpiProps) {
  return (
    <div className={SURFACE_CARD}>
      <div
        className={cn(
          "mb-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1",
          tone.badge
        )}
      >
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", tone.label)}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-scriba-ink-strong">
        {icon}
        <span>{value}</span>
      </div>
      {hint ? <p className="text-[12px] font-light text-scriba-ink-mute">{hint}</p> : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
      {children}
    </h2>
  );
}

type TotalsGridProps = {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
  costPerThousandCoins: CostPerThousandCoinsFormatter;
};

function TotalsGrid({ summary, money, costPerThousandCoins }: TotalsGridProps) {
  const { totals, overallCostPerCoinUsd } = summary;
  const audioMin = totals.totalAudioSeconds > 0 ? totals.totalAudioSeconds / 60 : 0;
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Kpi
        label="Custo no período"
        value={money(totals.totalCostUsd)}
        hint={
          audioMin > 0
            ? `${INT.format(totals.totalEvents)} chamadas · ${audioMin
                .toFixed(1)
                .replace(".", ",")} min de áudio`
            : `${INT.format(totals.totalEvents)} chamadas`
        }
        tone={KPI_TONES[0]}
      />
      <Kpi
        label="Moedas gastas"
        value={INT.format(totals.totalCoins)}
        icon={<CoinMark size={22} />}
        tone={KPI_TONES[2]}
      />
      <Kpi
        label="Custo por 1.000 moedas"
        value={costPerThousandCoins(overallCostPerCoinUsd)}
        hint="Total gasto ÷ moedas debitadas × 1.000"
        icon={<CoinMark size={22} />}
        tone={KPI_TONES[3]}
      />
    </section>
  );
}

/**
 * O aviso que precede qualquer leitura desta tela: chamadas cujo modelo não
 * está em `lib/llm/pricing.ts` gravaram custo ZERO.
 *
 * Ele não é decoração de robustez — é a única forma de o painel dizer que está
 * mentindo. Sem ele, um modelo novo configurado por env var faz o custo de uma
 * etapa inteira desaparecer, a margem daquela ação sobe, e a tela de
 * precificação recomenda BAIXAR um preço que já não se paga. O sintoma é uma
 * conta boa demais, que é o sintoma que ninguém investiga.
 *
 * O conserto é sempre o mesmo: acrescentar o modelo à tabela de preços.
 */
function UnpricedNote({ summary }: { summary: AdminUsageSummary }) {
  if (summary.unpricedEvents === 0) return null;
  const share =
    summary.totals.totalEvents > 0 ? summary.unpricedEvents / summary.totals.totalEvents : 0;
  return (
    <section className="rounded-2xl border border-scriba-rose-accent/30 bg-scriba-rose p-5">
      <h2 className="text-[14px] font-semibold text-scriba-rose-accent">Custo subestimado</h2>
      <p className="mt-1 text-[12.5px] font-light leading-relaxed text-scriba-ink">
        {INT.format(summary.unpricedEvents)} de {INT.format(summary.totals.totalEvents)} chamadas (
        {(share * 100).toFixed(1).replace(".", ",")}%) rodaram em modelos que não estão na tabela de
        preços interna e gravaram custo <span className="font-mono">R$ 0,00</span>:{" "}
        <span className="font-mono">{summary.unpricedModels.join(", ")}</span>. Todo custo e toda
        margem desta tela e da de precificação estão baixos na proporção do que elas consumiram.
        Acrescente esses modelos a <span className="font-mono">lib/llm/pricing.ts</span> — os
        eventos já gravados continuarão em zero.
      </p>
    </section>
  );
}

type RouteAndUserTablesProps = {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
};

function RouteAndUserTables({ summary, money }: RouteAndUserTablesProps) {
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
                    <TableCell className="font-mono text-xs text-scriba-ink">{r.route}</TableCell>
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
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <CoinMark size={14} /> Moedas
                  </span>
                </TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Sem eventos.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byUser.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-scriba-ink">
                          {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                        </span>
                        {u.email ? (
                          <span className="text-[0.7rem] text-scriba-ink-mute">{u.email}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {u.totalCoins > 0 ? INT.format(u.totalCoins) : "—"}
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
  if (filters.mode) p.set("mode", filters.mode);
  p.set("sessionId", sessionId);
  return `/admin/usage?${p.toString()}`;
}

function ModeBadge({ mode }: { mode: SessionMode | null }) {
  if (mode === "live") {
    return (
      <span className="inline-flex items-center rounded-full bg-scriba-mint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-scriba-mint-accent">
        Com live
      </span>
    );
  }
  if (mode === "audio_only") {
    return (
      <span className="inline-flex items-center rounded-full bg-scriba-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-scriba-cream-accent">
        Sem live
      </span>
    );
  }
  if (mode === "transcript_only") {
    return (
      <span className="inline-flex items-center rounded-full bg-scriba-hairline-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-scriba-ink-soft">
        Transcrição
      </span>
    );
  }
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

type SessionsTableProps = {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
  costPerThousandCoins: CostPerThousandCoinsFormatter;
  filters: SearchParams;
};

function SessionsTable({ summary, money, costPerThousandCoins, filters }: SessionsTableProps) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Sessões</SectionLabel>
      <div className={TABLE_SURFACE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sessão</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Chamadas</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Moedas
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Por 1.000
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.bySession.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão com eventos.
                </TableCell>
              </TableRow>
            ) : (
              summary.bySession.map((s) => (
                <TableRow key={s.sessionId} className="group">
                  <TableCell>
                    <Link
                      className="flex flex-col text-scriba-ink transition-colors hover:text-scriba-blue-ink"
                      href={sessionFilterHref(filters, s.sessionId)}
                      title="Filtrar por esta sessão"
                    >
                      <span className="truncate font-medium">
                        {s.title?.trim() || "Sessão sem título"}
                      </span>
                      <span className="text-[0.7rem] font-light text-scriba-ink-mute">
                        {s.createdAt ? DATE_FMT.format(new Date(s.createdAt)) : ""}
                      </span>
                    </Link>
                    <span className="mt-0.5 flex items-center font-mono text-[0.65rem] text-scriba-ink-mute/70">
                      {s.sessionId.slice(0, 8)}…
                      <CopyButton value={s.sessionId} />
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.ownerDisplayName || (s.userId ? s.userId.slice(0, 8) : "—")}
                  </TableCell>
                  <TableCell>
                    <ModeBadge mode={s.mode} />
                  </TableCell>
                  <TableCell className="text-right">{formatDuration(s.durationMs)}</TableCell>
                  <TableCell className="text-right">{INT.format(s.events)}</TableCell>
                  <TableCell className="text-right">{money(s.totalCostUsd, "fine")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.coins > 0 ? INT.format(s.coins) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {costPerThousandCoins(s.costPerCoinUsd)}
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
