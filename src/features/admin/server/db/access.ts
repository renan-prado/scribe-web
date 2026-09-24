import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quantas contas usaram o Scriba, dia a dia, e quantas estão com o app aberto
 * agora.
 *
 * A fonte é `user_daily_access` (migração 0071), uma linha por (dia, conta)
 * atualizada a cada pulso de `POST /api/presence/heartbeat`. Como a chave
 * primária já é `(day, user_id)`, cada dia não tem como ter duas linhas da
 * mesma conta: `count(*)` de um dia JÁ É o número de contas distintas, sem
 * `distinct` nenhum para fazer em memória.
 *
 * **"Online agora" é aproximado por desenho.** Não é uma contagem de conexões
 * abertas, é "teve pulso nos últimos 5 minutos" — a mesma folga documentada no
 * cabeçalho da migração, contra pulsos perdidos por rede ruim ou aba em
 * segundo plano. Ninguém deveria ler este número como uma medida exata de
 * WebSocket, é uma leitura de "tem gente usando isto agora", com a margem de
 * erro que o método permite.
 */

export type AccessPoint = { day: string; count: number };

export type AdminAccessMetrics = {
  /** Contas distintas com ao menos um pulso hoje. */
  today: number;
  /** Contas com pulso nos últimos 5 minutos. */
  onlineNow: number;
  /** Uma entrada por dia, do mais antigo ao mais recente. */
  byDay: AccessPoint[];
};

const MAX_ROWS = 50_000;
const ONLINE_WINDOW_MS = 5 * 60_000;

/**
 * `days` é a janela de `byDay`, para trás a partir de hoje. `today` e
 * `onlineNow` não dependem dela além de precisarem que a linha de hoje esteja
 * dentro do recorte — a Visão geral chama com `0` (só hoje, sem histórico) e
 * `/admin/metrics` chama com 90 (para o gráfico).
 */
export async function loadAdminAccessMetrics(days = 90): Promise<AdminAccessMetrics> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("user_daily_access")
    .select("day, last_seen_at")
    .gte("day", since)
    .limit(MAX_ROWS);
  if (error) throw new Error(`loadAdminAccessMetrics failed: ${error.message}`);

  const rows = (data ?? []) as { day: string; last_seen_at: string }[];
  const today = new Date().toISOString().slice(0, 10);
  const onlineCutoff = Date.now() - ONLINE_WINDOW_MS;

  const counts = new Map<string, number>();
  let todayCount = 0;
  let onlineNow = 0;
  for (const row of rows) {
    counts.set(row.day, (counts.get(row.day) ?? 0) + 1);
    if (row.day === today) {
      todayCount += 1;
      if (Date.parse(row.last_seen_at) >= onlineCutoff) onlineNow += 1;
    }
  }

  const byDay = [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { today: todayCount, onlineNow, byDay };
}
