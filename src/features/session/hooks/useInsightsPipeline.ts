"use client";

import { type RefObject, useEffect } from "react";
import {
  INSIGHTS_INTERVAL_MS,
  INSIGHTS_MIN_TAIL_DELTA_CHARS,
  INSIGHTS_QUEUE_BACKPRESSURE,
  INSIGHTS_TRANSCRIPT_CHARS,
} from "@/features/session/config";
import { requestInsights } from "@/features/session/lib/api";
import { tailTranscript } from "@/features/session/lib/text";
import { devLog } from "@/lib/log";
import { useSessionStore } from "@/lib/stores/session";

/**
 * INSIGHTS pipeline. setInterval-driven every INSIGHTS_INTERVAL_MS. Paused
 * while readingMode is on — the listener is meant to focus on Scripture.
 *
 * insightsInFlight is intentionally NOT in the effect deps — if it were, each
 * response would tear down and rebuild the setInterval, resetting the 45s
 * clock and cutting call frequency in ~half. State is read via getSessionState()
 * inside the tick instead.
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

  useEffect(() => {
    if (!running || finalizing) return;
    const tick = () => {
      const s = useSessionStore.getState();
      if (s.insightsInFlight) return;
      if (s.readingMode) return;
      // Backpressure: se a fila de drip já tem items esperando aparecer, não
      // faz sentido gerar mais — o novo item só apareceria minutos depois.
      const pending = s.dripQueue.length;
      if (pending >= INSIGHTS_QUEUE_BACKPRESSURE) {
        s.bumpCounter("skippedBackpressure");
        devLog("[insights] skip", { reason: "queue-backpressure", pending });
        return;
      }
      const currentTranscript = Object.values(s.chunks)
        .filter((r) => r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!currentTranscript) return;
      const recent = tailTranscript(currentTranscript, INSIGHTS_TRANSCRIPT_CHARS);
      const delta = currentTranscript.length - s.lastInsightsTailLen;
      if (s.lastInsightsTailLen > 0 && delta < INSIGHTS_MIN_TAIL_DELTA_CHARS) {
        s.bumpCounter("skippedDelta");
        devLog("[insights] skip", { reason: "tail-delta", delta, tailLen: recent.length });
        return;
      }
      s.setLastInsightsTailLen(currentTranscript.length);
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
    };
    const id = setInterval(tick, INSIGHTS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, finalizing, sessionId, scheduleDrainIfIdle, startedAtRef]);
}
