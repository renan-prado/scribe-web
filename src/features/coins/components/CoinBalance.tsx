"use client";

import { useEffect, useRef, useState } from "react";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { useCoinsStore } from "@/features/coins/store";
import { COIN_RING_REFERENCE } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

const COIN_C = 2 * Math.PI * 6.5; // circumference for the r=6.5 stroke centerline (stroke-width 13 fills a r=13 disc without overflowing the viewBox)

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

/**
 * Chip de saldo do header. Clicável: abre o `BillingDialog`, de onde o usuário
 * compra um pacote avulso ou assina um plano. `interactive={false}` devolve o
 * chip puramente informativo (usado onde não faz sentido vender).
 */
export function CoinBalance({
  initialBalance,
  interactive = true,
}: {
  initialBalance: number;
  interactive?: boolean;
}) {
  const storeBalance = useCoinsStore((s) => s.balance);
  const setBalance = useCoinsStore((s) => s.setBalance);
  const refresh = useCoinsStore((s) => s.refresh);

  // Seed store from SSR-fetched balance on first mount so all consumers share
  // the same source of truth immediately (no null flash for downstream gates).
  const seededRef = useRef(false);
  if (!seededRef.current && storeBalance === null) {
    seededRef.current = true;
    setBalance(initialBalance);
  }

  const balance = storeBalance ?? initialBalance;
  const prevBalanceRef = useRef(balance);
  const [flash, setFlash] = useState<"debit" | "credit" | null>(null);

  // NÃO há refresh no mount. O saldo já chegou do servidor em `initialBalance`,
  // renderizado no mesmo request — pedi-lo de novo por HTTP logo depois custava
  // dois `getUser()` (proxy + rota) e mais um SELECT em `profiles` para receber
  // de volta o número que acabou de ser desenhado na tela. Os dois sinais
  // abaixo cobrem o caso em que o saldo muda de verdade sem esta aba saber.

  // O pagamento acontece numa ABA NOVA (para não derrubar uma gravação em
  // curso), então esta aba não recebe nenhum evento próprio quando o crédito
  // entra. Dois sinais cobrem o caso: a volta do foco, e um postMessage que a
  // aba de retorno dispara no `window.opener` assim que vê o saldo subir.
  // Como o store é global, este único listener no header atualiza o app todo.
  useEffect(() => {
    const onFocus = () => void refresh();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === "scriba:coins-updated") {
        void refresh();
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (balance !== prev) {
      setFlash(balance < prev ? "debit" : "credit");
      const id = window.setTimeout(() => setFlash(null), 700);
      prevBalanceRef.current = balance;
      return () => window.clearTimeout(id);
    }
  }, [balance]);

  const percent = Math.max(0, Math.min(100, (balance / COIN_RING_REFERENCE) * 100));
  const filled = (percent / 100) * COIN_C;

  const chip = (
    <span
      className={cn(
        "flex select-none items-center gap-[7px] rounded-[20px] py-1 pr-3 pl-2.5 transition-colors duration-500",
        flash === "debit"
          ? "bg-scriba-flash-debit"
          : flash === "credit"
            ? "bg-scriba-flash-credit"
            : "bg-scriba-gold-soft"
      )}
    >
      <span className="relative flex size-6.5 flex-none items-center justify-center">
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden decorative coin ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          width="26"
          height="26"
          viewBox="0 0 26 26"
          aria-hidden
        >
          <circle cx="13" cy="13" r="13" fill="var(--scriba-gold-track)" />
          <circle
            cx="13"
            cy="13"
            r="6.5"
            fill="none"
            stroke="var(--scriba-yellow)"
            strokeWidth="13"
            strokeDasharray={`${filled} ${COIN_C - filled}`}
          />
        </svg>
        <span className="relative flex size-5 items-center justify-center rounded-full bg-scriba-paper">
          <span className="coin-hex block h-[10.625px] w-[9.35px] bg-scriba-yellow" />
        </span>
      </span>
      <span className="inline-flex h-6.5 flex-none items-center text-[13px] font-semibold leading-none tabular-nums text-scriba-gold-ink">
        <Odometer value={balance} />
      </span>
    </span>
  );

  if (!interactive) {
    return (
      <span role="status" aria-label={`${balance} moedas restantes`} className="inline-flex">
        {chip}
      </span>
    );
  }

  return (
    <BillingDialog
      trigger={chip}
      triggerLabel={`${balance} moedas restantes. Adicionar créditos.`}
      triggerClassName={cn(
        "inline-flex rounded-[20px] outline-none transition-transform",
        "hover:brightness-[0.97] active:scale-[0.97]",
        "focus-visible:ring-2 focus-visible:ring-scriba-yellow/60"
      )}
    />
  );
}
