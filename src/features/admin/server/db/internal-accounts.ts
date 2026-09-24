import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("admin.internal");

/**
 * Quem são as contas de Backoffice (`profiles.is_internal`, migração 0073).
 *
 * Uma consulta de uma coluna, por índice parcial, devolvendo um punhado de
 * uuids — e é de propósito que ela exista sozinha, em vez de cada agregado
 * filtrar `is_internal` no seu próprio SQL. Os dois lados da conta de margem
 * moram em TABELAS diferentes (`llm_usage_events` para o custo,
 * `coin_transactions` para a moeda) e nenhuma das duas tem a coluna. Com o
 * conjunto em mãos, os dois lados são recortados pela MESMA regra, no mesmo
 * lugar; sem ele, o custo sairia filtrado e a moeda não, que é precisamente a
 * armadilha que `coinsScoped` documenta em `server/db/usage.ts` — um "custo
 * por 1.000 moedas" que parece margem, sempre baixo, e que ninguém investiga
 * porque a conta parece boa.
 *
 * **Falha de leitura devolve conjunto VAZIO**, e isso quer dizer "ninguém é
 * interno": o painel volta a medir tudo, como media antes desta migração.
 * O engano na outra direção — tratar a base inteira como interna — esvaziaria
 * todas as telas de dinheiro sem nenhum erro aparecendo nelas.
 */
export async function loadInternalUserIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id").eq("is_internal", true);
  if (error) {
    log.warn("não consegui ler as contas de backoffice, medindo tudo", { error: error.message });
    return new Set();
  }
  return new Set((data ?? []).map((row) => (row as { id: string }).id));
}
