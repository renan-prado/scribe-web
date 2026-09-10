import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("fx/db");

/**
 * A série diária de câmbio USD→BRL (`usd_brl_rates`, migração 0049).
 *
 * As duas funções são fire-and-forget no espírito de `db/usage.ts`: nenhuma
 * lança, e falha de banco vira `warn` + `null`. O câmbio é infraestrutura de
 * LEITURA do painel — uma indisponibilidade dele não pode virar 500 numa tela
 * que, no pior caso, deve mostrar "sem câmbio" e seguir viva.
 *
 * Service-role porque a tabela não tem policy nenhuma (ver o cabeçalho da
 * migração): o câmbio multiplica todo número em real do painel, e quem
 * pudesse escrever uma linha aqui decidiria a margem que o admin lê.
 */

export type StoredUsdBrlRate = {
  rate: number;
  /** O dia da cotação, `YYYY-MM-DD` em UTC. */
  day: string;
  fetchedAt: string;
};

/** `YYYY-MM-DD` do instante dado, em UTC — a chave da tabela. */
function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Guarda a cotação do dia. Sobrescreve a do mesmo dia de propósito: a leitura
 * mais recente é a melhor estimativa daquele dia, e não há intradiário a
 * preservar.
 */
export async function saveUsdBrlRate(rate: number, source: string): Promise<void> {
  if (!Number.isFinite(rate) || rate <= 0) return;
  const now = new Date();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("usd_brl_rates")
      .upsert(
        { day: utcDay(now), rate, source, fetched_at: now.toISOString() },
        { onConflict: "day" }
      );
    if (error) log.warn("upsert falhou", { error: error.message });
  } catch (err) {
    log.warn("upsert lançou", { error: (err as Error).message });
  }
}

/**
 * A última cotação guardada, de qualquer dia. É o plano B do painel quando a
 * cotação viva não vem — o câmbio de ontem erra na segunda casa; a ausência
 * dele apaga a coluna inteira.
 */
export async function readLatestUsdBrlRate(): Promise<StoredUsdBrlRate | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("usd_brl_rates")
      .select("day, rate, fetched_at")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      log.warn("leitura falhou", { error: error.message });
      return null;
    }
    if (!data) return null;
    const rate = Number(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return { rate, day: data.day as string, fetchedAt: (data.fetched_at as string) ?? data.day };
  } catch (err) {
    log.warn("leitura lançou", { error: (err as Error).message });
    return null;
  }
}
