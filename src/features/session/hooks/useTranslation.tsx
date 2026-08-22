"use client";

import { usePreferencesStore } from "@/lib/stores/preferences";

export {
  DEFAULT_TRANSLATION,
  KNOWN_TRANSLATIONS,
  type Translation,
} from "@/lib/stores/preferences";

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

/**
 * Session-scoped translation preference. Two sources:
 *  - manual: user picked from the badge dropdown (sticky, wins, persisted)
 *  - auto: extract's translationHint identified from verbatim reading
 * The effective value is `manual ?? auto ?? null`. Null means the /api/verse
 * prompt is free to pick whichever translation it can reproduce with the
 * most integrity.
 *
 * Backed by usePreferencesStore (Zustand). No Provider required.
 */
export function useTranslation(): TranslationState {
  const manual = usePreferencesStore((s) => s.translationManual);
  const auto = usePreferencesStore((s) => s.translationAuto);
  const setManual = usePreferencesStore((s) => s.setTranslationManual);
  const setAuto = usePreferencesStore((s) => s.setTranslationAuto);
  return {
    manual,
    auto,
    effective: manual ?? auto ?? null,
    setManual,
    setAuto,
  };
}

/**
 * Kept as a no-op wrapper so callsites can migrate lazily. Once every consumer
 * is verified to work without a Provider, this can be removed and its usages
 * inlined.
 */
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
