"use client";

import { useCallback, useEffect, useRef } from "react";
import { FEED_MIN_GAP_MS } from "@/features/session/config";
import { useSessionStore } from "@/lib/stores/session";

/**
 * Owns the browser setTimeout that drives the feed drip queue. The store
 * decides WHAT to drip and WHEN (state); this hook decides HOW OFTEN (timer).
 * Returned scheduler is stable and safe to include in effect dep arrays.
 *
 * The scheduler is a no-op if a timer is already pending — pipelines call
 * scheduleDrainIfIdle after enqueueing new items without worrying about
 * duplicate timers. Cleanup on unmount cancels any pending timer.
 */
export function useDrainTimer() {
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drainOne = useCallback(() => {
    drainTimerRef.current = null;
    const { drained, hasMore } = useSessionStore.getState().drainOne();
    if (drained && hasMore) {
      drainTimerRef.current = setTimeout(drainOne, FEED_MIN_GAP_MS);
    }
  }, []);

  const scheduleDrainIfIdle = useCallback(() => {
    if (drainTimerRef.current !== null) return;
    const lastAppendedAt = useSessionStore.getState().lastAppendedAt;
    const elapsed = Date.now() - lastAppendedAt;
    const delay = Math.max(0, FEED_MIN_GAP_MS - elapsed);
    drainTimerRef.current = setTimeout(drainOne, delay);
  }, [drainOne]);

  const cancel = useCallback(() => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
    };
  }, []);

  return { scheduleDrainIfIdle, cancel };
}
