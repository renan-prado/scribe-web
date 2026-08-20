"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/features/session/hooks/useTranslation";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import { cn } from "@/lib/utils";

/**
 * Renders a Bible passage as a stack of numbered verses (Bible-app style:
 * superscript verse number + inline text). Each verse fetches independently
 * via useVerseFetch, so cached verses render instantly and only uncached
 * lines show a skeleton — no whole-passage reload flash when the range
 * grows. Used by both the live feed (via ReadingPassage's sliding window)
 * and the final summary's bibleQuote block.
 *
 * Progressive-in-order reveal: fetches fire in parallel (fast), but each
 * verse only becomes visible once its own AND every previous verse's fetch
 * has resolved. Prevents v2 from popping in before v1 when the API resolves
 * out of order. Verses that stay "not ready" don't hold the passage back
 * forever — see the readySet CSS-hidden pattern below.
 */
export function PassageVerses({
  bookDisplay,
  chapter,
  startVerse,
  endVerse,
  onTranslationResolved,
}: {
  bookDisplay: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  /** Called whenever the first verse resolves with an actual translation so the
   * parent can reflect the real translation in the badge (may differ from what
   * was requested when the model falls back to a known translation). */
  onTranslationResolved?: (translation: string) => void;
}) {
  const [readySet, setReadySet] = useState<Set<number>>(new Set());
  const handleReady = useCallback((v: number) => {
    setReadySet((prev) => {
      if (prev.has(v)) return prev;
      const next = new Set(prev);
      next.add(v);
      return next;
    });
  }, []);

  // maxRevealed = highest N such that every verse in [startVerse..N] has
  // reported ready. Once a verse further ahead is ready but a lower one
  // isn't, we wait — visibility is strictly in reading order.
  let maxRevealed = startVerse - 1;
  for (let v = startVerse; v <= endVerse; v++) {
    if (!readySet.has(v)) break;
    maxRevealed = v;
  }

  const verses: number[] = [];
  for (let v = startVerse; v <= endVerse; v++) verses.push(v);

  return (
    <div className="flex flex-col gap-1.5 pl-3">
      {verses.map((v) => (
        <VerseLine
          key={v}
          reference={`${bookDisplay} ${chapter}:${v}`}
          verseNumber={v}
          hidden={v > maxRevealed}
          onReady={handleReady}
          onTranslationResolved={v === startVerse ? onTranslationResolved : undefined}
        />
      ))}
    </div>
  );
}

function VerseLine({
  reference,
  verseNumber,
  hidden,
  onReady,
  onTranslationResolved,
}: {
  reference: string;
  verseNumber: number;
  hidden: boolean;
  onReady: (v: number) => void;
  onTranslationResolved?: (translation: string) => void;
}) {
  const { effective } = useTranslation();
  const state = useVerseFetch(reference, effective);
  const text = state.status === "ok" ? state.text : "";
  const loading = state.status === "idle" || state.status === "loading";

  useEffect(() => {
    // "Ready" = fetch reached a terminal state (ok or error). We include
    // error so a stubbornly-failing verse doesn't gate the whole passage.
    if (state.status !== "idle" && state.status !== "loading") {
      onReady(verseNumber);
    }
  }, [state.status, verseNumber, onReady]);

  useEffect(() => {
    // Report the actual translation of the displayed text back to the badge.
    // Fires whenever the resolved translation changes (e.g. stale NVI → new NVT,
    // or requested NVT but model returned ARC).
    if (state.status === "ok" && state.text && onTranslationResolved) {
      onTranslationResolved(state.translation);
    }
  }, [state, onTranslationResolved]);

  return (
    <p className={cn("text-sm leading-relaxed text-foreground/90", hidden && "hidden")}>
      <sup className="mr-1.5 select-none align-[0.35em] text-[0.65rem] font-semibold text-muted-foreground">
        {verseNumber}
      </sup>
      {text ? (
        <span>{text}</span>
      ) : loading ? (
        <span
          aria-hidden
          className="inline-block h-3 w-40 animate-skeleton-shimmer rounded-md bg-muted align-middle"
        />
      ) : null}
    </p>
  );
}
