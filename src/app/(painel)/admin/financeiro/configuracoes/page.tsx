import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CategoriesManager } from "@/features/admin/components/finance/CategoriesManager";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { FinanceSettingsForm } from "@/features/admin/components/finance/FinanceSettingsForm";
import { getFinanceSettings, listCategories } from "@/lib/db/admin/finance";

export const metadata: Metadata = { title: "Configurações financeiras" };
export const dynamic = "force-dynamic";

/**
 * Categorias e parâmetros.
 *
 * Esta tela NÃO carrega o snapshot inteiro: ela não mostra nenhum total, e
 * puxar doze meses de eventos de LLM para desenhar dois formulários seria
 * gastar quatro consultas grandes por visita sem nada em troca.
 */
export default async function FinanceSettingsPage() {
  const [settings, categories] = await Promise.all([getFinanceSettings(), listCategories()]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Configurações financeiras"
        subtitle="O vocabulário das categorias e os parâmetros que o painel usa para calcular."
      />

      <FinanceSettingsForm settings={settings} />

      <FinanceNotices
        tone="info"
        warnings={[
          "O câmbio do histórico e das dívidas continua vindo de /admin/uso, este aqui é só o das projeções, e existe para uma projeção de 12 meses não mudar de resultado porque o dólar oscilou.",
        ]}
      />

      <CategoriesManager categories={categories} />
    </div>
  );
}
