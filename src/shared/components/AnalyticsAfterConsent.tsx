"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, hasConsent } from "@/shared/consent";

/**
 * O GA4 só nasce DEPOIS do aceite de cookies.
 *
 * O `_ga` é o único cookie do site que não é estritamente necessário, e
 * gravá-lo antes do "aceitar" é justamente o que o aviso existe para evitar.
 * Quem aceita no meio da visita passa a ser medido dali em diante, pelo
 * `CONSENT_EVENT`, sem precisar recarregar.
 *
 * As outras condições (produção e `NEXT_PUBLIC_GA_ID`) continuam em
 * `Analytics.tsx`, que só monta este componente quando elas valem.
 */
export function AnalyticsAfterConsent({ gaId }: { gaId: string }) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => setConsented(hasConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  return consented ? <GoogleAnalytics gaId={gaId} /> : null;
}
