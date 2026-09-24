import type { Metadata } from "next";
import { CoinMark } from "@/components/icons/CoinMark";
import { KpiCard, KpiGrid, type KpiTile, QuickLink } from "@/features/admin/components/AdminCards";
import { AdminInsightsPanel } from "@/features/admin/components/AdminInsightsPanel";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { formatBrlCents, formatPercent } from "@/features/admin/finance/money";
import { loadAdminAccessMetrics } from "@/features/admin/server/db/access";
import { loadFinanceSnapshot } from "@/features/admin/server/db/finance-overview";
import { loadAdminUsageSummary } from "@/features/admin/server/db/usage";
import { readAdminInsights } from "@/features/admin/server/insights/store";
import { makeCostPerThousandCoinsFormatter, makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Os cinco números que se confere todo dia, e a leitura que a IA faz deles.
 *
 * Esta tela já foi o oposto disso: quatro KPIs e duas listas que saíam todos
 * de `loadAdminUsageSummary`, ou seja, /admin/costs com filtro fixo de 30
 * dias e sem filtro nenhum para mexer. "Visão geral" não mostrava MRR, nem
 * caixa, nem funil, e quem abria o painel para saber como o produto ia
 * precisava sair dela imediatamente — e o rodapé, com quatro atalhos, era um
 * menu dentro de uma tela que já tinha menu.
 *
 * O que ela é agora: **um número por assunto, cada um com a porta da tela que
 * o explica.** Nenhuma tabela, porque tabela é o que as outras telas fazem
 * melhor; nenhum recorte, porque escolher período é a pergunta seguinte, e ela
 * se faz lá dentro.
 *
 * A leitura da IA mora aqui pela mesma razão. Ela é uma síntese do negócio
 * inteiro (custo, preço, funil e passivo saem dos MESMOS agregados das outras
 * telas, ver `insights/briefing.ts`), então o lugar dela é a tela que também
 * é síntese, e não uma linha própria no menu que só continha um botão. Ela
 * continua **só rodando no clique**: nada nesta página dispara uma chamada de
 * LLM sozinho.
 */
export default async function AdminOverviewPage() {
  const cutoff30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [{ overview, usdBrl }, summary30d, rate, insights, access] = await Promise.all([
    loadFinanceSnapshot(),
    loadAdminUsageSummary({ from: cutoff30 }),
    getUsdToBrl(),
    readAdminInsights().catch(() => null),
    loadAdminAccessMetrics(0),
  ]);

  const { current, indicators, commitments } = overview;
  const money = makeMoneyFormatter(rate);
  const costPerThousandCoins = makeCostPerThousandCoinsFormatter(rate);

  const tiles: KpiTile[] = [
    {
      label: "MRR",
      value: formatBrlCents(indicators.mrrCents),
      hint: `${INT.format(indicators.activeSubscribers)} assinantes · ARPU ${formatBrlCents(indicators.arpuCents)}`,
    },
    {
      label: "Lucro do mês",
      value: formatBrlCents(current.netProfitCents),
      hint: `margem ${formatPercent(current.marginRatio)} · ${formatBrlCents(current.expenseCents)} de despesa`,
      // O sinal do lucro é a pastilha, e não a cor do cartão: ela diz para que
      // lado o número anda em vez de esperar que quem lê saiba o que o tom
      // queria dizer.
      trend: {
        direction: current.netProfitCents >= 0 ? "up" : "down",
        label: current.netProfitCents >= 0 ? "no azul" : "no vermelho",
      },
    },
    {
      label: "Caixa",
      value: formatBrlCents(indicators.cashBalanceCents),
      hint:
        indicators.runwayMonths === null
          ? indicators.cashBalanceCents <= 0
            ? "informe o saldo no Financeiro para ter runway"
            : "sem queima nos últimos meses"
          : `${indicators.runwayMonths.toLocaleString("pt-BR")} meses de runway`,
      trend:
        indicators.runwayMonths !== null && indicators.runwayMonths < 6
          ? { direction: "down", label: "runway curto" }
          : undefined,
    },
    {
      label: "Custo de IA (30 dias)",
      value: money(summary30d.totals.totalCostUsd),
      // "de clientes" não é enfeite: desde a migração 0073 este número é
      // recortado (as contas de Backoffice ficam de fora, ver
      // `features/admin/audience.ts`), e o card do Financeiro ao lado mede
      // CAIXA — o dólar dos testes saiu da conta da OpenAI do mesmo jeito.
      // Sem a palavra, os dois discordariam na mesma tela sem dizer por quê.
      hint: `${INT.format(summary30d.totals.totalEvents)} chamadas de clientes · ${costPerThousandCoins(
        summary30d.overallCostPerCoinUsd
      )} por 1.000 moedas`,
      icon: <CoinMark size={22} />,
    },
    {
      label: "Acessos hoje",
      value: INT.format(access.today),
      // "Online agora" é aproximado (pulso nos últimos 5 minutos, ver
      // `server/db/access.ts`), não uma contagem de conexão aberta.
      hint: `~${INT.format(access.onlineNow)} online agora`,
    },
  ];

  // OS AVISOS VÊM ANTES DOS NÚMEROS. Um painel erra em silêncio, e o sintoma é
  // sempre uma conta boa demais, que é a que ninguém investiga. Os três daqui
  // são os que tornam TODA a tela menos confiável, não só uma linha dela.
  const blocking =
    usdBrl === null
      ? [
          "Sem cotação do dólar: todo valor em US$ ficou fora dos totais desta tela e do Financeiro. Informe uma à mão no selo de câmbio abaixo.",
        ]
      : [];
  const warnings = [
    ...overview.warnings,
    ...(summary30d.unpricedEvents > 0
      ? [
          `${INT.format(summary30d.unpricedEvents)} chamadas rodaram em modelos fora da tabela de preços (${summary30d.unpricedModels.join(", ")}) e gravaram custo zero. Todo custo e toda margem estão baixos na proporção delas.`,
        ]
      : []),
    ...(commitments.overdueCents > 0
      ? [`${formatBrlCents(commitments.overdueCents)} em compromissos já vencidos.`]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Visão geral"
        subtitle="Um número por assunto, e a leitura que a IA faz de todos eles."
      />

      <FinanceNotices warnings={blocking} tone="danger" />
      <FinanceNotices warnings={warnings} />

      <KpiGrid>
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </KpiGrid>

      <AdminInsightsPanel initial={insights} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Os atalhos não são decoração: a leitura acima cita margem, rota e
            funil, e quem quiser conferir um número precisa chegar à tabela que
            o publica sem caçar no menu. */}
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/admin/costs">Custos e margem</QuickLink>
          <QuickLink href="/admin/metrics">Funil e ativação</QuickLink>
          <QuickLink href="/admin/finance">Financeiro</QuickLink>
          {/* A porta da conta que esta tela deixa de fora. Ela existe para que
              "quanto me custa testar o meu próprio produto" continue tendo
              resposta depois de o Backoffice sair de todos os números acima. */}
          <QuickLink href="/admin/costs?audience=internal">Backoffice</QuickLink>
        </div>
        <FxRateBadge rate={rate} />
      </div>
    </div>
  );
}
