"use client";

import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";

/**
 * Renders a Bible passage as a stack of numbered verses (Bible-app style:
 * superscript verse number + inline text). Each verse fetches independently
 * via useVerseFetch, so cached verses render instantly and only uncached
 * lines show a skeleton — no whole-passage reload flash when the range
 * grows. Used by both the live feed (via ReadingPassage's sliding window)
 * and the final summary's bibleQuote block.
 */
export function PassageVerses({
  bookDisplay,
  chapter,
  startVerse,
  endVerse,
}: {
  bookDisplay: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}) {
  const verses: number[] = [];
  for (let v = startVerse; v <= endVerse; v++) verses.push(v);

  return (
    <div className="flex flex-col gap-1.5 pl-3">
      {verses.map((v) => (
        <VerseLine key={v} reference={`${bookDisplay} ${chapter}:${v}`} verseNumber={v} />
      ))}
    </div>
  );
}

function VerseLine({ reference, verseNumber }: { reference: string; verseNumber: number }) {
  const state = useVerseFetch(reference);
  const text = state.status === "ok" ? state.text : "";
  const loading = state.status === "idle" || state.status === "loading";

  return (
    <p className="text-sm leading-relaxed text-foreground/90">
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
