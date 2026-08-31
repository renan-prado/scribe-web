"use client";

import {
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  checkoutErrorMessage,
  navigateCheckoutWindow,
  openCheckoutWindow,
  requestBillingPortal,
  requestCheckout,
} from "@/features/billing/lib/api";
import { getBillingState, useBillingStore } from "@/features/billing/store";
import { getCoinsState, useCoinsStore } from "@/features/coins/store";
import { useSessionStore } from "@/features/session/store";
import {
  formatBrl,
  formatCoins,
  isActiveStatus,
  isUpgradeFrom,
  type PaidPlanKey,
  PLANS,
  TOPUP,
  TOPUP_MAX_QUANTITY,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Diálogo de créditos: saldo, planos de assinatura e, por último, o pacote
 * avulso. Aberto pelo chip de moedas do header, pelo /profile e pelo overlay
 * de saldo esgotado no meio de uma gravação.
 *
 * A ordem é intencional: a assinatura é a oferta principal e ocupa o corpo do
 * diálogo; a compra única fica recolhida atrás de um link discreto, para não
 * competir com os planos. Ela só aparece aberta quando não há plano nenhum a
 * oferecer (usuário já no topo) — aí é a única compra possível.
 *
 * O checkout SEMPRE abre em aba nova (ver `openCheckoutWindow`) — enquanto
 * uma gravação está em curso, sair desta página destruiria o MediaRecorder e
 * o transcript ainda não salvo. Quando o usuário volta para cá, o `focus` da
 * janela dispara um refresh do saldo, então o número no header se atualiza
 * sozinho sem precisar recarregar nada.
 *
 * Nenhum preço daqui é enviado ao servidor: os botões mandam só a chave do
 * plano ou a quantidade de pacotes. Ver `lib/billing/plans.ts`.
 */

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Conteúdo do gatilho. O próprio `DialogTrigger` já é o <button>, então
   * passe só o visual aqui — embrulhar num botão próprio aninharia dois
   * botões e quebraria o HTML.
   */
  trigger?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Aviso opcional no topo — usado pelo overlay de "créditos acabaram". */
  notice?: ReactNode;
};

