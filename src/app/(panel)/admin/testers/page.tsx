import type { Metadata } from "next";
import { EmptyState } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { GrowthTabs } from "@/features/admin/components/SectionTabs";
import { TestersManager } from "@/features/admin/components/TestersManager";
import {
  ADMIN_TESTERS_PAGE_SIZE,
  loadAdminTesterSignups,
} from "@/features/admin/server/db/testers";
import { formatCoins } from "@/features/billing/plans";
import { TESTER_GIFT_COINS } from "@/lib/domain/tester";

export const metadata: Metadata = { title: "Testadores" };
export const dynamic = "force-dynamic";

/**
 * A fila do teste fechado da Play Store.
 *
 * **Ela é aba de "Crescimento" e não de "Conteúdo"** porque responde à mesma
 * pergunta dos outros dois itens de lá, "por onde entra gente?". Parceiro,
 * cupom e teste fechado são três portas com contas diferentes: o parceiro
 * ganha comissão sobre quem trouxe, o cupom gasta moeda para chamar alguém
 * escolhido, e o teste fechado troca moedas por quem se dispõe a usar uma
 * versão instável e contar o que quebrou.
 *
 * **O trabalho é MANUAL por fora, e é isso que a tela serve.** A lista de
 * testadores mora no console do Google Play, num campo de texto: não há API
 * pública para escrever nela, então alguém copia os endereços daqui e cola
 * lá. A tela não automatiza o convite, ela tira do caminho as três etapas de
 * SQL que a antecediam (o `string_agg` à mão, a conferência e o `update`) e
 * põe a fila, o número de WhatsApp e a marcação no mesmo lugar.
 *
 * Só LÊ e ANOTA: não há como apagar um pré-cadastro daqui. Um endereço que
 * chegou é o pedido de uma pessoa, e apagá-lo esconderia dela e de nós que o
 * pedido existiu; o que se faz com um endereço inválido é convidá-lo e deixar
 * o Google recusar.
 */
export default async function AdminTestersPage() {
  const data = await loadAdminTesterSignups().catch(() => null);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title="Testadores" subtitle="A fila do teste fechado da Play Store." />
        <GrowthTabs active="testadores" />
        {/* A falha de leitura é DITA. Uma lista vazia por erro de consulta é
            idêntica, na tela, a "ninguém se cadastrou", e as duas mandam quem
            lê para lados opostos: uma pede conserto, a outra pede divulgação. */}
        <EmptyState>Não consegui ler a fila de testadores agora.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Testadores"
        subtitle={`Quem pediu acesso ao teste fechado do Android em /tester. Cada um recebe ${formatCoins(
          TESTER_GIFT_COINS
        )} moedas de presente, pendentes até o primeiro acesso ao app.`}
      />
      <GrowthTabs active="testadores" />
      <TestersManager data={data} pageSize={ADMIN_TESTERS_PAGE_SIZE} />
    </div>
  );
}
