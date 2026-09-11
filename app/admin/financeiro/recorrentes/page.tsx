import type { Metadata } from "next";
import { KpiCard, KpiGrid, type KpiTile } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { RecurringManager } from "@/features/admin/components/finance/RecurringManager";
import { loadFinanceSnapshot } from "@/lib/db/admin/finance-overview";
import { formatBrlCents } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Custos recorrentes" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");

/**
 * Custos recorrentes (§8).
 *
 * O topo responde de uma vez à pergunta que dá nome à área: quanto o Scriba
 * custa por mês. E ele soma EQUIVALENTES MENSAIS, não cobranças do mês, um
 * mês sem a cobrança anual do domínio não é um mês mais barato.
 *
 * O custo de IA aparece ao lado, medido, porque sem ele o número do topo
 * responderia só metade da pergunta: a maior despesa variável do produto não
 * é um contrato, é uma fatura que varia com o uso.
 */
export default async function FinanceRecurringPage() {
  const { overview, recurring, categories } = await loadFinanceSnapshot();
  const { recurring: summary, current } = overview;

  const tiles: KpiTile[] = [
    {
      label: "Custo recorrente / mês",
      value: formatBrlCents(summary.monthlyCents),
      hint: `${formatBrlCents(summary.annualCents)} por ano · ${INT.format(summary.activeCount)} contratos ativos`,
    },
    {
      label: "Fixos",
      value: formatBrlCents(summary.fixedMonthlyCents),
      hint: "Não escalam com uso, o piso do produto",
    },
    {
      label: "Variáveis (contratos)",
      value: formatBrlCents(summary.variableMonthlyCents),
      hint: "Contratos cuja categoria é variável",
    },
    {
      label: "IA e taxas do mês",
      value: formatBrlCents(current.expenseMeasuredCents),
      hint: "Medido, não é contrato, varia com o uso",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Custos recorrentes"
        subtitle="Os contratos que se repetem, com o equivalente mensal de cada um."
      />

      <KpiGrid>
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </KpiGrid>

      <FinanceNotices
        tone="info"
        warnings={[
          "Um contrato é uma previsão de cobrança, não um fato. O equivalente mensal é custo provisionado; a saída de caixa acontece inteira no mês da cobrança.",
        ]}
      />

      {summary.unconvertible > 0 ? (
        <FinanceNotices
          warnings={[
            `${summary.unconvertible} contrato(s) em moeda estrangeira ficaram fora dos totais por falta de cotação.`,
          ]}
        />
      ) : null}

      <RecurringManager recurring={recurring} summaries={summary.items} categories={categories} />
    </div>
  );
}
