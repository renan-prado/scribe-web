import type { Metadata } from "next";
import { CoinMark } from "@/components/icons/CoinMark";
import { AccessChart, type AccessChartPoint } from "@/features/admin/components/AccessChart";
import {
  EmptyState,
  KpiCard,
  KpiGrid,
  type KpiTile,
  ListCard,
} from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { type AccessPoint, loadAdminAccessMetrics } from "@/features/admin/server/db/access";
import { loadAdminMetrics, type SignupPoint } from "@/features/admin/server/db/metrics";
import { loadAdminUsageSummary } from "@/features/admin/server/db/usage";
import { formatBrl, PLANS } from "@/features/billing/plans";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Métricas" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

/**
 * Funil, ativação e passivo de moedas: o CAMINHO até a assinatura.
 *
 * Quantos assinam, quantos chegam a gravar alguma coisa, se as moedas de
 * boas-vindas estão sendo usadas, e quanto de OpenAI já foi vendido e ainda
 * não gasto.
 *
 * Quanto a assinatura RENDE não é assunto daqui. O MRR morava nesta fileira e
 * também no Financeiro, calculado por duas consultas diferentes sobre a mesma
 * definição (`metrics.ts` e `finance.ts`), e ver o mesmo número em duas telas
 * faz quem lê conferir se batem em vez de ler o funil.
 *
 * O custo por moeda é MEDIDO (`loadAdminUsageSummary` + câmbio), não fixado:
 * ele muda com o dólar e com o preço do modelo, e é a base da conversão do
 * passivo em reais.
 */
const ACCESS_CHART_DAYS = 90;

