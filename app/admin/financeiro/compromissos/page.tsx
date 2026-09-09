import type { Metadata } from "next";
import { KpiCard, type KpiTile } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CommitmentsManager } from "@/features/admin/components/finance/CommitmentsManager";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { loadFinanceSnapshot } from "@/lib/db/admin/finance-overview";
import { formatBrlCents } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Compromissos" };
export const dynamic = "force-dynamic";

/**
 * Compromissos e dívidas (§9).
 *
 * Um recorte de `finance_entries`, não uma entidade paralela — a razão está no
 * cabeçalho de `CommitmentsManager` e na migração 0043.
 */
export default async function FinanceCommitmentsPage() {
  const { overview, entries, categories, recurring, usdBrl, today } = await loadFinanceSnapshot();
  const { commitments } = overview;

  const tiles: KpiTile[] = [
    {
      label: "Total a pagar",
      value: formatBrlCents(commitments.payableCents),
      hint: `inclui ${formatBrlCents(commitments.partnerOwedCents)} de comissões de parceiro`,
      tone: "rose",
    },
    {
      label: "Vencido",
      value: formatBrlCents(commitments.overdueCents),
      hint: commitments.overdueCents > 0 ? "precisa de ação" : "nada em atraso",
      tone: commitments.overdueCents > 0 ? "rose" : "mint",
    },
    {
      label: "Vence em 30 dias",
      value: formatBrlCents(commitments.dueNext30Cents),
      hint: "o que sai do caixa no próximo mês",
      tone: "cream",
    },
    {
      label: "A receber",
      value: formatBrlCents(commitments.receivableCents),
      hint: "receitas firmadas que ainda não entraram",
      tone: "mint",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Compromissos e dívidas"
        subtitle="O que devemos, para quem, até quando — e quanto já foi pago."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <KpiCard key={t.label} {...t} />
        ))}
      </section>

      {commitments.unconvertible > 0 ? (
        <FinanceNotices
          warnings={[
            `${commitments.unconvertible} compromisso(s) em moeda estrangeira ficaram fora dos totais por falta de cotação.`,
          ]}
        />
      ) : null}

      <FinanceNotices
        tone="info"
        warnings={[
          "Uma dívida é um lançamento não liquidado, não um tipo à parte: o que aparece aqui está na mesma lista de Lançamentos, filtrado. Ao registrar um pagamento parcial, o restante é recalculado — nunca digitado.",
        ]}
      />

      <CommitmentsManager
        entries={entries}
        categories={categories}
        recurring={recurring}
        usdBrl={usdBrl}
        today={today}
        partnerOwedCents={commitments.partnerOwedCents}
      />
    </div>
  );
}
