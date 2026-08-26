"use client";

import { useEffect, useRef, useState } from "react";
import {
  COIN_BALANCE_EVENT,
  type CoinBalanceEventDetail,
  refreshCoinBalance,
} from "@/features/session/lib/coins";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

const COIN_C = 2 * Math.PI * 13; // circumference for r=13 pie chart

const DIGIT_TRANSFORM = [
  "[transform:translateY(0px)]",
  "[transform:translateY(-26px)]",
  "[transform:translateY(-52px)]",
  "[transform:translateY(-78px)]",
  "[transform:translateY(-104px)]",
  "[transform:translateY(-130px)]",
  "[transform:translateY(-156px)]",
  "[transform:translateY(-182px)]",
  "[transform:translateY(-208px)]",
  "[transform:translateY(-234px)]",
] as const;

const DIGIT_TRANSITION: Record<number, string> = {
  0: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_0ms]",
  60: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_60ms]",
  120: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_120ms]",
};

function DigitColumn({ digit, delayMs }: { digit: number; delayMs: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block h-6.5 w-[0.6em] overflow-hidden align-middle"
    >
      <span
        className={cn(
          "block will-change-transform",
          DIGIT_TRANSFORM[digit],
          DIGIT_TRANSITION[delayMs] ?? DIGIT_TRANSITION[0]
        )}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="flex h-6.5 items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function Odometer({ value, minWidth = 3 }: { value: number; minWidth?: number }) {
  const str = String(Math.max(0, Math.floor(value))).padStart(minWidth, "0");
  const digits = str.split("").map((d) => Number(d));
  const firstNonZero = digits.findIndex((d) => d !== 0);
  const firstReal = firstNonZero === -1 ? digits.length - 1 : firstNonZero;

  return (
    <span aria-hidden className="inline-flex h-6.5 items-center">
      {digits.map((d, i) => {
        const hidden = i < firstReal;
        const delay = (digits.length - 1 - i) * 60;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional digit slots — order is stable, index is the correct key
          <span key={`slot-${i}`} className={cn("inline-block", hidden && "invisible")}>
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
    void refreshCoinBalance();
    return () => window.removeEventListener(COIN_BALANCE_EVENT, onUpdate);
  }, []);

  const percent = Math.max(0, Math.min(100, (balance / INITIAL_COIN_BALANCE) * 100));
  const filled = (percent / 100) * COIN_C;

  return (
    <div
      role="status"
      aria-label={`${balance} moedas restantes`}
      className={cn(
        "flex select-none items-center gap-[7px] rounded-5 py-1 pr-3 pl-2.5 transition-colors duration-500",
        flash === "debit" ? "bg-[#FCE1B8]" : flash === "credit" ? "bg-[#DDEFCB]" : "bg-[#FFF9E8]"
      )}
    >
      <div className="relative flex size-6.5 flex-none items-center justify-center">
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden decorative coin ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          width="26"
          height="26"
          viewBox="0 0 26 26"
          aria-hidden
        >
          <circle cx="13" cy="13" r="13" fill="#F0E4C6" />
          <circle
            cx="13"
            cy="13"
            r="13"
            fill="none"
            stroke="#F8C64B"
            strokeWidth="26"
            strokeDasharray={`${filled} ${COIN_C - filled}`}
          />
        </svg>
        <div className="relative flex size-5 items-center justify-center rounded-full bg-white">
          <div className="coin-hex h-[10.625px] w-[9.35px] bg-scriba-yellow" />
        </div>
      </div>
      <span className="inline-flex h-6.5 flex-none items-center text-[13px] font-semibold leading-none tabular-nums text-scriba-gold-ink">
        <Odometer value={balance} />
      </span>
    </div>
  );
}
