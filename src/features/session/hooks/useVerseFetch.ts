"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { requestVerse } from "@/features/session/lib/api";
import type { VerseFetchState } from "@/features/session/types";
import type { VersePayload } from "@/lib/domain/verse";

/**
 * Shared query options for verse fetching. Both useVerseFetch and prefetchers
 * hit this so cache entries collide correctly.
 */
export function verseQueryOptions(reference: string) {
  return queryOptions<VersePayload>({
    queryKey: ["verse", reference] as const,
    queryFn: async () => {
      const result = await requestVerse(reference);
      if (!result.ok) throw new Error(result.message);
      return result.payload;
    },
  });
}

/**
 * Hook returning a stable prefetcher for warming the verse cache — used by
 * the extract pipeline and by ReadingPassage as new verses enter the
 * lookahead window so the text is usually cached by the time the
 * corresponding VerseLine mounts.
 */
export function useVersePrefetcher() {
  const queryClient = useQueryClient();
  return useCallback(
    (reference: string) => {
      void queryClient.prefetchQuery(verseQueryOptions(reference));
    },
    [queryClient]
  );
}

/**
 * Fetch the text for a bible reference. Always NVI (see /api/verse route).
 * Backed by React Query's cache — repeat renders and remounts for the same
 * reference are free.
 */
export function useVerseFetch(reference: string | null): VerseFetchState {
  const query = useQuery({
    ...(reference !== null
      ? verseQueryOptions(reference)
      : { queryKey: ["verse", "__idle__"] as const, queryFn: async () => null as never }),
    enabled: reference !== null,
  });

  if (!reference) return { status: "idle" };

  const payload = query.data as VersePayload | undefined;
  if (query.isError && !payload) {
    return { status: "error", message: (query.error as Error).message };
  }
  if (!payload) return { status: "loading" };
  return { status: "ok", reference: payload.reference, text: payload.text };
}
