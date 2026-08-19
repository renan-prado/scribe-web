"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Hold a screen wake lock for as long as `enabled` is true. Wake locks are
 * released automatically when the tab is hidden by the platform, so we
 * re-request one whenever the tab becomes visible again while enabled.
 *
 * Silently no-ops on browsers without the API (Safari on some versions).
 */
export function useWakeLock({ enabled }: { enabled: boolean }): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    const wl = navigator.wakeLock;
    if (!wl || typeof wl.request !== "function") return;
    try {
      sentinelRef.current = await wl.request("screen");
    } catch {
      // ignore — user gesture requirements or hardware refusal
    }
  }, []);

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        // ignore
      }
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void request();
    } else {
      void release();
    }
  }, [enabled, request, release]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, request]);

  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);
}
