"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  FEED_CITED_VERSE_GAP_MS,
  FEED_FIRST_CARD_GAP_MS,
  FEED_MIN_GAP_MS,
} from "@/features/session/config";
import { useSessionStore } from "@/features/session/store";

/**
 * Owns the browser setTimeout that drives the feed drip queue. The store
 * decides WHAT to drip and WHEN (state); this hook decides HOW OFTEN (timer).
 * Returned scheduler is stable and safe to include in effect dep arrays.
 *
 * Gap é head-aware e first-card-aware:
 * - `citedVerse` no head → FEED_CITED_VERSE_GAP_MS (curto). A citação vem
 *   do próprio pregador lendo, precisa aparecer perto do momento da fala.
 * - Feed ainda vazio (nenhum card drenado nessa sessão) → FEED_FIRST_CARD_GAP_MS.
 *   Warmup curto pro primeiro card, reduz ansiedade inicial.
 * - Caso geral → FEED_MIN_GAP_MS (longo, ~90s).
 *
 * `scheduleDrainIfIdle` sempre reagenda — quando um citedVerse fura fila
 * (`enqueueFeedItems` prepend), o timer pendente com o gap longo é
 * substituído por um com o gap curto.
 */
function gapForCurrentHead(): number {
  const s = useSessionStore.getState();
  const head = s.dripQueue[0];
  if (head?.item.kind === "citedVerse") return FEED_CITED_VERSE_GAP_MS;
  if (s.feedItems.length === 0) return FEED_FIRST_CARD_GAP_MS;
  return FEED_MIN_GAP_MS;
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
