"use client";

import { type RefObject, useEffect, useMemo } from "react";
import { BIBLE_MIN_TAIL_DELTA_CHARS, BIBLE_TRANSCRIPT_CHARS } from "@/features/session/config";
import { requestBible } from "@/features/session/lib/api";
import { tailTranscript } from "@/features/session/lib/text";
import { hasBibleMention } from "@/lib/bible/detect";
import { useSessionStore } from "@/lib/stores/session";

/**
 * BIBLE pipeline. Fires per new chunk when the regex-gate finds a bible
 * mention in the recent tail.
 *
 * Fast, cheap: gated by regex, tiny transcript window. Emits citedVerse only —
 * the other five feed kinds are exclusive to the insights pipeline.
 */
export function useBiblePipeline({
  sessionId,
  prefetchVerse,
  scheduleDrainIfIdle,
  startedAtRef,
}: {
  sessionId: string;
  prefetchVerse: (reference: string) => void;
  scheduleDrainIfIdle: () => void;
  startedAtRef: RefObject<number>;
}): void {
  const running = useSessionStore((s) => s.running);
  const finalizing = useSessionStore((s) => s.finalizing);
  const bibleInFlight = useSessionStore((s) => s.bibleInFlight);
  const feedItems = useSessionStore((s) => s.feedItems);
  const chunks = useSessionStore((s) => s.chunks);

  const { transcript, okChunkCount } = useMemo(() => {
    const ok = Object.values(chunks)
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index);
    const text = ok
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { transcript: text, okChunkCount: ok.length };
  }, [chunks]);

  useEffect(() => {
    if (!running || bibleInFlight || finalizing) return;
    if (okChunkCount === 0) return;
    const recent = tailTranscript(transcript, BIBLE_TRANSCRIPT_CHARS);
    if (!recent) return;
    const store = useSessionStore.getState();
    const delta = transcript.length - store.lastBibleTailLen;
    if (store.lastBibleTailLen > 0 && delta < BIBLE_MIN_TAIL_DELTA_CHARS) {
      return;
    }
    if (!hasBibleMention(recent)) {
      store.bumpCounter("bibleGateSkipped");
      return;
    }
    store.setLastBibleTailLen(transcript.length);
    store.setBibleInFlight(true);
    store.bumpCounter("bibleCalls");
    const bibleSermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestBible({
      text: recent,
      existingItems: feedItems,
      sermonAtMs: bibleSermonAtMs,
      sessionId,
    })
      .then((items) => {
        const s = useSessionStore.getState();
        s.bumpCounter("bibleYield", items.length);
        for (const item of items) {
          if (item.kind === "citedVerse" && !item.text && item.reference.includes(":")) {
            prefetchVerse(item.reference);
          }
        }
        const { hasDripAdd } = s.enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
      })
      .finally(() => useSessionStore.getState().setBibleInFlight(false));
  }, [
    running,
    okChunkCount,
    transcript,
    bibleInFlight,
    finalizing,
    feedItems,
    sessionId,
    prefetchVerse,
    scheduleDrainIfIdle,
    startedAtRef,
  ]);
}
