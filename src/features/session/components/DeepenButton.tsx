"use client";

import { cva } from "class-variance-authority";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { PageBlurOverlay } from "@/components/PageBlurOverlay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { useCoinsStore } from "@/features/coins/store";
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

type DeepenButtonProps = {
  sessionId: string;
  hasDeepening: boolean;
  variant: "summary-header" | "feed-card" | "cta-card";
};

const deepenButtonVariants = cva(
  "inline-flex items-center rounded-full font-semibold uppercase tracking-wider transition-colors disabled:cursor-progress disabled:opacity-70",
  {
    variants: {
      layout: {
        compact: "gap-1.5 px-3 py-1.5 text-[11px]",
        full: "w-full justify-center gap-2 px-4 py-3 text-[11px] sm:flex-1",
      },
      state: {
        enabled:
          "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)]",
        disabled: "cursor-not-allowed bg-scriba-ink-mute/25 text-scriba-ink-mute shadow-none",
      },
    },
    defaultVariants: {
      layout: "full",
      state: "enabled",
    },
  }
);

export function DeepenButton({ sessionId, hasDeepening, variant }: DeepenButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);
  const balanceLoading = balance === null;
  const insufficient = balance !== null && balance < DEEPENING_COST;

  const href = `/recording/${sessionId}/deepening`;
  const layout = variant === "feed-card" ? "full" : "compact";

  if (hasDeepening) {
    if (variant === "summary-header" || variant === "cta-card") {
      return (
        <NavLink
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/40"
        >
          <BookOpen aria-hidden className="size-3.5" />
          Ver estudo
        </NavLink>
      );
    }
    return (
      <NavLink
        href={href}
        contentClassName="inline-flex items-center justify-center gap-1.5"
        className="inline-flex w-full items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)] transition-colors sm:flex-1"
      >
        <BookOpen aria-hidden className="size-3.5" />
        Ver estudo
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
      void refresh();
      router.push(href);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || insufficient}
      aria-disabled={insufficient}
      className={deepenButtonVariants({
        layout,
        state: insufficient ? "disabled" : "enabled",
      })}
    >
      <BookOpen aria-hidden className="size-3.5" />
      {pending ? "Gerando estudo…" : "Gerar estudo"}
      <CoinCost count={DEEPENING_COST} />
    </button>
  );

  // Skeleton while the initial balance fetch is pending — matches the pill
  // shape exactly so the actual button drops in without a layout shift.
  const skeleton =
    variant === "summary-header" ? (
      <span
        aria-hidden
        className="inline-block h-7.5 w-32.5 animate-pulse rounded-full bg-scriba-ink-mute/15"
      />
    ) : (
      <span
        aria-hidden
        className="block h-11.5 w-full animate-pulse rounded-full bg-scriba-ink-mute/15"
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
        <TooltipContent>Moedas insuficientes para gerar estudo.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    button
  );

  const overlay = (
    <PageBlurOverlay
      open={pending}
      title="Gerando o estudo"
      subtitle="Buscando cross-references, distinções doutrinárias e vozes da tradição."
    />
  );

  if (variant === "summary-header" || variant === "cta-card") {
    return (
      <div
        className={cn(
          "flex flex-col gap-1",
          variant === "summary-header" ? "items-start sm:items-end" : "items-start"
        )}
      >
        {wrapped}
        {error && !insufficient ? (
          <span className="text-[10px] font-medium text-red-600">
            {error === "insufficient_balance" ? "Saldo insuficiente." : "Falhou. Tente de novo."}
          </span>
        ) : null}
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:flex-1">
      {wrapped}
      {error && !insufficient ? (
        <span className="text-[10px] font-medium text-red-600">Falhou. Tente de novo.</span>
      ) : null}
      {overlay}
    </div>
  );
}
