"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import {
  INSIGHTS_CHUNK_INTERVAL,
  INSIGHTS_FIRST_FIRE_CHUNK,
  INSIGHTS_MIN_TAIL_DELTA_CHARS,
  INSIGHTS_QUEUE_BACKPRESSURE,
  INSIGHTS_TRANSCRIPT_CHARS,
} from "@/features/session/config";
import { requestInsights } from "@/features/session/lib/api";
import { joinOkChunks } from "@/features/session/lib/chunks";
import { tailTranscript } from "@/features/session/lib/text";
import { useSessionStore } from "@/features/session/store";
import { createLogger } from "@/lib/log";

const log = createLogger("insights");

/**
 * INSIGHTS pipeline. Fires every INSIGHTS_CHUNK_INTERVAL successfully
 * transcribed chunks (chunk-count-based, not time-based). O primeiro disparo
 * da sessão usa INSIGHTS_FIRST_FIRE_CHUNK (warmup) — o feed mostra algo útil
 * já no início em vez de esperar um intervalo inteiro.
 *
 * insightsInFlight is intentionally NOT in the effect deps — re-triggering
 * on flight changes would cause unnecessary re-runs. State is read via
 * getState() inside the effect instead.
 */
export function useInsightsPipeline({
  sessionId,
  scheduleDrainIfIdle,
  startedAtRef,
}: {
  sessionId: string;
  scheduleDrainIfIdle: () => void;
  startedAtRef: RefObject<number>;
}): void {
  const running = useSessionStore((s) => s.running);
  const finalizing = useSessionStore((s) => s.finalizing);
  const chunks = useSessionStore((s) => s.chunks);

  const { transcript, okChunkCount } = useMemo(
    () => joinOkChunks(chunks, { excludeSuspect: true }),
    [chunks]
  );

  const lastFiredChunkRef = useRef(0);

  useEffect(() => {
    if (!running || finalizing) return;
    if (okChunkCount === 0) return;
    const interval =
      lastFiredChunkRef.current === 0 ? INSIGHTS_FIRST_FIRE_CHUNK : INSIGHTS_CHUNK_INTERVAL;
    if (okChunkCount - lastFiredChunkRef.current < interval) return;

    const s = useSessionStore.getState();
    if (s.insightsInFlight) return;
    const pending = s.dripQueue.length;
    if (pending >= INSIGHTS_QUEUE_BACKPRESSURE) {
      s.bumpCounter("skippedBackpressure");
      log.debug("skip", { reason: "queue-backpressure", pending });
      return;
    }
    if (!transcript) return;
    const recent = tailTranscript(transcript, INSIGHTS_TRANSCRIPT_CHARS);
    const delta = transcript.length - s.lastInsightsTailLen;
    if (s.lastInsightsTailLen > 0 && delta < INSIGHTS_MIN_TAIL_DELTA_CHARS) {
      s.bumpCounter("skippedDelta");
      log.debug("skip", { reason: "tail-delta", delta });
      return;
    }

    lastFiredChunkRef.current = okChunkCount;
    s.setLastInsightsTailLen(transcript.length);
    s.setInsightsInFlight(true);
    s.bumpCounter("insightsCalls");
    const sermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestInsights({
      text: recent,
      existingItems: s.feedItems,
      sermonAtMs,
      sessionId,
    })
      .then((items) => {
        const cur = useSessionStore.getState();
        cur.bumpCounter("insightsYield", items.length);
        const { hasDripAdd } = cur.enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
      })
      .finally(() => {
        useSessionStore.getState().setInsightsInFlight(false);
      });
  }, [running, finalizing, okChunkCount, transcript, sessionId, scheduleDrainIfIdle, startedAtRef]);
}
