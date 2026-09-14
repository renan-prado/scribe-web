import type { Metadata } from "next";
import { KpiCard, KpiGrid, type KpiTile } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CommitmentsManager } from "@/features/admin/components/finance/CommitmentsManager";
import { EntriesManager } from "@/features/admin/components/finance/EntriesManager";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { FinanceTabs } from "@/features/admin/components/finance/FinanceTabs";
import { formatBrlCents } from "@/features/admin/finance/money";
import { loadFinanceSnapshot } from "@/features/admin/server/db/finance-overview";

export const metadata: Metadata = { title: "Lançamentos" };
export const dynamic = "force-dynamic";

/**
 * O cadastro manual de receitas e despesas, e o recorte do que ainda não foi
 * liquidado.
 *
 * As duas vistas eram DUAS TELAS, `/lancamentos` e `/compromissos`, sobre a
 * MESMA tabela: uma dívida é um lançamento com `status <> 'paid'` e
 * `due_date`, não um terceiro `kind` (ver a migração 0043 e o cabeçalho de
 * `CommitmentsManager`). Dois itens de menu com dois títulos faziam parecer
 * duas listas independentes, e a primeira dúvida de quem chegava era se o que
 * se lançava numa aparecia na outra. Como duas vistas da mesma rota, a
 * resposta está na tela.
 *
 * A tela avisa, de saída, o que NÃO se lança aqui. É a armadilha da área: a
 * receita de assinatura e o custo de IA já são medidos, e lançá-los à mão
 * conta o mesmo dinheiro duas vezes. O aviso vem antes da lista porque depois
 * dela ele já não é lido.
 */
export default async function FinanceEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const sp = await searchParams;
  const open = sp.visao === "aberto";

  const { overview, entries, categories, recurring, usdBrl, today } = await loadFinanceSnapshot();
  const { commitments } = overview;

  const tiles: KpiTile[] = [
    {
      label: "Total a pagar",
      value: formatBrlCents(commitments.payableCents),
      hint: `inclui ${formatBrlCents(commitments.partnerOwedCents)} de comissões de parceiro`,
    },
    {
      label: "Vencido",
      value: formatBrlCents(commitments.overdueCents),
      hint: commitments.overdueCents > 0 ? "precisa de ação" : "nada em atraso",
      trend: {
        direction: commitments.overdueCents > 0 ? "down" : "up",
        label: commitments.overdueCents > 0 ? "em atraso" : "em dia",
      },
    },
    {
      label: "Vence em 30 dias",
      value: formatBrlCents(commitments.dueNext30Cents),
      hint: "o que sai do caixa no próximo mês",
    },
    {
      label: "A receber",
      value: formatBrlCents(commitments.receivableCents),
      hint: "receitas firmadas que ainda não entraram",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={open ? "Em aberto" : "Lançamentos"}
        subtitle={
          open
            ? "O que devemos, para quem, até quando, e quanto já foi pago."
            : "Receitas e despesas cadastradas à mão, o que o painel não consegue medir sozinho."
        }
      />

      <FinanceTabs active={open ? "aberto" : "lancamentos"} />

      {open ? (
        <>
          <KpiGrid>
            {tiles.map((t) => (
              <KpiCard key={t.label} {...t} />
            ))}
          </KpiGrid>

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
              "Uma dívida é um lançamento não liquidado, não um tipo à parte: o que aparece aqui está na mesma lista da aba Lançamentos, filtrado. Ao registrar um pagamento parcial, o restante é recalculado, nunca digitado.",
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
        </>
      ) : (
        <>
          <FinanceNotices
            tone="info"
            warnings={[
              "Não lance aqui a receita das assinaturas nem o custo da OpenAI: os dois já são medidos (ledger de créditos e llm_usage_events) e entram sozinhos nos totais.",
              "A fatura de um contrato recorrente deve ser vinculada a ele no formulário, assim ela substitui a provisão do mês em vez de somar por cima.",
            ]}
          />

          <EntriesManager
            entries={entries}
            categories={categories}
            recurring={recurring}
            usdBrl={usdBrl}
          />
        </>
      )}
    </div>
  );
}
