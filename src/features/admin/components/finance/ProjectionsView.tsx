"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { FinanceScenario } from "@/lib/domain/finance";
import { formatBps, formatBrlCents, formatPercent, parseMoneyToCents } from "@/lib/finance/money";
import {
  monthsToRecover,
  type ProjectionBasis,
  type ProjectionResult,
  project,
} from "@/lib/finance/projection";
import { formatMonthKey, formatMonthKeyShort } from "@/lib/finance/recurrence";
import { ScenarioDialog } from "./ScenarioDialog";

/**
 * A tela de projeções (§10–§12).
 *
 * A PROJEÇÃO É CALCULADA NO CLIENTE, e isso não contradiz "não faça cálculos
 * importantes no frontend". O que a regra proíbe é uma SEGUNDA implementação
 * do cálculo dentro de um componente; aqui o componente chama `project()` de
 * `lib/finance/projection.ts`, o mesmo módulo puro que os testes exercitam, e
 * o único lugar onde a fórmula existe. Rodar no cliente é o que permite
 * arrastar uma premissa e ver o resultado sem um round-trip por tecla, e nada
 * do que sai daqui é persistido nem cobra ninguém.
 *
 * A BASE vem do servidor e é MEDIDA. As premissas são do cenário e foram
 * digitadas. A tela diz qual é qual, porque a distinção é a diferença entre
 * uma projeção e um chute, e é ela que impede alguém de ler "R$ 40 mil no mês
 * 12" como previsão.
 */

type Props = {
  scenarios: FinanceScenario[];
  basis: ProjectionBasis;
  /** Rótulos do que foi medido, para a tela poder nomear a origem de cada base. */
  basisLabels: {
    customers: string;
    arpu: string;
    fixedCost: string;
    variableCost: string;
    paymentFee: string;
  };
};

