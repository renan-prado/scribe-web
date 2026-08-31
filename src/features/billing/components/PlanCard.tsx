"use client";

import { CalendarClock, CreditCard, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import {
  checkoutErrorMessage,
  navigateCheckoutWindow,
  openCheckoutWindow,
  requestBillingPortal,
} from "@/features/billing/lib/api";
import { getBillingState, useBillingStore } from "@/features/billing/store";
import { formatBrl, formatCoins, isActiveStatus, PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Card de plano do /profile: mostra em que plano a pessoa está, quando renova
 * (ou quando expira, se ela cancelou) e dá os dois caminhos possíveis —
 * assinar/trocar (diálogo de compra) ou administrar no portal do Stripe.
 *
 * Todo o estado vem de GET /api/billing/summary, que por sua vez lê o espelho
 * local escrito pelo webhook. A UI nunca decide sozinha que alguém é assinante.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function PlanCard() {
  const summary = useBillingStore((s) => s.summary);
  const refresh = useBillingStore((s) => s.refresh);
  const [billingOpen, setBillingOpen] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  /**
   * Mesma regra do diálogo: nada de desenhar "Gratuito" e trocar pelo plano
   * real meio segundo depois. Até o resumo chegar, o card é um esqueleto.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (getBillingState().summary !== null) setReady(true);
    // Também no erro: melhor o fallback conhecido do que esqueleto eterno.
    void refresh().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  // Voltar de uma aba de checkout/portal deve refletir aqui na hora.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const openPortal = useCallback(async () => {
    if (portalPending) return;
    setPortalPending(true);
    const win = openCheckoutWindow();
    const result = await requestBillingPortal();
    setPortalPending(false);
    if (!result.ok) {
      win?.close();
      toast.error(checkoutErrorMessage(result.error));
      return;
    }
    // /profile nunca tem gravação viva: navegar é um fallback aceitável aqui.
    navigateCheckoutWindow(win, result.url);
  }, [portalPending]);

  const plan = summary?.plan ?? "free";
  const info = PLANS[plan];
  const active = isActiveStatus(summary?.status);
  const renewsAt = summary?.currentPeriodEnd ? new Date(summary.currentPeriodEnd) : null;

  return (
    <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7">
      <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
        Plano e créditos
      </h2>

      {!ready ? (
        <div aria-hidden className="flex flex-col gap-4">
          <div className="h-6 w-40 animate-pulse rounded-full bg-scriba-surface" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded-full bg-scriba-surface" />
          <div className="h-10 animate-pulse rounded-full bg-scriba-surface" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[18px] font-semibold text-scriba-ink-strong">{info.name}</span>
              <span className="text-[12px] font-light text-scriba-ink-soft">{info.tagline}</span>
            </div>
            {plan === "free" ? null : (
              <div className="flex shrink-0 flex-col items-end leading-tight">
                <span className="text-[15px] font-semibold tabular-nums text-scriba-ink-strong">
                  {formatBrl(info.priceCents)}
                </span>
                <span className="text-[11px] font-medium text-scriba-ink-mute">por mês</span>
              </div>
            )}
          </div>

          {active && renewsAt ? (
            <p className="flex items-center gap-2 text-[12px] font-light text-scriba-ink-soft">
              <CalendarClock aria-hidden className="size-3.5 shrink-0 text-scriba-ink-mute" />
              {summary?.cancelAtPeriodEnd ? (
                <>
                  Sua assinatura termina em{" "}
                  <strong className="font-semibold">{DATE_FMT.format(renewsAt)}</strong>. Os
                  créditos que você já tem continuam seus.
                </>
              ) : (
                <>
                  Próxima recarga de{" "}
                  <strong className="font-semibold">{formatCoins(info.coins)} créditos</strong> em{" "}
                  {DATE_FMT.format(renewsAt)}.
                </>
              )}
            </p>
          ) : (
            <p className="text-[12px] font-light leading-relaxed text-scriba-ink-soft">
              {plan === "free"
                ? "Assine para receber créditos todo mês — eles acumulam de um mês para o outro e não expiram."
                : "Sua assinatura não está ativa no momento. O saldo que você já tem continua disponível."}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setBillingOpen(true)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-scriba-blue px-5 py-2.5 text-[13px] font-semibold text-white outline-none transition-colors",
                "hover:bg-scriba-blue-hover focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
              )}
            >
              <CreditCard className="size-3.5" strokeWidth={2.2} />
              {plan === "estudioso" ? "Adicionar créditos" : "Ver planos e créditos"}
            </button>
            {active ? (
              <button
                type="button"
                disabled={portalPending}
                onClick={() => void openPortal()}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-scriba-hairline px-5 py-2.5 text-[13px] font-semibold text-scriba-ink outline-none transition-colors",
                  "hover:bg-scriba-surface focus-visible:ring-2 focus-visible:ring-ring/40",
                  "disabled:cursor-not-allowed disabled:opacity-70"
                )}
              >
                <Settings2 className="size-3.5" strokeWidth={2.2} />
                Gerenciar assinatura
              </button>
            ) : null}
          </div>
        </div>
      )}

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </section>
  );
}
