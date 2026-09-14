import "server-only";
import { type AdminInsightsRecord, parseAdminInsightsFromLLM } from "@/lib/domain/admin-insights";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura e escrita de `admin_insights`, substituída a cada geração. O porquê
 * de não haver histórico está no cabeçalho da migração `0034_admin_insights.sql`.
 *
 * **A tabela tem uma linha, e a chave dela é uma constante.** Ela nasceu com
 * uma linha por TELA (`pricing`, `usage`, `metrics`), quando a leitura era três
 * cards espalhados pelo painel; hoje é uma leitura só, em `/admin/insights`, e
 * `INSIGHTS_ROW_KEY` é o que sobrou da coluna `scope`. A coluna fica porque ela
 * é a PK da tabela e porque o dia em que houver um segundo tipo de leitura (um
 * resumo semanal, digamos) ela já é o lugar certo, mas ninguém fora deste
 * arquivo precisa conhecê-la. As três linhas antigas foram apagadas pela
 * migração 0054.
 *
 * A tabela não tem policy nenhuma e nenhum GRANT: só o service-role chega
 * nela, e ele só é alcançado depois de `requireAdmin()` / `isCurrentUserAdmin`.
 *
 * **A leitura revalida.** O payload é jsonb gravado por uma versão anterior do
 * tipo, e uma tela que confia no que está no banco quebra inteira no dia em que
 * um campo mudar de nome. Falha de parse aqui devolve `null`, que a tela trata
 * como "ainda não gerado", e a próxima geração conserta a linha.
 */

const log = createLogger("admin/insights");

/** A chave da única linha. Ver o cabeçalho. */
const INSIGHTS_ROW_KEY = "general";

type Row = {
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
    log.warn("payload gravado não passou no parser, tratando como ausente");
    return null;
  }
  return {
    payload,
    model: row.model,
    windowDays: row.window_days,
    costUsd: Number(row.cost_usd ?? 0),
    generatedAt: row.generated_at,
  };
}

export async function readAdminInsights(): Promise<AdminInsightsRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_insights")
    .select("payload, model, window_days, cost_usd, generated_at")
    .eq("scope", INSIGHTS_ROW_KEY)
    .maybeSingle();
  if (error) {
    // A leitura da IA não pode derrubar a página que a hospeda. Ela renderiza
    // sem o texto e com o botão de gerar no lugar de sempre.
    log.warn("leitura falhou", { error: error.message });
    return null;
  }
  return data ? toRecord(data as Row) : null;
}

export async function writeAdminInsights(record: {
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
      scope: INSIGHTS_ROW_KEY,
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
  log.info("gerado", { model: record.model, costUsd: record.costUsd });
  return generatedAt;
}
