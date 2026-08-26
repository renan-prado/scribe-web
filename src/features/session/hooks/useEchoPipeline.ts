"use client";

import { type RefObject, useEffect, useMemo } from "react";
import { ECHO_MIN_TAIL_DELTA_CHARS, INSIGHTS_TRANSCRIPT_CHARS } from "@/features/session/config";
import { requestEcho } from "@/features/session/lib/api";
import { tailTranscript } from "@/features/session/lib/text";
import { useSessionStore } from "@/features/session/store";
import { feedItemOrigin } from "@/lib/domain/feed";
import { devLog } from "@/lib/log";

/**
 * ECHO pipeline. Fires when the feed accumulates aiStreakThreshold AI-authored
 * cards in a row. Injects a single verbatim speakerEcho phrase that visually
 * breaks the streak of AI cards.
 *
 * The threshold is re-sampled after each successful reveal (see store's
 * rerollEchoThreshold) so the cadence doesn't feel metronomic.
 */
export function useEchoPipeline({
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
  const feedItems = useSessionStore((s) => s.feedItems);
  const chunks = useSessionStore((s) => s.chunks);

  const transcript = useMemo(
    () =>
      Object.values(chunks)
        .filter((r) => r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    [chunks]
  );

  useEffect(() => {
    if (!running || finalizing) return;
    const s = useSessionStore.getState();
    const last = feedItems[feedItems.length - 1];
    if (s.echoing && last?.kind === "speakerEcho") {
      s.setEchoing(false);
      s.rerollEchoThreshold();
    }
    if (useSessionStore.getState().echoing) return;

    let streak = 0;
    for (let i = feedItems.length - 1; i >= 0; i--) {
      if (feedItemOrigin(feedItems[i]) === "ai") streak++;
      else break;
    }
    if (streak < useSessionStore.getState().aiStreakThreshold) return;

    const recent = tailTranscript(transcript, INSIGHTS_TRANSCRIPT_CHARS);
    if (!recent) return;
    const delta = transcript.length - useSessionStore.getState().lastEchoTailLen;
    if (useSessionStore.getState().lastEchoTailLen > 0 && delta < ECHO_MIN_TAIL_DELTA_CHARS) {
      return;
    }

    useSessionStore.getState().setLastEchoTailLen(transcript.length);
    useSessionStore.getState().setEchoing(true);
    const sermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    devLog("[echo] fire", {
      streak,
      threshold: useSessionStore.getState().aiStreakThreshold,
    });
    void requestEcho({ text: recent, existingItems: feedItems, sermonAtMs, sessionId })
      .then((items) => {
        if (items.length === 0) {
          useSessionStore.getState().setEchoing(false);
          return;
        }
        const { hasDripAdd } = useSessionStore.getState().enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
      })
      .catch(() => {
        useSessionStore.getState().setEchoing(false);
      });
  }, [feedItems, running, finalizing, transcript, sessionId, scheduleDrainIfIdle, startedAtRef]);
}
