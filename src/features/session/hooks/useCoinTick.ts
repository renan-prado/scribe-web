"use client";

import { useEffect, useRef } from "react";
import { getCoinsState } from "@/features/coins/store";
import type { ChargeReason } from "@/lib/coins/pricing";

/**
 * Charges the caller once every 60s while `enabled` is true. First debit fires
 * as soon as the recording starts (billing model is "per started minute"),
 * then every 60s after that. On the first `insufficient_balance` response it
 * invokes `onDepleted` and stops ticking.
 *
 * Este hook é a mecânica pura de cobrança e não decide o que fazer quando o
 * saldo acaba. Quem decide é `useCoinGuard`, que o embrulha e responde
 * CONGELANDO a captura (pause) em vez de encerrá-la — as páginas de gravação
 * usam o guard, não este hook diretamente.
 *
 * **Pause-aware billing:** across `enabled` toggles for the same session
 * (pause → resume), we remember the last successful charge timestamp so
 * resuming does NOT trigger an immediate re-charge. Instead the first tick
 * after resume waits for whatever is left in the previous minute — the user
 * pays for started clock-minutes of *active* recording, not per pause bounce.
 * If enough time elapsed while paused (>60s), the first tick fires
 * immediately, honoring the started-minute policy.
 *
 * The interval id is torn down when `enabled` flips false OR when the hook
 * unmounts — no stray ticks after the recorder is stopped or paused.
 */
export function useCoinTick({
  enabled,
  reason,
  sessionId,
  onDepleted,
}: {
  enabled: boolean;
  reason: ChargeReason;
  sessionId: string;
  onDepleted: () => void;
}): void {
  const depletedRef = useRef(false);
  const lastChargedAtRef = useRef<number | null>(null);
  const onDepletedRef = useRef(onDepleted);
  onDepletedRef.current = onDepleted;

  // Reset billing bookkeeping when the session identity changes — a new
  // recording is billed from scratch even if the hook stays mounted. The
  // effect body only mutates refs (no render), but sessionId is a legit
  // trigger here — that's why it's in the dep list.
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
