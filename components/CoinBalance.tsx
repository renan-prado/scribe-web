"use client";

import { useEffect, useRef, useState } from "react";
import {
  COIN_BALANCE_EVENT,
  type CoinBalanceEventDetail,
  refreshCoinBalance,
} from "@/features/session/lib/coins";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";

/**
 * Header chip showing the caller's coin balance. Seeded from the SSR value
 * passed by AppLayout so the first paint is correct; then subscribes to the
 * `scriba:coin-balance` window event so any spend (recording tick,
 * aprofundar) updates the chip instantly without a refetch.
 *
 * The number renders as an odometer — each digit column translates
 * vertically to its target, staggered right-to-left so the leftmost digit
 * settles last (that's the "cassino" cue that a debit is in progress).
 * The donut around the coin visualizes remaining fraction against the
 * INITIAL_COIN_BALANCE anchor.
 */

/**
 * Odometer digit height in px. Matches the coin donut (26px) so both the
 * donut and the number column occupy the same bounding box on the chip's
 * cross axis — that's what makes them visually share a horizontal midline
 * regardless of the digit glyph's own descender/ascender space.
 */
const DIGIT_H = 26;

/** Vertical column of 0-9; translates to expose the target digit. */
function DigitColumn({ digit, delayMs }: { digit: number; delayMs: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block overflow-hidden align-middle"
      style={{ height: DIGIT_H, width: "0.6em" }}
    >
      <span
        className="block will-change-transform"
        style={{
          transform: `translateY(-${digit * DIGIT_H}px)`,
          transition: `transform 650ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className="flex items-center justify-center leading-none"
            style={{ height: DIGIT_H }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Renders `value` as a right-aligned odometer. Digit count is padded to
 * `minWidth` so shrinking from 100 → 99 doesn't nudge layout. Rightmost
 * digit animates first — the eye tracks change from where units live.
 */
function Odometer({ value, minWidth = 3 }: { value: number; minWidth?: number }) {
  const str = String(Math.max(0, Math.floor(value))).padStart(minWidth, "0");
  const digits = str.split("").map((d) => Number(d));
  // Hide leading zeros as invisible but still occupy width, so 7 shows as "  7"
  // (with the leading pair of columns present but glyph-empty).
  const firstNonZero = digits.findIndex((d) => d !== 0);
  const firstReal = firstNonZero === -1 ? digits.length - 1 : firstNonZero;

  return (
    <span aria-hidden className="inline-flex items-center" style={{ height: DIGIT_H }}>
      {digits.map((d, i) => {
        const hidden = i < firstReal;
        // Stagger: rightmost column has the shortest delay.
        const delay = (digits.length - 1 - i) * 60;
        // Slot identity is the position within the fixed-width odometer, so
        // the array index IS the stable key here (digits at position i change
        // over time; the slot doesn't).
        const slotKey = `slot-${i}`;
        return (
          <span
            key={slotKey}
            style={{ visibility: hidden ? "hidden" : "visible" }}
            className="inline-block"
          >
            <DigitColumn digit={d} delayMs={delay} />
          </span>
        );
      })}
    </span>
  );
}

export function CoinBalance({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);
  const prevBalanceRef = useRef(initialBalance);
  const [flash, setFlash] = useState<"debit" | "credit" | null>(null);

  useEffect(() => {
    function onUpdate(ev: Event) {
      const detail = (ev as CustomEvent<CoinBalanceEventDetail>).detail;
      if (!detail || typeof detail.balance !== "number") return;
      const next = Math.max(0, detail.balance);
      const prev = prevBalanceRef.current;
      if (next !== prev) {
        setFlash(next < prev ? "debit" : "credit");
        window.setTimeout(() => setFlash(null), 700);
      }
      prevBalanceRef.current = next;
      setBalance(next);
    }
    window.addEventListener(COIN_BALANCE_EVENT, onUpdate);
    // Re-sync once on mount in case the SSR value drifted (e.g. a background
    // tab charged while the tab was hidden).
    void refreshCoinBalance();
    return () => window.removeEventListener(COIN_BALANCE_EVENT, onUpdate);
  }, []);

  const percent = Math.max(0, Math.min(100, (balance / INITIAL_COIN_BALANCE) * 100));

  return (
    <div
      role="status"
      aria-label={`${balance} moedas restantes`}
      className={`flex select-none items-center gap-[7px] rounded-[20px] py-1 pr-3 pl-2.5 transition-colors duration-500 ${
        flash === "debit" ? "bg-[#FCE1B8]" : flash === "credit" ? "bg-[#DDEFCB]" : "bg-[#FFF9E8]"
      }`}
    >
      <div
        className="flex size-[26px] flex-none items-center justify-center rounded-full transition-[background] duration-500"
        style={{
          background: `conic-gradient(#F8C64B 0 ${percent}%, #F0E4C6 ${percent}% 100%)`,
        }}
      >
        <div className="flex size-5 items-center justify-center rounded-full bg-white">
          <div
            className="bg-[#F8C64B]"
            style={{
              width: "9.35px",
              height: "10.625px",
              clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
            }}
          />
        </div>
      </div>
      <span
        className="inline-flex flex-none items-center text-[13px] font-semibold leading-none tabular-nums text-[#B07F13]"
        style={{ height: DIGIT_H }}
      >
        <Odometer value={balance} />
      </span>
    </div>
  );
}