export function BillingDialog({
  open,
  onOpenChange,
  trigger,
  triggerClassName,
  triggerLabel,
  notice,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const balance = useCoinsStore((s) => s.balance);
  const refreshBalance = useCoinsStore((s) => s.refresh);
  const summary = useBillingStore((s) => s.summary);
  const refreshSummary = useBillingStore((s) => s.refresh);

  const [quantity, setQuantity] = useState(1);
  /**
   * O pacote avulso fica recolhido: a assinatura é o caminho principal e a
   * compra única só aparece para quem procura por ela. Quando não há plano
   * nenhum para oferecer (usuário já no topo), abre direto — senão o diálogo
   * não ofereceria nada.
   */
  const [topupOpen, setTopupOpen] = useState(false);
  /**
   * Só montamos as opções de compra com plano e saldo já em mãos. Sem isso a
   * tela abria assumindo "free", desenhava os dois planos e depois removia o
   * que o usuário já assina — conteúdo trocando na frente de quem lê.
   */
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<null | "topup" | PaidPlanKey | "portal">(null);

  /**
   * Com uma gravação viva na página, navegar esta aba destruiria o
   * MediaRecorder e a fila de chunks. Se o pop-up for bloqueado, é melhor
   * pedir para liberar do que "resolver" navegando.
   */
  const recordingLive = useSessionStore((st) => st.running);

  const plan = summary?.plan ?? "free";
  const subscribed = isActiveStatus(summary?.status);
  const billingReady = summary?.configured !== false;

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    // Com dados de uma abertura anterior em cache, revalida em segundo plano
    // sem esconder o que já está correto na tela.
    if (getBillingState().summary !== null && getCoinsState().balance !== null) setReady(true);
    void Promise.all([refreshSummary(), refreshBalance()]).finally(() => {
      // Também no erro: melhor cair no fallback conhecido do que deixar o
      // usuário preso num esqueleto que nunca sai.
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [isOpen, refreshSummary, refreshBalance]);

  // Reabrir o diálogo volta ao estado recolhido.
  useEffect(() => {
    if (!isOpen) setTopupOpen(false);
  }, [isOpen]);

  // O pagamento acontece noutra aba. Quando esta volta ao foco, ressincroniza
  // saldo e plano — é o que faz o número subir "sozinho" depois da compra.
  useEffect(() => {
    if (!isOpen) return;
    const onFocus = () => {
      void refreshBalance();
      void refreshSummary();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isOpen, refreshBalance, refreshSummary]);

  const startCheckout = useCallback(
    async (payload: Parameters<typeof requestCheckout>[0], key: "topup" | PaidPlanKey) => {
      if (pending) return;
      setPending(key);
      // Abrir a janela DENTRO do gesto do clique — depois do await o navegador
      // já não considera isso uma ação do usuário e bloqueia o popup.
      const win = openCheckoutWindow();
      const result = await requestCheckout(payload);
      setPending(null);
      if (!result.ok) {
        win?.close();
        toast.error(checkoutErrorMessage(result.error));
        return;
      }
      const outcome = navigateCheckoutWindow(win, result.url, !recordingLive);
      if (outcome === "blocked") {
        toast.error("Seu navegador bloqueou a janela de pagamento.", {
          description:
            "Libere pop-ups para este site e tente de novo — não podemos sair desta página sem interromper a gravação.",
        });
        return;
      }
      if (outcome === "new-tab") {
        toast.info("Abrimos o pagamento numa nova aba.", {
          description: "Seus créditos aparecem aqui assim que a compra for confirmada.",
        });
      }
    },
    [pending, recordingLive]
  );

  const openPortal = useCallback(async () => {
    if (pending) return;
    setPending("portal");
    const win = openCheckoutWindow();
    const result = await requestBillingPortal();
    setPending(null);
    if (!result.ok) {
      win?.close();
      toast.error(checkoutErrorMessage(result.error));
      return;
    }
    const outcome = navigateCheckoutWindow(win, result.url, !recordingLive);
    if (outcome === "blocked") {
      toast.error("Seu navegador bloqueou a janela do portal.", {
        description: "Libere pop-ups para este site e tente de novo.",
      });
    }
  }, [pending, recordingLive]);

  const upgradeTargets = (["pessoal", "estudioso"] as PaidPlanKey[]).filter((p) =>
    isUpgradeFrom(plan, p)
  );

  // Sem plano nenhum para oferecer (usuário já no topo), o avulso é a única
  // compra possível — recolhê-lo deixaria o diálogo sem ação.
  const topupExpanded = topupOpen || upgradeTargets.length === 0;

  const totalCoins = TOPUP.coins * quantity;
  const totalCents = TOPUP.priceCents * quantity;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger aria-label={triggerLabel} className={triggerClassName}>
          {trigger}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-[28px] bg-scriba-paper p-0 sm:max-w-md">
        <div className="flex flex-col gap-5 px-6 pt-8 pb-7">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-scriba-gold-soft">
              <span aria-hidden className="coin-hex block h-4.5 w-4 bg-scriba-yellow" />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-heading text-lg font-semibold text-scriba-ink-strong">
                Seus créditos
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-scriba-ink-soft">
                {!ready || balance === null ? (
                  "Carregando seu plano e seu saldo…"
                ) : (
                  <>
                    Você tem{" "}
                    <strong className="font-semibold text-scriba-ink">
                      {formatCoins(balance)} créditos
                    </strong>{" "}
                    no plano <strong className="font-semibold">{PLANS[plan].name}</strong>.
                  </>
                )}
              </DialogDescription>
            </div>
          </header>

          {notice ? (
            <div
              role="status"
              className="rounded-2xl border border-scriba-cream-accent/40 bg-scriba-cream px-4 py-3 text-[13px] leading-relaxed text-scriba-cream-ink"
            >
              {notice}
            </div>
          ) : null}

          {!ready ? (
            <BillingSkeleton />
          ) : !billingReady ? (
            <p className="rounded-2xl border border-scriba-hairline bg-scriba-surface px-4 py-3 text-center text-[13px] text-scriba-ink-soft">
              A compra de créditos ainda não está ativa nesta instalação.
            </p>
          ) : (
            <>
              {/* ---- upgrade ---- */}
              {upgradeTargets.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
                    {plan === "free" ? "Assine e receba todo mês" : "Suba de plano"}
                  </h3>
                  {upgradeTargets.map((key) => {
                    const p = PLANS[key];
                    return (
                      <article
                        key={key}
                        className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline bg-scriba-paper p-4 transition-colors hover:border-scriba-blue/45"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[15px] font-semibold text-scriba-ink">
                              {p.name}
                            </span>
                            <span className="text-[12px] font-light text-scriba-ink-soft">
                              {p.tagline}
                            </span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end leading-tight">
                            <span className="text-[15px] font-semibold tabular-nums text-scriba-ink-strong">
                              {formatBrl(p.priceCents)}
                            </span>
                            <span className="text-[11px] font-medium text-scriba-ink-mute">
                              por mês
                            </span>
                          </div>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {p.highlights.map((h) => (
                            <li
                              key={h}
                              className="flex items-start gap-2 text-[12px] font-light leading-snug text-scriba-ink-soft"
                            >
                              <Check
                                aria-hidden
                                className="mt-0.5 size-3.5 shrink-0 text-scriba-blue"
                                strokeWidth={3}
                              />
                              {h}
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() =>
                            void startCheckout({ kind: "subscription", plan: key }, key)
                          }
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-2 rounded-full border border-scriba-blue px-5 py-2.5 text-[13px] font-semibold text-scriba-blue outline-none transition-colors",
                            "hover:bg-scriba-blue-soft/60 focus-visible:ring-4 focus-visible:ring-scriba-blue/25",
                            "disabled:cursor-not-allowed disabled:opacity-70"
                          )}
                        >
                          {pending === key ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="size-3.5" strokeWidth={2.4} />
                          )}
                          {pending === key
                            ? "Abrindo…"
                            : `Assinar ${p.name} · ${formatCoins(p.coins)} créditos/mês`}
                        </button>
                      </article>
                    );
                  })}
                </section>
              ) : null}

              {/* ---- pacote avulso (sempre por último: é o caminho secundário) ---- */}
              <section className="flex flex-col gap-3">
                {topupExpanded ? null : (
                  <button
                    type="button"
                    aria-expanded={false}
                    onClick={() => setTopupOpen(true)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 self-center rounded-full px-3 py-1.5 text-[12px] font-medium text-scriba-ink-soft outline-none transition-colors",
                      "hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                  >
                    Prefiro adicionar créditos avulsos
                    <ChevronDown className="size-3.5" strokeWidth={2.4} />
                  </button>
                )}

                {topupExpanded ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline bg-scriba-surface/60 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[14px] font-semibold text-scriba-ink">
                        Adicionar créditos agora
                      </h3>
                      <span className="text-[11px] font-medium text-scriba-ink-mute">
                        {formatCoins(TOPUP.coins)} por {formatBrl(TOPUP.priceCents)}
                      </span>
                    </div>
                    <p className="text-[12px] font-light leading-relaxed text-scriba-ink-soft">
                      Compra única, sem assinatura. Os créditos entram na conta e não expiram.
                    </p>

                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-1 rounded-full border border-scriba-hairline bg-scriba-paper p-1">
                        <StepButton
                          label="Menos um pacote"
                          disabled={quantity <= 1 || pending !== null}
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        >
                          <Minus className="size-3.5" strokeWidth={2.6} />
                        </StepButton>
                        <span className="min-w-8 text-center text-[14px] font-semibold tabular-nums text-scriba-ink">
                          {quantity}
                        </span>
                        <StepButton
                          label="Mais um pacote"
                          disabled={quantity >= TOPUP_MAX_QUANTITY || pending !== null}
                          onClick={() => setQuantity((q) => Math.min(TOPUP_MAX_QUANTITY, q + 1))}
                        >
                          <Plus className="size-3.5" strokeWidth={2.6} />
                        </StepButton>
                      </div>
                      <div className="flex flex-col items-end leading-tight">
                        <span className="inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums text-scriba-ink-strong">
                          <span aria-hidden className="coin-hex block h-3 w-2.5 bg-scriba-yellow" />
                          {formatCoins(totalCoins)}
                        </span>
                        <span className="text-[11px] font-medium text-scriba-ink-mute">
                          {formatBrl(totalCents)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => void startCheckout({ kind: "topup", quantity }, "topup")}
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-2 rounded-full bg-scriba-blue px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(79,168,240,0.32)] outline-none transition-colors",
                        "hover:bg-scriba-blue-hover focus-visible:ring-4 focus-visible:ring-scriba-blue/30",
                        "disabled:cursor-not-allowed disabled:opacity-70"
                      )}
                    >
                      {pending === "topup" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CreditCard className="size-4" strokeWidth={2.2} />
                      )}
                      {pending === "topup"
                        ? "Abrindo…"
                        : `Comprar ${formatCoins(totalCoins)} créditos`}
                    </button>
                  </div>
                ) : null}
              </section>
              {/* ---- gestão da assinatura ---- */}
              {subscribed ? (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void openPortal()}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full border border-scriba-hairline px-5 py-2.5 text-[13px] font-semibold text-scriba-ink outline-none transition-colors",
                    "hover:bg-scriba-surface focus-visible:ring-2 focus-visible:ring-ring/40",
                    "disabled:cursor-not-allowed disabled:opacity-70"
                  )}
                >
                  {pending === "portal" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Settings2 className="size-3.5" strokeWidth={2.2} />
                  )}
                  Gerenciar assinatura
                </button>
              ) : null}

              <p className="text-center text-[11px] font-light leading-relaxed text-scriba-ink-mute">
                Pagamento processado pela Stripe. O Scriba não armazena dados do seu cartão.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Esqueleto com a silhueta de dois cards de plano — o pior caso do que vem
 * depois. Reservar o espaço maior evita que o diálogo pule de altura quando o
 * conteúdo real entra.
 */
function BillingSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="h-3 w-36 animate-pulse rounded-full bg-scriba-surface" />
      <div className="h-48 animate-pulse rounded-2xl bg-scriba-surface" />
      <div className="h-48 animate-pulse rounded-2xl bg-scriba-surface" />
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-scriba-ink outline-none transition-colors",
        "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-35"
      )}
    >
      {children}
    </button>
  );
}
