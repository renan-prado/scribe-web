import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import {
  EmptyState,
  KpiCard,
  type KpiTile,
  ListCard,
  QuickLink,
} from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { MonthlyBars, MonthlyTable } from "@/features/admin/components/finance/MonthlyTable";
import { loadFinanceSnapshot } from "@/lib/db/admin/finance-overview";
import { formatBrlCents, formatPercent, formatSignedPercent } from "@/lib/finance/money";
import { formatMonthKey } from "@/lib/finance/recurrence";

export const metadata: Metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");

/**
 * A visão geral do controle financeiro.
 *
 * Ela responde, em ordem, às perguntas do topo da especificação: quanto
 * entrou, quanto saiu, quanto sobrou, quanto devemos e por quanto tempo o
 * caixa aguenta. Nada aqui é calculado na página — tudo vem de
 * `buildFinanceOverview`, que é puro e testado.
 *
 * OS AVISOS VÊM ANTES DOS NÚMEROS, e não depois. Um painel financeiro erra em
 * silêncio: sem cotação do dólar ou com a receita contada duas vezes, o total
 * continua plausível. Ler o número antes da ressalva é como a ressalva deixa
 * de ser lida.
 */
export default async function FinanceOverviewPage() {
  const { overview, settings, usdBrl, fxSource } = await loadFinanceSnapshot();
  const { current, previous, indicators, recurring, commitments } = overview;

  const revenueGrowth =
    previous && previous.revenueCents > 0
      ? (current.revenueCents - previous.revenueCents) / previous.revenueCents
      : null;

  const tiles: KpiTile[] = [
    {
      label: "Receita do mês",
      value: formatBrlCents(current.revenueCents),
      hint: previous
        ? `${formatSignedPercent(revenueGrowth)} contra ${formatMonthKey(previous.month)}`
        : "sem mês anterior para comparar",
      tone: "mint",
    },
    {
      label: "Despesas do mês",
      value: formatBrlCents(current.expenseCents),
      hint: `${formatBrlCents(current.fixedCents)} fixos · ${formatBrlCents(current.variableCents)} variáveis`,
      tone: "rose",
    },
    {
      label: "Lucro do mês",
      value: formatBrlCents(current.netProfitCents),
      hint:
        current.taxCents > 0
          ? `margem ${formatPercent(current.marginRatio)} · ${formatBrlCents(current.taxCents)} de imposto`
          : `margem ${formatPercent(current.marginRatio)} · sem alíquota configurada`,
      tone: current.netProfitCents >= 0 ? "blue" : "rose",
    },
    {
      label: "A pagar",
      value: formatBrlCents(commitments.payableCents),
      hint:
        commitments.overdueCents > 0
          ? `${formatBrlCents(commitments.overdueCents)} já vencido`
          : `${formatBrlCents(commitments.dueNext30Cents)} nos próximos 30 dias`,
      tone: "cream",
    },
  ];

  // A ausência de cotação é a única coisa que impede a leitura, então ela é a
  // única que aparece em vermelho. O resto é amarelo — ver `FinanceNotices`.
  const blocking =
    usdBrl === null
      ? [
          "Sem cotação do dólar. Informe uma manualmente em /admin/usage — sem ela, todo valor em US$ fica fora dos totais.",
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Financeiro"
        subtitle="Quanto entra, quanto sai, quanto devemos e para onde estamos indo."
      />

      <FinanceNotices warnings={blocking} tone="danger" />
      <FinanceNotices warnings={overview.warnings} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Recorrentes" subtitle="Compromisso mensal">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <Row
              label="Custo mensal equivalente"
              value={formatBrlCents(recurring.monthlyCents)}
              strong
            />
            <Row label="Custo anual equivalente" value={formatBrlCents(recurring.annualCents)} />
            <Row label="Fixos" value={formatBrlCents(recurring.fixedMonthlyCents)} />
            <Row label="Variáveis" value={formatBrlCents(recurring.variableMonthlyCents)} />
            <Row
              label="Contratos"
              value={`${INT.format(recurring.activeCount)} ativos · ${INT.format(recurring.cancelledCount)} cancelados`}
            />
          </ul>
          <QuickLink href="/admin/financeiro/recorrentes">Ver custos recorrentes</QuickLink>
        </ListCard>

        <ListCard title="Indicadores" subtitle="Agora">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <Row label="MRR" value={formatBrlCents(indicators.mrrCents)} strong />
            <Row
              label="Assinantes ativos"
              value={`${INT.format(indicators.activeSubscribers)} · ARPU ${formatBrlCents(indicators.arpuCents)}`}
            />
            <Row
              label="Custo por assinante"
              value={formatBrlCents(indicators.costPerCustomerCents)}
            />
            <Row
              label="Fatia de IA e taxas no custo"
              value={formatPercent(indicators.aiCostShare)}
            />
          </ul>
          {/* Custo por assinante divide o custo TOTAL do mês pelos assinantes
              pagantes, então ele inclui o que os usuários gratuitos consomem.
              É de propósito: é o custo que a base paga tem de cobrir. */}
          <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
            O custo por assinante divide o custo total do mês — inclusive o que a base gratuita
            consome — pelos assinantes pagantes. É o que eles precisam cobrir.
          </p>
        </ListCard>

        <ListCard title="Caixa" subtitle="Sobrevivência">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <Row
              label="Saldo informado"
              value={formatBrlCents(indicators.cashBalanceCents)}
              strong
            />
            <Row
              label="Queima média (3 meses)"
              value={
                indicators.burnRateCents > 0
                  ? formatBrlCents(indicators.burnRateCents)
                  : `sobra ${formatBrlCents(-indicators.burnRateCents)}`
              }
            />
            <Row
              label="Runway"
              value={
                indicators.runwayMonths === null
                  ? indicators.cashBalanceCents <= 0
                    ? "sem saldo informado"
                    : "sem queima"
                  : `${indicators.runwayMonths.toLocaleString("pt-BR")} meses`
              }
            />
            <Row label="Caixa do mês" value={formatBrlCents(current.cashNetCents)} />
          </ul>
          {settings.cashBalanceAt ? (
            <p className="text-[11.5px] font-light text-scriba-ink-mute">
              Saldo conferido em {settings.cashBalanceAt.split("-").reverse().join("/")}.
            </p>
          ) : (
            <p className="text-[11.5px] font-light text-scriba-ink-mute">
              Informe o saldo em caixa nas configurações — sem ele não há runway.
            </p>
          )}
          <QuickLink href="/admin/financeiro/configuracoes">Configurações</QuickLink>
        </ListCard>
      </section>

      <ListCard
        title="Evolução mensal"
        subtitle={
          fxSource === "manual"
            ? "Competência · câmbio manual"
            : fxSource === "awesomeapi"
              ? `Competência · câmbio ${usdBrl?.toFixed(2).replace(".", ",")}`
              : "Competência"
        }
      >
        {overview.months.length === 0 ? (
          <EmptyState>Sem meses no período.</EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            <MonthlyBars months={overview.months} />
            <MonthlyTable months={overview.months} />
            {/* Os dois regimes têm de estar nomeados na tela, não só no código:
                "custo do mês" e "saída de caixa do mês" são números diferentes
                e ninguém adivinha qual está lendo. */}
            <p className="text-[11.5px] font-light leading-[1.55] text-scriba-ink-mute">
              A tabela está em <strong>competência</strong>: cada valor pertence ao mês que ele
              descreve, e uma cobrança anual entra rateada em doze. A linha “Caixa do mês” é o outro
              regime — o que efetivamente entrou e saiu, com a anual inteira no mês em que foi
              cobrada.
            </p>
          </div>
        )}
      </ListCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard title="O que ainda devemos" subtitle="Compromissos">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <Row label="Total a pagar" value={formatBrlCents(commitments.payableCents)} strong />
            <Row label="Vencido" value={formatBrlCents(commitments.overdueCents)} />
            <Row label="Vence em 30 dias" value={formatBrlCents(commitments.dueNext30Cents)} />
            <Row
              label="Comissões de parceiro"
              value={formatBrlCents(commitments.partnerOwedCents)}
            />
            <Row label="A receber" value={formatBrlCents(commitments.receivableCents)} />
          </ul>
          <QuickLink href="/admin/financeiro/compromissos">Ver compromissos</QuickLink>
        </ListCard>

        <ListCard title="Últimos 12 meses" subtitle="Acumulado em competência">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <Row label="Receita" value={formatBrlCents(overview.trailing.revenueCents)} />
            <Row label="Despesas" value={formatBrlCents(overview.trailing.expenseCents)} />
            <Row label="Lucro" value={formatBrlCents(overview.trailing.netProfitCents)} strong />
          </ul>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/admin/financeiro/lancamentos">Lançamentos</QuickLink>
            <QuickLink href="/admin/financeiro/projecoes">Projeções</QuickLink>
          </div>
        </ListCard>
      </section>

      <p className="flex items-start gap-2 text-[11.5px] font-light leading-[1.55] text-scriba-ink-mute">
        <Landmark className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Receita de assinatura e custo de IA são <strong>medidos</strong> — saem do ledger de
          créditos e de <code>llm_usage_events</code>, as mesmas fontes de /admin/métricas e
          /admin/uso. O que se lança à mão aqui é só o que ninguém mede por nós.
        </span>
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-scriba-ink">{label}</span>
      <span
        className={
          strong
            ? "font-mono text-xs font-semibold tabular-nums text-scriba-ink-strong"
            : "font-mono text-xs tabular-nums text-scriba-ink-soft"
        }
      >
        {value}
      </span>
    </li>
  );
}
