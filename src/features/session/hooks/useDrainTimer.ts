"use client";

import { useCallback, useEffect, useRef } from "react";
import { FEED_CITED_VERSE_GAP_MS, FEED_MIN_GAP_MS } from "@/features/session/config";
import { useSessionStore } from "@/features/session/store";

/**
 * Owns the browser setTimeout that drives the feed drip queue. The store
 * decides WHAT to drip and WHEN (state); this hook decides HOW OFTEN (timer).
 * Returned scheduler is stable and safe to include in effect dep arrays.
 *
 * Gap is head-aware: `citedVerse` no head da fila usa FEED_CITED_VERSE_GAP_MS
 * (curto) porque a citação vem do próprio pregador lendo; qualquer outro kind
 * usa FEED_MIN_GAP_MS. `scheduleDrainIfIdle` sempre reagenda — quando um
 * citedVerse fura fila (`enqueueFeedItems` prepend), o timer pendente com o
 * gap longo é substituído por um com o gap curto.
 */
function gapForCurrentHead(): number {
  const head = useSessionStore.getState().dripQueue[0];
  return head?.item.kind === "citedVerse" ? FEED_CITED_VERSE_GAP_MS : FEED_MIN_GAP_MS;
}

export function useDrainTimer() {
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drainOne = useCallback(() => {
    drainTimerRef.current = null;
    const { drained, hasMore } = useSessionStore.getState().drainOne();
    if (drained && hasMore) {
      drainTimerRef.current = setTimeout(drainOne, gapForCurrentHead());
    }
  }, []);

  const scheduleDrainIfIdle = useCallback(() => {
    if (drainTimerRef.current !== null) clearTimeout(drainTimerRef.current);
    const lastAppendedAt = useSessionStore.getState().lastAppendedAt;
    const elapsed = Date.now() - lastAppendedAt;
    const delay = Math.max(0, gapForCurrentHead() - elapsed);
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
