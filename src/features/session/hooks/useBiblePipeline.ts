"use client";

import { type RefObject, useEffect, useMemo } from "react";
import { BIBLE_MIN_TAIL_DELTA_CHARS, BIBLE_TRANSCRIPT_CHARS } from "@/features/session/config";
import { requestBible } from "@/features/session/lib/api";
import { tailTranscript } from "@/features/session/lib/text";
import { hasBibleMention } from "@/lib/bible/detect";
import { devLog } from "@/lib/log";
import { useSessionStore } from "@/lib/stores/session";

/**
 * BIBLE pipeline. Fires per new chunk when either (a) the regex-gate finds a
 * bible mention in the recent tail OR (b) we're already in readingMode (so the
 * passage card can keep expanding as the pastor reads more verses even when
 * the current chunk doesn't repeat the book name).
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
  const readingMode = useSessionStore((s) => s.readingMode);
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
    const inReading = store.readingMode;
    // Delta gate is a cost-control heuristic that assumes "same content = same
    // answer". That assumption breaks during readingMode because we're actively
    // watching for two transitions the LLM can only see in a NEW call: (a) more
    // verses read → passage card needs to grow, (b) reading ended → readingMode
    // must flip false so insights resume. Skipping ticks in-reading has cost
    // both ways. Bypass the gate; the ~10 calls/min is acceptable during the
    // reading window (typically <1min).
    const delta = transcript.length - store.lastBibleTailLen;
    if (!inReading && store.lastBibleTailLen > 0 && delta < BIBLE_MIN_TAIL_DELTA_CHARS) {
      return;
    }
    if (!inReading && !hasBibleMention(recent)) {
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
      .then(({ items, thinking: nextThinking, readingMode: nextReadingMode }) => {
        const s = useSessionStore.getState();
        s.bumpCounter("bibleYield", items.length);
        for (const item of items) {
          if (item.kind === "citedVerse" && !item.text && item.reference.includes(":")) {
            prefetchVerse(item.reference);
          }
        }
        const { hasDripAdd } = s.enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
        if (nextThinking) s.setThinking(nextThinking);
        s.setReadingMode(nextReadingMode);
        if (nextReadingMode !== readingMode) {
          devLog("[feed] readingMode →", nextReadingMode);
        }
      })
      .finally(() => useSessionStore.getState().setBibleInFlight(false));
  }, [
    running,
    okChunkCount,
    transcript,
    bibleInFlight,
    finalizing,
    feedItems,
    readingMode,
    sessionId,
    prefetchVerse,
    scheduleDrainIfIdle,
    startedAtRef,
  ]);
}
