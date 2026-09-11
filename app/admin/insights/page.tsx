import type { Metadata } from "next";
import { QuickLink } from "@/features/admin/components/AdminCards";
import { AdminInsightsPanel } from "@/features/admin/components/AdminInsightsPanel";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { readAdminInsights } from "@/lib/admin/insights/store";

export const metadata: Metadata = { title: "Leitura da IA" };
export const dynamic = "force-dynamic";

/**
 * A ÚNICA leitura da IA sobre os números do painel.
 *
 * Ela morava em três lugares, um card lateral em `/admin/precificacao`,
 * `/admin/usage` e `/admin/metricas`, cada um com o seu recorte, e cada um
 * disparando a geração sozinho quando a linha gravada passava de 24 horas. O
 * arranjo tinha dois defeitos que só aparecem com o painel em uso:
 *
 *   - **as três diziam quase a mesma coisa.** Saem dos mesmos eventos, e as
 *     perguntas se cruzam: uma rota cara é a margem de uma ação, que é o preço
 *     de um plano, que é o passivo de moedas. Recortadas, nenhuma delas podia
 *     concluir sobre o negócio, porque cada uma via um terço dele.
 *   - **ninguém as pedia.** A chamada de LLM mais cara do produto rodava porque
 *     alguém abriu uma tela para conferir o MRR.
 *
 * Aqui a leitura é o ASSUNTO da tela, e não um comentário ao lado de uma
 * tabela, e ela só existe depois do clique. O servidor entrega o que está
 * gravado; o resto é do botão.
 *
 * Os atalhos do rodapé não são decoração: a leitura cita margem, rota e funil,
 * e quem quiser conferir um número precisa chegar à tabela que o publica sem
 * caçar no menu.
 */
export default async function AdminInsightsPage() {
  const insights = await readAdminInsights().catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Leitura da IA"
        subtitle="Uma análise dos últimos 30 dias: custo, preço por ação, funil e passivo, nos mesmos números das tabelas do painel."
      />

      <AdminInsightsPanel initial={insights} />

      <div className="flex flex-wrap items-center gap-2">
        <QuickLink href="/admin/precificacao">Preço por ação</QuickLink>
        <QuickLink href="/admin/usage">Uso & custos</QuickLink>
        <QuickLink href="/admin/metricas">Métricas do produto</QuickLink>
      </div>

      <p className="text-sm text-muted-foreground">
        A janela é fixa em 30 dias, e não as pílulas de período das outras telas: amarrá-la ao
        filtro daria quatro leituras para a mesma pergunta. Margem citada aqui depende da régua da
        moeda, que é <strong className="font-medium">simulação</strong>; custo é medido. O custo
        desta própria análise entra em <code className="font-mono text-xs">llm_usage_events</code>{" "}
        na ação <code className="font-mono text-xs">internal</code>, como qualquer outra rota.
      </p>
    </div>
  );
}