export default async function AdminMetricsPage() {
  const [rate, usage, access] = await Promise.all([
    getUsdToBrl(),
    loadAdminUsageSummary(),
    loadAdminAccessMetrics(ACCESS_CHART_DAYS),
  ]);

  // USD/moeda → centavos de BRL por 1.000 moedas. Sem câmbio disponível o
  // passivo aparece zerado em vez de errado, a tela diz que falta a cotação.
  const costPerThousandCents =
    rate && usage.overallCostPerCoinUsd
      ? Math.round(usage.overallCostPerCoinUsd * 1000 * rate.rate * 100)
      : 0;

  const metrics = await loadAdminMetrics({}, costPerThousandCents);
  const { funnel, welcomeCoins, revenue, liability } = metrics;

  // O MRR saiu daqui, e o lugar dele é a Visão geral (o número do dia) e o
  // Financeiro (a série mensal). Ele aparecia nesta fileira ao lado de
  // "Assinantes ativos", e as duas telas publicavam o mesmo valor por duas
  // consultas diferentes: quem via os dois passava a conferir se batiam em vez
  // de ler o funil, que é a pergunta desta tela. O que fica aqui é o CAMINHO
  // até a assinatura; quanto ela rende é assunto de dinheiro.
  const tiles: KpiTile[] = [
    {
      label: "Cadastros",
      value: INT.format(funnel.signups),
      hint: `${INT.format(funnel.activated)} gravaram algo · ${pct(funnel.activationRate)} de ativação`,
    },
    {
      label: "Assinantes ativos",
      value: INT.format(funnel.activeSubscribers),
      hint: `${pct(funnel.conversionRate)} de conversão · ${INT.format(revenue.cancelScheduled)} com cancelamento agendado`,
    },
    {
      // Mediana e não média: um único usuário que assinou depois de um ano
      // deslocaria a média e faria o número mentir sobre o caso típico.
      label: "Tempo até assinar",
      value:
        metrics.medianDaysToSubscribe === null
          ? "-"
          : `${metrics.medianDaysToSubscribe.toLocaleString("pt-BR")} dias`,
      hint:
        metrics.medianDaysToSubscribe === null
          ? "nenhuma assinatura registrada ainda"
          : "mediana entre o cadastro e a primeira assinatura",
    },
    {
      label: "Moedas em circulação",
      value: INT.format(liability.outstanding),
      hint: costPerThousandCents
        ? `${formatBrl(liability.outstandingCostCents)} de custo já vendido`
        : "sem cotação do dólar para converter",
      icon: <CoinMark size={22} />,
    },
  ];

  const funnelSteps = [
    { label: "Cadastraram", value: funnel.signups },
    { label: "Gastaram ao menos 1 moeda", value: funnel.spentAny },
    { label: "Gravaram uma sessão", value: funnel.activated },
    { label: "Zeraram as moedas iniciais", value: funnel.exhaustedFreeCoins },
    { label: "Assinaram alguma vez", value: funnel.everSubscribed },
    { label: "Assinantes hoje", value: funnel.activeSubscribers },
  ];

  const welcomeRows = [
    { label: "Não usaram nenhuma", value: welcomeCoins.untouched },
    {
      label: `Usaram até metade (< ${Math.floor(INITIAL_COIN_BALANCE / 2)})`,
      value: welcomeCoins.partial,
    },
    { label: "Usaram mais da metade", value: welcomeCoins.most },
    { label: `Gastaram as ${INITIAL_COIN_BALANCE} ou mais`, value: welcomeCoins.exhausted },
  ];

  const accessSeries = buildAccessSeries(metrics.signupsByDay, access.byDay, ACCESS_CHART_DAYS);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Métricas"
        subtitle="O caminho da visita até a assinatura: funil, ativação, quem volta a cada dia e o passivo de moedas."
      />

      <KpiGrid>
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </KpiGrid>

      <AccessChart data={accessSeries} />

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Funil" subtitle="Base completa">
          {funnel.signups === 0 ? (
            <EmptyState>Nenhuma conta cadastrada ainda.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {funnelSteps.map((step) => (
                <FunnelBar
                  key={step.label}
                  label={step.label}
                  value={step.value}
                  total={funnel.signups}
                />
              ))}
            </ul>
          )}
        </ListCard>

        <div className="flex flex-col gap-4">
          <ListCard
            title={`Uso das ${INITIAL_COIN_BALANCE} moedas de boas-vindas`}
            subtitle="Por conta"
          >
            {funnel.signups === 0 ? (
              <EmptyState>Nenhuma conta cadastrada ainda.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-scriba-hairline">
                {welcomeRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="text-scriba-ink">{row.label}</span>
                    <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
                      {INT.format(row.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* Quem zera o saldo é o sinal mais forte de intenção de compra que
                temos: a pessoa consumiu tudo o que era grátis e quis mais. */}
            <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
              Quem zera o saldo é o sinal mais forte de intenção de compra, consumiu tudo o que era
              grátis e quis continuar.
            </p>
          </ListCard>

          <ListCard title="Planos ativos" subtitle="Assinaturas vivas">
            {funnel.activeSubscribers === 0 ? (
              <EmptyState>Nenhuma assinatura ativa.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-scriba-hairline">
                {(["pessoal", "estudioso"] as const).map((plan) => (
                  <li key={plan} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-scriba-ink">{PLANS[plan].name}</span>
                    <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
                      {INT.format(revenue.activeByPlan[plan])} ·{" "}
                      {formatBrl(revenue.activeByPlan[plan] * PLANS[plan].priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>
        </div>
      </section>

      {/* O passivo ocupa a largura inteira: o cartão "Tempo até assinar" que
          dividia esta faixa virou KPI lá em cima, onde um número solto com uma
          frase de legenda cabe melhor do que num cartão da altura de uma
          tabela. */}
      <section className="grid gap-4">
        <ListCard title="Passivo de moedas" subtitle="Agora">
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            <MetricRow label="Creditadas (total)" value={INT.format(liability.granted)} />
            <MetricRow label="Gastas (total)" value={INT.format(liability.spent)} />
            <MetricRow label="Em circulação" value={INT.format(liability.outstanding)} strong />
          </ul>
          {/* Créditos acumulam de um mês para o outro, então o saldo parado é
              custo de OpenAI já vendido e ainda não incorrido. */}
          <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
            Os créditos acumulam de um mês para o outro, então o saldo parado é custo de OpenAI já
            vendido e ainda não gasto.
          </p>
        </ListCard>
      </section>
    </div>
  );
}

/**
 * Uma linha por dia, sempre, mesmo nos dias sem nenhum pulso e sem nenhum
 * cadastro. `signupsByDay` e `access.byDay` só têm entrada para dias com pelo
 * menos uma linha, e um gráfico de área com buracos no eixo lê como falha de
 * coleta, não como "zero naquele dia" — que é o que de fato aconteceu.
 */
function buildAccessSeries(
  signups: SignupPoint[],
  access: AccessPoint[],
  days: number
): AccessChartPoint[] {
  const cadastrosByDay = new Map(signups.map((p) => [p.day, p.count]));
  const acessosByDay = new Map(access.map((p) => [p.day, p.count]));

  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  const series: AccessChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    series.push({
      day,
      acessos: acessosByDay.get(day) ?? 0,
      cadastros: cadastrosByDay.get(day) ?? 0,
    });
  }
  return series;
}

function MetricRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-scriba-ink">{label}</span>
      <span
        className={
          strong
            ? "font-mono text-xs font-semibold text-scriba-ink-strong"
            : "font-mono text-xs text-scriba-ink-soft"
        }
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Barra de etapa do funil. A largura é relativa ao topo (cadastros), não à
 * etapa anterior: assim dá para ler de relance quanto de TODA a base chegou
 * até ali, que é a pergunta que importa.
 */
function FunnelBar({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-scriba-ink">{label}</span>
        <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
          {INT.format(value)}
          <span className="ml-1.5 font-normal text-scriba-ink-mute">{pct(ratio)}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-scriba-surface">
        <div
          className="h-full rounded-full bg-scriba-blue"
          style={{ width: `${Math.max(ratio * 100, value > 0 ? 1.5 : 0)}%` }}
        />
      </div>
    </li>
  );
}
