"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

/**
 * Portuguese Bible translations recognized across the app. Keep in sync with
 * lib/prompts/verse.ts and lib/prompts/extract.ts — the LLM is instructed to
 * only pick from this set. Adding one here without updating the prompts will
 * result in the auto-detect never suggesting it.
 */
export const KNOWN_TRANSLATIONS = ["ACF", "ARA", "ARC", "KJA", "KJF", "NAA", "NBV", "NTLH", "NVI", "NVT", "OL"] as const;
export type Translation = (typeof KNOWN_TRANSLATIONS)[number];

/** Session-wide default before extract has a chance to auto-detect. NVI is
 * one of the most widely-published Portuguese translations, so the model
 * tends to reproduce it with high integrity — a safe fallback that keeps
 * verses non-blank on first render. */
export const DEFAULT_TRANSLATION: Translation = "NVI";

type TranslationState = {
  /** User-selected translation. Wins over auto-detect. null = no manual override. */
  manual: string | null;
  /** Auto-detected translation from extract's translationHint. null = not yet detected. */
  auto: string | null;
  /** Effective translation to use for /api/verse calls. null = LLM picks freely. */
  effective: string | null;
  /** Called by the badge dropdown. Passing null clears the manual override. */
  setManual: (next: string | null) => void;
  /** Called by the extract pipeline when it identifies the translation with
   * high confidence. Does not clobber a manual selection. */
  setAuto: (next: string) => void;
};

const TranslationContext = createContext<TranslationState | null>(null);

/**
 * Session-scoped translation preference. Two sources:
 *  - manual: user picked from the badge dropdown (sticky, wins)
 *  - auto: extract's translationHint identified from verbatim reading
 * The effective value is `manual ?? auto ?? null`. Null means the /api/verse
 * prompt is free to pick whichever translation it can reproduce with the
 * most integrity.
 */
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [manual, setManualState] = useState<string | null>(null);
  // Seed with DEFAULT_TRANSLATION so verses have a translation to fetch from
  // the very first render — the badge starts showing "NVI" instead of "AUTO"
  // and no verse is blank while we wait for extract to identify the pastor's
  // actual translation. When extract fires setAuto("NVT") later, it replaces.
  const [auto, setAutoState] = useState<string | null>(DEFAULT_TRANSLATION);

  const setManual = useCallback((next: string | null) => {
    setManualState(next);
  }, []);

  const setAuto = useCallback((next: string) => {
    const clean = next.trim().toUpperCase();
    if (!clean) return;
    setAutoState((prev) => (prev === clean ? prev : clean));
  }, []);

  const value = useMemo<TranslationState>(
    () => ({ manual, auto, effective: manual ?? auto ?? null, setManual, setAuto }),
    [manual, auto, setManual, setAuto]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslationState {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return ctx;
}
