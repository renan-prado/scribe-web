"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Latch a warning whenever the tab is hidden while `enabled` is true. Browsers
 * pause getUserMedia timeslicing when backgrounded, so we surface a UI hint
 * that some fraction of the audio may have been lost.
 *
 * The warning stays latched until the caller dismisses it explicitly.
 */
export function useVisibilityWarning({ enabled }: { enabled: boolean }): {
  warning: boolean;
  dismiss: () => void;
} {
  const [warning, setWarning] = useState(false);

  const dismiss = useCallback(() => setWarning(false), []);

  useEffect(() => {
    if (!enabled) {
      setWarning(false);
      return;
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") setWarning(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  return { warning, dismiss };
}
