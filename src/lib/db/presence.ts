import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O pulso de "esta conta está com o Scriba aberto agora".
 *
 * Escrito por `POST /api/presence/heartbeat`, chamado pelo cliente a cada
 * ~60s enquanto o app está aberto (ver `PresenceHeartbeat` em
 * `src/app/(app)/`). Uma linha por (dia, conta), atualizada em UPSERT: o dia
 * de hoje sobe uma vez e recebe `last_seen_at` mais novo a cada pulso
 * seguinte, é o que sustenta as duas leituras do painel, "quantas contas
 * acessaram hoje" (a linha existe) e "quantas estão online agora" (o pulso é
 * recente). Ver `src/features/admin/server/db/access.ts` e o cabeçalho da
 * migração 0071.
 *
 * Falha aqui nunca vira erro para quem gravava: é telemetria, não é o produto,
 * e um 500 numa rota cujo único trabalho é esta escrita não ajuda ninguém.
 */
export async function recordPresenceHeartbeat(userId: string): Promise<void> {
  const log = createLogger("presence");
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);

  const { error } = await admin
    .from("user_daily_access")
    .upsert(
      { user_id: userId, day, last_seen_at: new Date().toISOString() },
      { onConflict: "day,user_id" }
    );

  if (error) log.warn("pulso não gravado", { userId, error: error.message });
}
