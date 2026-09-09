import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { EntriesManager } from "@/features/admin/components/finance/EntriesManager";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { loadFinanceSnapshot } from "@/lib/db/admin/finance-overview";

export const metadata: Metadata = { title: "Lançamentos" };
export const dynamic = "force-dynamic";

/**
 * O cadastro manual de receitas e despesas.
 *
 * A tela avisa, de saída, o que NÃO se lança aqui. É a armadilha da área: a
 * receita de assinatura e o custo de IA já são medidos, e lançá-los à mão
 * conta o mesmo dinheiro duas vezes. O aviso vem antes da lista porque depois
 * dela ele já não é lido.
 */
export default async function FinanceEntriesPage() {
  const { entries, categories, recurring, usdBrl } = await loadFinanceSnapshot();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Lançamentos"
        subtitle="Receitas e despesas cadastradas à mão — o que o painel não consegue medir sozinho."
      />

      <FinanceNotices
        tone="info"
        warnings={[
          "Não lance aqui a receita das assinaturas nem o custo da OpenAI: os dois já são medidos (ledger de créditos e llm_usage_events) e entram sozinhos nos totais.",
          "A fatura de um contrato recorrente deve ser vinculada a ele no formulário — assim ela substitui a provisão do mês em vez de somar por cima.",
        ]}
      />

      <EntriesManager
        entries={entries}
        categories={categories}
        recurring={recurring}
        usdBrl={usdBrl}
      />
    </div>
  );
}
