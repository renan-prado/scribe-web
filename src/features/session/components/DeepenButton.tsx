"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoinCost } from "@/components/CoinCost";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { refreshCoinBalance, useCoinBalance } from "@/features/session/lib/coins";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

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
 *
 * When the caller's coin balance is below DEEPENING_COST the button renders
 * grey/disabled with a "moedas insuficientes" tooltip. While the initial
 * balance fetch is pending we render a skeleton pill of the same shape so
 * the button never flashes enabled → disabled.
 */
export const DEEPENING_COST = COIN_COSTS.deepening;

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
  const balance = useCoinBalance();
  const balanceLoading = balance === null;
  const insufficient = balance !== null && balance < DEEPENING_COST;

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
        className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--scriba-blue)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_14px_rgba(79,168,240,0.32)] transition-colors hover:bg-[color:var(--scriba-blue-hover)] sm:flex-1"
      >
        Ver aprofundamento
      </NavLink>
    );
  }

  async function handleClick() {
    if (pending || insufficient) return;
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
        if (res.status === 402 || data.error === "insufficient_balance") {
          throw new Error("insufficient_balance");
        }
        throw new Error(data.error || `deepen_failed_${res.status}`);
      }
      // Re-sync the header chip: the server debited COIN_COSTS.deepening.
      void refreshCoinBalance();
      router.push(href);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  // Style branches: `enabled` is the live blue CTA; `disabled` is the muted
  // grey with the coin cost still visible so the user can read the price.
  const baseEnabled =
    "bg-[color:var(--scriba-blue)] text-white shadow-[0_5px_14px_rgba(79,168,240,0.32)] hover:bg-[color:var(--scriba-blue-hover)]";
  const baseDisabled =
    "cursor-not-allowed bg-[color:var(--scriba-ink-mute)]/25 text-[color:var(--scriba-ink-mute)] shadow-none";

  const summaryClass = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-progress disabled:opacity-70",
    insufficient ? baseDisabled : baseEnabled
  );
  const feedClass = cn(
    "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-progress disabled:opacity-70 sm:flex-1",
    insufficient ? baseDisabled : baseEnabled
  );

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || insufficient}
      aria-disabled={insufficient}
      className={variant === "summary-header" ? summaryClass : feedClass}
    >
      {pending ? "Aprofundando…" : "Aprofundar"}
      <CoinCost count={DEEPENING_COST} />
    </button>
  );

  // Skeleton while the initial balance fetch is pending — matches the pill
  // shape exactly so the actual button drops in without a layout shift.
  const skeleton =
    variant === "summary-header" ? (
      <span
        aria-hidden
        className="inline-block h-[30px] w-[130px] animate-pulse rounded-full bg-[color:var(--scriba-ink-mute)]/15"
      />
    ) : (
      <span
        aria-hidden
        className="block h-[46px] w-full animate-pulse rounded-full bg-[color:var(--scriba-ink-mute)]/15"
      />
    );

  // Base UI's Tooltip only reacts to hover/focus on its trigger — a disabled
  // <button> stops pointer events, so we wrap it in a focusable span that
  // keeps the tooltip reachable while the button itself stays non-clickable.
  const wrapped = balanceLoading ? (
    skeleton
  ) : insufficient ? (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for the tooltip on a disabled button
              tabIndex={0}
              className={cn(
                "inline-flex focus:outline-none",
                variant === "feed-card" && "w-full sm:w-auto"
              )}
            />
          }
        >
          {button}
        </TooltipTrigger>
        <TooltipContent>Moedas insuficientes para aprofundar.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    button
  );

  if (variant === "summary-header") {
    return (
      <div className="flex flex-col items-end gap-1">
        {wrapped}
        {error && !insufficient ? (
          <span className="text-[10px] font-medium text-red-600">
            {error === "insufficient_balance" ? "Saldo insuficiente." : "Falhou. Tente de novo."}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:flex-1">
      {wrapped}
      {error && !insufficient ? (
        <span className="text-[10px] font-medium text-red-600">Falhou. Tente de novo.</span>
      ) : null}
    </div>
  );
}
