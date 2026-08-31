"use client";

import { CreditCard, Pause, Play, Square, Trash2, WalletMinimal } from "lucide-react";
import { useState } from "react";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { formatMmSs } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

type Props = {
  elapsedMs: number;
  onResume: () => void;
  onStop: () => void;
  /** End the recording and discard it — no summary, session row deleted. The
   * caller gates this behind a confirmation dialog. */
  onDiscard?: () => void;
  /**
   * A pausa não foi escolhida: o saldo de créditos acabou e a captura foi
   * congelada. Troca o discurso do overlay e promove "Adicionar créditos" a
   * ação principal. Ver `useCoinGuard`.
   */
  outOfCoins?: boolean;
};

/**
 * Softly-veiled overlay shown while the session is paused. Preserves the feed
 * behind a blur so the user knows their work is intact; the CTAs make the
 * only reasonable next actions explicit: resume capture or stop and generate
 * the summary. While visible, coin billing and OpenAI pipelines are frozen —
 * see `useCoinTick`, `useBackgroundKeepalive`, and the `paused` flag in the
 * session store.
 *
 * Em `outOfCoins`, o mesmo overlay vira a tela de "acabou o crédito": o botão
 * de retomar sai (não há o que retomar sem saldo), entra o de comprar, e o
 * texto deixa explícito que NADA foi perdido — a gravação está esperando, não
 * encerrada. Assim que o crédito entra, `useCoinGuard` derruba a flag e o
 * overlay volta ao estado normal de pausa, com "Retomar" ativo.
 */
export function PausedOverlay({
  elapsedMs,
  onResume,
  onStop,
  onDiscard,
  outOfCoins = false,
}: Props) {
  const [billingOpen, setBillingOpen] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paused-title"
      className={cn(
        "fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 px-6",
        "bg-scriba-paper/85 backdrop-blur-md text-center"
      )}
    >
      <span
        className={cn(
          "relative flex size-16 items-center justify-center rounded-full shadow-inner",
          outOfCoins
            ? "bg-scriba-gold-soft text-scriba-gold-ink"
            : "bg-scriba-blue-soft text-scriba-blue"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 animate-ping rounded-full [animation-duration:3s]",
            outOfCoins ? "bg-scriba-yellow/25" : "bg-scriba-blue/25"
          )}
        />
        {outOfCoins ? (
          <WalletMinimal className="relative size-7" strokeWidth={2.2} />
        ) : (
          <Pause className="relative size-7" strokeWidth={2.2} />
        )}
      </span>

      <div className="flex flex-col items-center gap-1">
        <p id="paused-title" className="font-heading text-lg font-semibold text-scriba-ink-strong">
          {outOfCoins ? "Seus créditos acabaram" : "Gravação em pausa"}
        </p>
        <p className="max-w-sm text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
          {outOfCoins
            ? "A gravação está congelada, não encerrada — tudo o que foi capturado até agora continua aqui. Adicione créditos e retome de onde parou, ou encerre agora e gere o resumo do que já temos."
            : "Nada está sendo capturado agora. Nenhuma moeda é consumida enquanto estiver pausado."}
        </p>
      </div>

      <p className="font-mono text-2xl font-semibold tabular-nums tracking-widest text-scriba-ink">
        {formatMmSs(elapsedMs)}
      </p>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        {outOfCoins ? (
          <button
            type="button"
            onClick={() => setBillingOpen(true)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full bg-scriba-blue px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,168,240,0.32)] outline-none transition-colors",
              "hover:bg-scriba-blue-hover focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            <CreditCard className="size-4" strokeWidth={2.2} />
            Adicionar créditos
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full bg-scriba-blue px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,168,240,0.32)] transition-colors outline-none",
              "hover:bg-scriba-blue-hover",
              "focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            <Play className="size-4 fill-current" />
            Retomar gravação
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-scriba-hairline bg-scriba-paper px-6 py-3 text-sm font-semibold text-scriba-ink transition-colors outline-none",
            "hover:bg-scriba-blue-soft/40",
            "focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          <Square className="size-4 fill-current" />
          Encerrar e gerar resumo
        </button>
      </div>

      {outOfCoins ? (
        <p className="max-w-xs text-pretty text-[11px] font-light leading-relaxed text-scriba-ink-mute">
          O pagamento abre numa aba nova. Esta gravação continua aqui — o saldo se atualiza sozinho
          quando a compra for confirmada.
        </p>
      ) : null}

      {onDiscard ? (
        <button
          type="button"
          onClick={onDiscard}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-destructive/80 outline-none transition-colors",
            "hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/30"
          )}
        >
          <Trash2 className="size-3.5" />
          Descartar gravação
        </button>
      ) : null}

      <BillingDialog
        open={billingOpen}
        onOpenChange={setBillingOpen}
        notice={
          <>
            <strong className="font-semibold">Sua gravação está esperando.</strong> Assim que os
            créditos entrarem, feche a aba do pagamento e volte aqui para retomar.
          </>
        }
      />
    </div>
  );
}
