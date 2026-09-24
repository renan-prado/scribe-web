"use client";

import { useEffect } from "react";

/** A cada quanto tempo o pulso bate. Ver o comentário do bucket
 * `presence-heartbeat` em `src/lib/rate-limit.ts` e a janela de "online" de
 * 5 minutos no cabeçalho da migração 0071: três pulsos perdidos ainda contam
 * como presente. */
const HEARTBEAT_MS = 60_000;

function ping() {
  // Best-effort: isto é telemetria, não o produto. Uma falha de rede aqui não
  // tem para quem avisar, e não vale um retry — o próximo pulso, um minuto
  // depois, resolve sozinho.
  fetch("/api/presence/heartbeat", { method: "POST", keepalive: true }).catch(() => {});
}

/**
 * "Esta conta está com o Scriba aberto". Monta uma vez na moldura de
 * `(app)` (ver `layout.tsx`), a mesma que cobre todas as telas atrás do
 * login, e não desenha nada.
 *
 * Não escuta `visibilitychange`: o intervalo de 60s já é a mesma cadência que
 * um navegador em segundo plano usa para limitar timers, então não há pulso a
 * mais a ganhar ficando esperto sobre isso — só complexidade.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
