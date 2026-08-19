"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { TICK_INTERVAL_MS } from "@/features/session/config";

/**
 * Emit a monotonic elapsed-ms counter derived from `startedAtRef`. Caller owns
 * the ref (so `start()` can seed it before flipping `enabled` true, keeping the
 * origin timestamp aligned with when the recorder actually started).
 *
 * Resyncs against `performance.now()` on visibility change because browsers
 * throttle setInterval when the tab is backgrounded.
 */
export function useElapsedTimer(enabled: boolean, startedAtRef: RefObject<number>): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    setElapsedMs(performance.now() - startedAtRef.current);
    const id = setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, startedAtRef]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState !== "hidden") {
        setElapsedMs(performance.now() - startedAtRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, startedAtRef]);

  return elapsedMs;
}
