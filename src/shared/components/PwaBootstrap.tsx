"use client";

import { useEffect } from "react";

/**
 * Register the minimal service worker on the client. Runs once per session;
 * failures are silent (some browsers block SW on http:// contexts, private
 * mode, etc.). See `public/sw.js` for what it actually does: nos tornar
 * instaláveis como PWA e servir a tela de `public/offline.html` quando uma
 * navegação falha sem rede. Ele NÃO cacheia o app — o porquê está lá.
 */
export function PwaBootstrap(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Never register in dev — HMR + SW causes hard-to-debug stale-code loops.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // ignore — user may be on an unsupported browser or file:// scheme
    });
  }, []);
  return null;
}
