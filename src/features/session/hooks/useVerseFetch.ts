"use client";

import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { requestVerse } from "@/features/session/lib/api";
import type { VerseFetchState } from "@/features/session/types";
import type { VersePayload } from "@/lib/domain/verse";

/**
 * Shared query options factory for verse fetching. Both useVerseFetch and
 * prefetchers use this so they hit the same cache entry. Keying by translation
 * lets a session switch preference and re-fetch cleanly without polluting
 * other cached translations.
 */
export function verseQueryOptions(reference: string, translation?: string | null) {
  return queryOptions<VersePayload>({
    queryKey: ["verse", reference, translation ?? "auto"] as const,
    queryFn: async () => {
      const result = await requestVerse(reference, translation);
      if (!result.ok) throw new Error(result.message);
      return result.payload;
    },
  });
}

/**
 * Hook returning a stable prefetcher for warming the verse cache ahead of
 * render — used by the extract pipeline and by ReadingPassage as new verses
 * enter the lookahead window so the text is usually cached by the time the
 * corresponding VerseLine mounts.
 */
export function useVersePrefetcher() {
  const queryClient = useQueryClient();
  return useCallback(
    (reference: string, translation?: string | null) => {
      void queryClient.prefetchQuery(verseQueryOptions(reference, translation));
    },
    [queryClient]
  );
}

/**
 * Fetch the text for a bible reference in an optional preferred translation.
 * Backed by React Query's cache — repeat renders and remounts for the same
 * (reference, translation) are free.
 *
 * Translation-change UX: when only the translation changes (same reference),
 * the previous text stays on screen until the new one lands — no skeleton
 * flash mid-reading. Achieved via `placeholderData: keepPreviousData` +
 * a per-hook lastGood ref (React Query's placeholder covers the fetch
 * window; the ref covers the case where the new fetch returns empty text
 * and we want to keep the previous verse displayed).
 */
export function useVerseFetch(
  reference: string | null,
  translation?: string | null
): VerseFetchState {
  // Last successful non-empty payload we handed to the UI, tagged by reference
  // so we know it's still relevant when translation changes but ref stays.
  const lastGoodRef = useRef<VersePayload | null>(null);

  const query = useQuery({
    ...(reference !== null
      ? verseQueryOptions(reference, translation)
      : { queryKey: ["verse", "__idle__"] as const, queryFn: async () => null as never }),
    enabled: reference !== null,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!reference) {
      lastGoodRef.current = null;
      return;
    }
    const payload = query.data as VersePayload | undefined;
    if (payload?.text && payload.reference === reference) {
      lastGoodRef.current = payload;
    }
  }, [query.data, reference]);

  if (!reference) return { status: "idle" };

  const payload = query.data as VersePayload | undefined;
  const stale =
    lastGoodRef.current && lastGoodRef.current.reference === reference ? lastGoodRef.current : null;

  if (query.isError && !stale) {
    return { status: "error", message: (query.error as Error).message };
  }
  if (!payload && !stale) {
    return { status: "loading" };
  }
  const effective = payload && !payload.text && stale?.text ? stale : (payload ?? stale);
  if (!effective) return { status: "loading" };
  return { status: "ok", ...effective };
}
