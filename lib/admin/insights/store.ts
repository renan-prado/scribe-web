import "server-only";
import {
  type AdminInsightScope,
  type AdminInsightsRecord,
  parseAdminInsightsFromLLM,
} from "@/lib/domain/admin-insights";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura e escrita de `admin_insights` — uma linha por escopo, substituída a
 * cada geração. O porquê de não haver histórico está no cabeçalho da migração
 * `0034_admin_insights.sql`.
 *
 * A tabela não tem policy nenhuma e nenhum GRANT: só o service-role chega
 * nela, e ele só é alcançado depois de `requireAdmin()` / `isCurrentUserAdmin`.
 *
 * **A leitura revalida.** O payload é jsonb gravado por uma versão anterior do
 * tipo, e um card que confia no que está no banco quebra a página inteira no
 * dia em que um campo mudar de nome. Falha de parse aqui devolve `null`, que a
 * tela trata como "ainda não gerado" — e a próxima geração conserta a linha.
 */

const log = createLogger("admin/insights");

type Row = {
  scope: string;
  payload: unknown;
  model: string;
  window_days: number;
  cost_usd: number | string | null;
  generated_at: string;
};

function toRecord(row: Row): AdminInsightsRecord | null {
  // O parser aceita string; o que vem do jsonb já é objeto. Reserializar é o
  // caminho mais curto para ter UMA validação, e não duas que divergem.
  const payload = parseAdminInsightsFromLLM(JSON.stringify(row.payload));
  if (!payload) {
    log.warn("payload gravado não passou no parser — tratando como ausente", { scope: row.scope });
    return null;
  }
  return {
    scope: row.scope as AdminInsightScope,
    payload,
    model: row.model,
    windowDays: row.window_days,
    costUsd: Number(row.cost_usd ?? 0),
    generatedAt: row.generated_at,
  };
}

export async function readAdminInsights(
  scope: AdminInsightScope
): Promise<AdminInsightsRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_insights")
    .select("scope, payload, model, window_days, cost_usd, generated_at")
    .eq("scope", scope)
    .maybeSingle();
  if (error) {
    // Um card de análise não pode derrubar a tela que ele comenta. A página
    // renderiza sem ele e o botão de atualizar continua ali.
    log.warn("leitura falhou", { scope, error: error.message });
    return null;
  }
  return data ? toRecord(data as Row) : null;
}

export async function writeAdminInsights(record: {
  scope: AdminInsightScope;
  payload: unknown;
  model: string;
  windowDays: number;
  costUsd: number;
  adminId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();
  const { error } = await admin.from("admin_insights").upsert(
    {
      scope: record.scope,
      payload: record.payload,
      model: record.model,
      window_days: record.windowDays,
      cost_usd: record.costUsd,
      generated_at: generatedAt,
      generated_by: record.adminId,
    },
    { onConflict: "scope" }
  );
  if (error) throw new Error(`writeAdminInsights failed: ${error.message}`);
  log.info("gerado", { scope: record.scope, model: record.model, costUsd: record.costUsd });
  return generatedAt;
}
