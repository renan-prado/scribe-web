"use client";

import { useEffect, useRef } from "react";
import { getCoinsState } from "@/features/coins/store";
import type { ChargeReason } from "@/lib/coins/pricing";
import { createLogger } from "@/lib/log";

const log = createLogger("coins/tick");

/**
 * Charges the caller once every 60s while `enabled` is true. First debit fires
 * as soon as the recording starts (billing model is "per started minute"),
 * then every 60s after that. On the first `insufficient_balance` response it
 * invokes `onDepleted` and stops ticking.
 *
 * Este hook é a mecânica pura de cobrança e não decide o que fazer quando o
 * saldo acaba. Quem decide é `useCoinGuard`, que o embrulha e responde
 * CONGELANDO a captura (pause) em vez de encerrá-la, as páginas de gravação
 * usam o guard, não este hook diretamente.
 *
 * **Pause-aware billing:** across `enabled` toggles for the same session
 * (pause → resume), we remember the last successful charge timestamp so
 * resuming does NOT trigger an immediate re-charge. Instead the first tick
 * after resume waits for whatever is left in the previous minute, the user
 * pays for started clock-minutes of *active* recording, not per pause bounce.
 * If enough time elapsed while paused (>60s), the first tick fires
 * immediately, honoring the started-minute policy.
 *
 * The interval id is torn down when `enabled` flips false OR when the hook
 * unmounts, no stray ticks after the recorder is stopped or paused.
 *
 * **`sessionId` pode ser `null`, e o caso é o gravador do v2.** Lá a sessão só
 * nasce no stop (ver `app/v2/recording/AudioStudio.tsx`), então os primeiros
 * minutos são cobrados antes de existir linha para amarrá-los. A cobrança em si
 * não depende disso, `/api/coins/charge` já aceita `sessionId` opcional; o que
 * se perde é a ATRIBUIÇÃO da linha do ledger à sessão, e o custo daquela
 * gravação passa a aparecer no total do usuário sem aparecer no detalhe por
 * sessão. É uma troca consciente: cobrar sem atribuir é melhor que não cobrar.
 */
export function useCoinTick({
  enabled,
  reason,
  sessionId,
  onDepleted,
}: {
  enabled: boolean;
  reason: ChargeReason;
  sessionId: string | null;
  onDepleted: () => void;
}): void {
  const depletedRef = useRef(false);
  const lastChargedAtRef = useRef<number | null>(null);
  const onDepletedRef = useRef(onDepleted);
  onDepletedRef.current = onDepleted;

  // Reset billing bookkeeping when the session identity changes, a new
  // recording is billed from scratch even if the hook stays mounted. The
  // effect body only mutates refs (no render), but sessionId is a legit
  // trigger here, that's why it's in the dep list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionId change is the trigger; ref mutations are intentional
  useEffect(() => {
    lastChargedAtRef.current = null;
    depletedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!enabled) return;
    depletedRef.current = false;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      if (cancelled || depletedRef.current) return;
      const res = await getCoinsState().charge(reason, sessionId);
      if (cancelled) return;
      if (res.ok) {
        lastChargedAtRef.current = Date.now();
      } else if (res.error === "insufficient_balance") {
        depletedRef.current = true;
        onDepletedRef.current();
      } else {
        // Qualquer outra falha é RECEITA PERDIDA, e era engolida em silêncio:
        // o gravador do v2 passou a existir mandando `sessionId: null`, levou
        // 400 em todo minuto de toda gravação, e nada em lugar nenhum disse
        // isso — só apareceu quando alguém abriu a aba de rede. Cobrança que
        // falha sem ruído é o pior jeito de uma medição falhar.
        log.warn("charge failed", { reason, sessionId, error: res.error, message: res.message });
      }
    }

    // Compute the initial delay so we honor the "started minute" model across
    // pauses. On a fresh start (no prior charge) we tick immediately.
    const lastAt = lastChargedAtRef.current;
    const initialDelay = lastAt == null ? 0 : Math.max(0, 60_000 - (Date.now() - lastAt));

    if (initialDelay === 0) {
      void tick();
      intervalId = setInterval(() => void tick(), 60_000);
    } else {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        void tick();
        intervalId = setInterval(() => void tick(), 60_000);
      }, initialDelay);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, reason, sessionId]);
}