export function ProjectionsView({ scenarios, basis, basisLabels }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<FinanceScenario | null>(null);
  const [creating, setCreating] = useState(false);
  const [investment, setInvestment] = useState("");

  const results = useMemo(() => {
    const map = new Map<string, ProjectionResult>();
    for (const scenario of scenarios) {
      map.set(
        scenario.id,
        project(basis, {
          growthBps: scenario.growthBps,
          churnBps: scenario.churnBps,
          newCustomersPerMonth: scenario.newCustomersPerMonth,
          ticketCents: scenario.ticketCents,
          extraFixedCostCents: scenario.extraFixedCostCents,
          taxBps: scenario.taxBps,
          horizonMonths: scenario.horizonMonths,
        })
      );
    }
    return map;
  }, [scenarios, basis]);

  const investmentCents = parseMoneyToCents(investment);

  async function handleDelete(scenario: FinanceScenario) {
    if (!window.confirm(`Excluir o cenário "${scenario.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/finance/scenarios/${scenario.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Cenário excluído.");
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao excluir: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* --- a base medida ------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-scriba-ink-strong">
            A base de toda projeção
          </h2>
          <span className="inline-flex items-center rounded-full bg-scriba-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-scriba-mint-accent">
            Medido
          </span>
        </div>
        <p className="text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft">
          Estes cinco números não são premissa, saem das assinaturas vivas, do custo de IA realmente
          incorrido e dos contratos recorrentes cadastrados. É o que separa uma projeção de uma
          multiplicação.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <BasisTile label="Assinantes hoje" value={basisLabels.customers} />
          <BasisTile label="Ticket médio (ARPU)" value={basisLabels.arpu} />
          <BasisTile label="Custo fixo / mês" value={basisLabels.fixedCost} />
          <BasisTile label="Custo variável / cliente" value={basisLabels.variableCost} />
          <BasisTile label="Taxa de pagamento" value={basisLabels.paymentFee} />
        </dl>
      </section>

      {/* --- comparação lado a lado --------------------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-scriba-ink-strong">
              Cenários, lado a lado
            </h2>
            <p className="text-[12px] font-light text-scriba-ink-mute">
              Projeção baseada em premissas, não é previsão.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo cenário
          </Button>
        </div>

        {scenarios.length === 0 ? (
          <p className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-8 text-center text-sm font-light text-scriba-ink-mute">
            Nenhum cenário cadastrado.
          </p>
        ) : (
          <div className="admin-table">
            <div data-slot="table-container" className="w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-scriba-paper text-left">Métrica</th>
                    {scenarios.map((s) => (
                      <th key={s.id} className="text-right">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Premissas"
                    scenarios={scenarios}
                    pick={(s) =>
                      `${formatBps(s.growthBps)} cresc. · ${formatBps(s.churnBps)} churn${
                        s.newCustomersPerMonth > 0 ? ` · +${s.newCustomersPerMonth}/mês` : ""
                      }`
                    }
                    muted
                  />
                  <ComparisonRow
                    label="Receita 6 meses"
                    scenarios={scenarios}
                    pick={(s) => formatBrlCents(results.get(s.id)?.totals.revenue6mCents ?? 0)}
                  />
                  <ComparisonRow
                    label="Lucro 6 meses"
                    scenarios={scenarios}
                    pick={(s) => formatBrlCents(results.get(s.id)?.totals.profit6mCents ?? 0)}
                    strong
                  />
                  <ComparisonRow
                    label="Receita 12 meses"
                    scenarios={scenarios}
                    pick={(s) => formatBrlCents(results.get(s.id)?.totals.revenue12mCents ?? 0)}
                  />
                  <ComparisonRow
                    label="Lucro 12 meses"
                    scenarios={scenarios}
                    pick={(s) => formatBrlCents(results.get(s.id)?.totals.profit12mCents ?? 0)}
                    strong
                  />
                  <ComparisonRow
                    label="Clientes no fim"
                    scenarios={scenarios}
                    pick={(s) =>
                      new Intl.NumberFormat("pt-BR").format(
                        results.get(s.id)?.totals.customersAtEnd ?? 0
                      )
                    }
                  />
                  <ComparisonRow
                    label="Primeiro mês no lucro"
                    scenarios={scenarios}
                    pick={(s) => {
                      const month = results.get(s.id)?.breakEvenMonth;
                      return month ? formatMonthKey(month) : "não no horizonte";
                    }}
                    muted
                  />
                  <ComparisonRow
                    label="Caixa acaba em"
                    scenarios={scenarios}
                    pick={(s) => {
                      const month = results.get(s.id)?.cashOutMonth;
                      return month ? formatMonthKey(month) : "não acaba";
                    }}
                    muted
                  />
                  {investmentCents ? (
                    <ComparisonRow
                      label={`Recupera ${formatBrlCents(investmentCents)} em`}
                      scenarios={scenarios}
                      pick={(s) => {
                        const result = results.get(s.id);
                        if (!result) return "-";
                        const months = monthsToRecover(result, investmentCents);
                        return months === null ? "além do horizonte" : `${months} mês(es)`;
                      }}
                      strong
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-4 sm:max-w-[360px]">
          <Label htmlFor="proj-investment">Payback de um investimento</Label>
          <Input
            id="proj-investment"
            inputMode="decimal"
            value={investment}
            onChange={(e) => setInvestment(e.target.value)}
            placeholder="Ex.: 5.000,00"
          />
          <p className="text-[11px] font-light leading-[1.4] text-scriba-ink-mute">
            Em quantos meses o lucro acumulado cobre este valor, em cada cenário.
          </p>
        </div>
      </section>

      {/* --- mês a mês de cada cenário ------------------------------------ */}
      {scenarios.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-scriba-ink-strong">Mês a mês</h2>
          <Tabs defaultValue={scenarios[0].id}>
            <TabsList>
              {scenarios.map((s) => (
                <TabsTab key={s.id} value={s.id}>
                  {s.name}
                </TabsTab>
              ))}
            </TabsList>
            {scenarios.map((s) => (
              <TabsPanel key={s.id} value={s.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-light text-scriba-ink-soft">
                    {formatBps(s.growthBps)} de crescimento · {formatBps(s.churnBps)} de churn ·{" "}
                    {s.newCustomersPerMonth} novo(s)/mês · ticket{" "}
                    {s.ticketCents === null ? "medido" : formatBrlCents(s.ticketCents)}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir cenário"
                      onClick={() => handleDelete(s)}
                    >
                      <Trash2 className="size-4 text-scriba-rose-accent" />
                    </Button>
                  </div>
                </div>
                <MonthTable result={results.get(s.id)} />
              </TabsPanel>
            ))}
          </Tabs>
        </section>
      ) : null}

      {creating || editing ? (
        <ScenarioDialog
          scenario={editing}
          measuredArpuCents={basis.arpuCents}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BasisTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-scriba-surface px-3.5 py-3">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-scriba-ink-mute">
        {label}
      </dt>
      <dd className="font-mono text-[15px] font-semibold tabular-nums text-scriba-ink-strong">
        {value}
      </dd>
    </div>
  );
}

function ComparisonRow({
  label,
  scenarios,
  pick,
  strong,
  muted,
}: {
  label: string;
  scenarios: FinanceScenario[];
  pick: (s: FinanceScenario) => string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-scriba-hairline last:border-0">
      <td className="sticky left-0 z-10 bg-scriba-paper whitespace-nowrap">
        <span
          className={
            strong
              ? "text-[13px] font-semibold text-scriba-ink-strong"
              : "text-[12.5px] font-light text-scriba-ink-soft"
          }
        >
          {label}
        </span>
      </td>
      {scenarios.map((s) => (
        <td key={s.id} className="whitespace-nowrap text-right">
          <span
            className={
              muted
                ? "text-[11.5px] font-light text-scriba-ink-mute"
                : strong
                  ? "font-mono text-xs font-semibold tabular-nums text-scriba-ink-strong"
                  : "font-mono text-xs tabular-nums text-scriba-ink"
            }
          >
            {pick(s)}
          </span>
        </td>
      ))}
    </tr>
  );
}

function MonthTable({ result }: { result: ProjectionResult | undefined }) {
  if (!result) return null;
  return (
    <div className="admin-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Clientes</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Custos</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead className="text-right">Margem</TableHead>
            <TableHead className="text-right">Caixa projetado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.months.map((m) => (
            <TableRow key={m.month}>
              <TableCell className="whitespace-nowrap text-[12.5px] text-scriba-ink-soft">
                {formatMonthKeyShort(m.month)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-scriba-ink">
                {new Intl.NumberFormat("pt-BR").format(m.customers)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-scriba-ink">
                {formatBrlCents(m.revenueCents)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
                {formatBrlCents(m.totalCostCents)}
              </TableCell>
              <TableCell
                className={
                  m.profitCents < 0
                    ? "text-right font-mono text-xs font-semibold text-scriba-rose-accent"
                    : "text-right font-mono text-xs font-semibold text-scriba-ink-strong"
                }
              >
                {formatBrlCents(m.profitCents)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
                {formatPercent(m.marginRatio)}
              </TableCell>
              <TableCell
                className={
                  m.cashCents < 0
                    ? "text-right font-mono text-xs font-semibold text-scriba-rose-accent"
                    : "text-right font-mono text-xs text-scriba-ink"
                }
              >
                {formatBrlCents(m.cashCents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
