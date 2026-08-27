"use client";

import { useEffect } from "react";

/**
 * Ask the browser to confirm before the user closes the tab or navigates
 * away while a recording is in progress. Prevents accidental loss of a live
 * session; the exact confirmation text is browser-controlled.
 */
export function useUnloadGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set for the prompt to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);
}
