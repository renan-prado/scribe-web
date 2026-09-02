import type { Metadata } from "next";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  EmptyState,
  KpiCard,
  type KpiTile,
  ListCard,
} from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { formatBrl, PLANS } from "@/lib/billing/plans";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { loadAdminMetrics } from "@/lib/db/admin/metrics";
import { loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Métricas" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

/**
 * Funil, ativação, receita e passivo de moedas.
 *
 * A tela responde às perguntas que o /admin não respondia: quantos assinam,
 * quantos chegam a gravar alguma coisa, se as moedas de boas-vindas estão
 * sendo usadas, e quanto de OpenAI já foi vendido e ainda não gasto.
 *
 * O custo por moeda é MEDIDO (`loadAdminUsageSummary` + câmbio), não fixado:
 * ele muda com o dólar e com o preço do modelo, e é a base da conversão do
 * passivo em reais.
 */
export default async function AdminMetricsPage() {
  const [rate, usage] = await Promise.all([getUsdToBrl(), loadAdminUsageSummary()]);

  // USD/moeda → centavos de BRL por 1.000 moedas. Sem câmbio disponível o
  // passivo aparece zerado em vez de errado — a tela diz que falta a cotação.
  const costPerThousandCents =
    rate && usage.overallCostPerCoinUsd
      ? Math.round(usage.overallCostPerCoinUsd * 1000 * rate.rate * 100)
      : 0;

  const metrics = await loadAdminMetrics({}, costPerThousandCents);
  const { funnel, welcomeCoins, revenue, liability } = metrics;

  const tiles: KpiTile[] = [
    {
      label: "Cadastros",
      value: INT.format(funnel.signups),
      hint: `${INT.format(funnel.activated)} gravaram algo · ${pct(funnel.activationRate)} de ativação`,
      tone: "blue",
    },
    {
      label: "Assinantes ativos",
      value: INT.format(funnel.activeSubscribers),
      hint: `${pct(funnel.conversionRate)} de conversão · ${INT.format(revenue.cancelScheduled)} com cancelamento agendado`,
      tone: "mint",
    },
    {
      label: "MRR",
      value: formatBrl(revenue.mrrCents),
      hint: `ARPU ${formatBrl(revenue.arpuCents)} · Stripe ~${formatBrl(revenue.stripeFeeCents)}/mês`,
      tone: "cream",
    },
    {
      label: "Moedas em circulação",
      value: INT.format(liability.outstanding),
      hint: costPerThousandCents
        ? `${formatBrl(liability.outstandingCostCents)} de custo já vendido`
        : "sem cotação do dólar para converter",
      tone: "rose",
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

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Métricas"
        subtitle="Funil, ativação, receita e passivo de moedas — o caminho da visita ao dinheiro."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </section>

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
              Quem zera o saldo é o sinal mais forte de intenção de compra — consumiu tudo o que era
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

      <section className="grid gap-4 lg:grid-cols-2">
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

        <ListCard title="Tempo até assinar" subtitle="Mediana">
          {metrics.medianDaysToSubscribe === null ? (
            <EmptyState>Nenhuma assinatura registrada ainda.</EmptyState>
          ) : (
            <p className="text-[26px] font-semibold tracking-tight text-scriba-ink-strong">
              {metrics.medianDaysToSubscribe.toLocaleString("pt-BR")}{" "}
              <span className="text-[14px] font-light text-scriba-ink-soft">
                dias entre o cadastro e a primeira assinatura
              </span>
            </p>
          )}
          {/* Mediana e não média: um único usuário que assinou depois de um ano
              deslocaria a média e faria o número mentir sobre o caso típico. */}
          <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
            Mediana, não média — um caso extremo não deve mover o número típico.
          </p>
        </ListCard>
      </section>
    </div>
  );
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
