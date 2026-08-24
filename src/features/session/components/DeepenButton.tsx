"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoinCost } from "@/components/CoinCost";
import { NavLink } from "@/components/NavLink";

/**
 * Two-state button — before/after the aprofundamento exists.
 * - `hasDeepening=false`: blue solid CTA with the coin cost. Clicking POSTs to
 *   /api/deepening; on success we navigate to /recording/{id}/deepening.
 * - `hasDeepening=true`: neutral "Ver aprofundamento" link with no cost.
 *
 * Two variants:
 * - "summary-header": compact chip that sits next to the "Salvo" badge.
 * - "feed-card": full-width button that replaces the placeholder "Aprofundar"
 *   in the ReflectionCard on /feed.
 */
export const DEEPENING_COST = 10;

export function DeepenButton({
  sessionId,
  hasDeepening,
  variant,
}: {
  sessionId: string;
  hasDeepening: boolean;
  variant: "summary-header" | "feed-card";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = `/recording/${sessionId}/deepening`;

  if (hasDeepening) {
    if (variant === "summary-header") {
      return (
        <NavLink
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--scriba-blue-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-blue)] transition-colors hover:bg-[color:var(--scriba-blue-soft)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--scriba-blue)]/40"
        >
          Ver aprofundamento
        </NavLink>
      );
    }
    return (
      <NavLink
        href={href}
        contentClassName="inline-flex items-center justify-center gap-1.5"
        className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--scriba-blue)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_14px_rgba(79,168,240,0.32)] transition-colors hover:bg-[color:var(--scriba-blue-hover)]"
      >
        Ver aprofundamento
      </NavLink>
    );
  }

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/deepening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `deepen_failed_${res.status}`);
      }
      router.push(href);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  if (variant === "summary-header") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--scriba-blue)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_12px_rgba(79,168,240,0.26)] transition-colors hover:bg-[color:var(--scriba-blue-hover)] disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? "Aprofundando…" : "Aprofundar"}
          <CoinCost count={DEEPENING_COST} />
        </button>
        {error ? (
          <span className="text-[10px] font-medium text-red-600">Falhou. Tente de novo.</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[color:var(--scriba-blue)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_14px_rgba(79,168,240,0.32)] transition-colors hover:bg-[color:var(--scriba-blue-hover)] disabled:cursor-progress disabled:opacity-70"
      >
        {pending ? "Aprofundando…" : "Aprofundar"}
        <CoinCost count={DEEPENING_COST} />
      </button>
      {error ? (
        <span className="text-[10px] font-medium text-red-600">Falhou. Tente de novo.</span>
      ) : null}
    </div>
  );
}
