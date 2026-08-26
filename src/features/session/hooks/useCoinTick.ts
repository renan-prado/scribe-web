"use client";

import { useEffect, useRef } from "react";
import { getCoinsState } from "@/features/coins/store";
import type { ChargeReason } from "@/lib/coins/pricing";

/**
 * Charges the caller once every 60s while `enabled` is true. Fires an
 * immediate first debit when the recording starts (billing model is "per
 * started minute"), then every 60s after that. On the first
 * `insufficient_balance` response it invokes `onDepleted` — recording pages
 * use that to call stop() so capture halts as soon as the account is dry.
 *
 * The interval id is torn down when `enabled` flips false OR when the hook
 * unmounts — no stray ticks after the recorder is stopped.
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
  const onDepletedRef = useRef(onDepleted);
  onDepletedRef.current = onDepleted;

  useEffect(() => {
    if (!enabled) return;
    depletedRef.current = false;

    let cancelled = false;

    async function tick() {
      if (cancelled || depletedRef.current) return;
      const res = await getCoinsState().charge(reason, sessionId);
      if (cancelled) return;
      if (!res.ok && res.error === "insufficient_balance") {
        depletedRef.current = true;
        onDepletedRef.current();
      }
    }

    void tick();
    const id = setInterval(() => void tick(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, reason, sessionId]);
}
