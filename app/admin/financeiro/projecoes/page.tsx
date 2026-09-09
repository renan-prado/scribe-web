import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { ProjectionsView } from "@/features/admin/components/finance/ProjectionsView";
import { listScenarios } from "@/lib/db/admin/finance";
import { loadFinanceSnapshot } from "@/lib/db/admin/finance-overview";
import { formatBrlCents, formatPercent } from "@/lib/finance/money";
import {
  measuredPaymentFeeBps,
  measuredVariableCostPerCustomer,
  type ProjectionBasis,
} from "@/lib/finance/projection";
import { addMonthsToKey, monthKey } from "@/lib/finance/recurrence";

export const metadata: Metadata = { title: "Projeções" };
export const dynamic = "force-dynamic";

/**
 * Projeções e cenários (§10–§12).
 *
 * A BASE É MONTADA AQUI, no servidor, a partir do que já foi medido; as
 * premissas vêm dos cenários; a composição das duas é `project()`, que roda no
 * cliente para o ajuste de uma premissa não custar um round-trip. A fórmula
 * existe num lugar só — `lib/finance/projection.ts` — e é a mesma que os
 * testes exercitam.
 *
 * O CUSTO VARIÁVEL POR CLIENTE sai do ÚLTIMO MÊS FECHADO, não do corrente: no
 * dia 3, o mês corrente tem três dias de custo, e projetar doze meses a partir
 * dele subestimaria a conta em uma ordem de grandeza.
 *
 * A projeção começa no mês SEGUINTE. O corrente já tem meia realidade dentro
 * dele, e misturá-la com premissa produziria um primeiro mês que não é nem
 * realizado nem projetado — exatamente o que o §14 pede para não fazer.
 */
export default async function FinanceProjectionsPage() {
  const [{ overview, settings, measured, usdBrl }, scenarios] = await Promise.all([
    loadFinanceSnapshot(),
    listScenarios(),
  ]);

  const closed = overview.months[overview.months.length - 2] ?? overview.current;
  const variableCostPerCustomerCents = measuredVariableCostPerCustomer(
    closed.expenseMeasuredCents,
    measured.activeSubscribers
  );
  const paymentFeeBps = measuredPaymentFeeBps(measured.stripeFeeMonthlyCents, measured.mrrCents);

  const basis: ProjectionBasis = {
    customers: measured.activeSubscribers,
    arpuCents: measured.arpuCents,
    fixedCostCents: overview.recurring.fixedMonthlyCents,
    variableCostPerCustomerCents,
    paymentFeeBps,
    taxBps: settings.taxBps,
    cashBalanceCents: settings.cashBalanceCents,
    startMonth: addMonthsToKey(monthKey(overview.current.month), 1),
  };

  const basisLabels = {
    customers: new Intl.NumberFormat("pt-BR").format(measured.activeSubscribers),
    arpu: formatBrlCents(measured.arpuCents),
    fixedCost: formatBrlCents(overview.recurring.fixedMonthlyCents),
    variableCost: formatBrlCents(variableCostPerCustomerCents),
    paymentFee: formatPercent(paymentFeeBps / 10_000, 2),
  };

  // O que impede a projeção de significar alguma coisa, dito ANTES dela.
  const gaps: string[] = [];
  if (measured.activeSubscribers === 0) {
    gaps.push(
      "Não há assinantes ativos: a projeção parte de zero cliente e só mostra o efeito dos novos clientes por mês que você supuser."
    );
  }
  if (overview.recurring.fixedMonthlyCents === 0) {
    gaps.push(
      "Nenhum custo fixo cadastrado. Sem os contratos recorrentes, a projeção mostra lucro que não existe — comece por Custos recorrentes."
    );
  }
  if (settings.cashBalanceCents === 0) {
    gaps.push(
      "Sem saldo em caixa informado, a coluna de caixa projetado parte de zero e o mês em que o dinheiro acabaria não pode ser calculado."
    );
  }
  if (usdBrl === null) {
    gaps.push("Sem cotação do dólar, custos em US$ ficam fora do custo fixo que alimenta a base.");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Projeções"
        subtitle="Cenários sobre premissas suas, aplicados à base medida do produto."
      />

      <FinanceNotices warnings={gaps} />

      <FinanceNotices
        tone="info"
        warnings={[
          "Isto é projeção baseada em premissas, não previsão. Os cinco números da base são medidos; crescimento, churn e aquisição são hipóteses que você digitou.",
        ]}
      />

      <ProjectionsView scenarios={scenarios} basis={basis} basisLabels={basisLabels} />
    </div>
  );
}
