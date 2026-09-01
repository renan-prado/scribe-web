"use client";

import { CircleCheck, CircleSlash, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBillingStore } from "@/features/billing/store";
import { useCoinsStore } from "@/features/coins/store";
import { formatCoins } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Tela de retorno do Stripe Checkout.
 *
 * O crédito é assíncrono: o Stripe redireciona o navegador no mesmo instante
 * em que dispara o webhook, então o saldo pode levar alguns segundos para
 * subir. Em vez de mentir ("créditos adicionados!") ou de deixar o usuário no
 * escuro, esta tela faz polling curto do saldo e só troca o discurso quando o
 * número de fato mudou — o que também serve de prova, para o usuário, de que
 * o crédito veio do servidor e não da URL.
 *
 * Se o webhook demorar mais que a janela de polling, mostramos uma mensagem
 * honesta de "está a caminho" em vez de um erro: o crédito vai entrar quando o
 * evento for processado, com ou sem esta aba aberta.
 */

const POLL_MS = 2_000;
const MAX_POLLS = 15; // ~30s

/**
 * Os quatro estados possíveis desta tela. Existem como um valor só — e não
 * como ternários espalhados — porque a versão anterior calculava o texto e o
 * ícone separadamente e eles saíram do ar: a tela dizia "Pagamento recebido"
 * com o spinner ainda girando embaixo, ou seja, anunciava sucesso e desenhava
 * espera. Com um `stage` único, ícone e copy não têm como divergir.
 *
 *  pending  — polling em andamento, saldo ainda não mudou
 *  credited — vimos o saldo subir: melhor desfecho possível
 *  received — o polling expirou sem ver o crédito. O pagamento existe e o
 *             webhook vai processá-lo com ou sem esta aba aberta; não é erro,
 *             então também é sucesso — só sem o número para mostrar
 *  canceled — o usuário desistiu no Stripe
 */
type Stage = "pending" | "credited" | "received" | "canceled";

const VISUAL: Record<Stage, { Icon: typeof CircleCheck; spin: boolean; tone: string }> = {
  // Verde = "deu certo". O dourado do `credited` é deliberado e não uma
  // inconsistência: ali a mensagem é sobre MOEDAS, e o dourado é o colorway
  // das moedas em todo o app.
  received: { Icon: CircleCheck, spin: false, tone: "bg-scriba-green-soft text-scriba-green-ink" },
  credited: { Icon: CircleCheck, spin: false, tone: "bg-scriba-gold-soft text-scriba-gold-ink" },
  pending: { Icon: Loader2, spin: true, tone: "bg-scriba-blue-soft text-scriba-blue-ink" },
  canceled: { Icon: CircleSlash, spin: false, tone: "bg-scriba-rose text-scriba-rose-accent" },
};

export function CheckoutReturn({
  canceled,
  kind,
  sessionId,
}: {
  canceled: boolean;
  kind: "subscription" | "topup";
  /** `cs_...` devolvido pelo Stripe no redirect. Endereça a reconciliação. */
  sessionId: string | null;
}) {
  const balance = useCoinsStore((s) => s.balance);
  const refreshBalance = useCoinsStore((s) => s.refresh);
  const setBalanceInStore = useCoinsStore((s) => s.setBalance);
  const refreshSummary = useBillingStore((s) => s.refresh);

  /** Saldo observado ao abrir a tela — a referência para detectar o crédito. */
  const baselineRef = useRef<number | null>(null);
  const [credited, setCredited] = useState<number | null>(null);
  const [settled, setSettled] = useState(canceled);

  const openerRefresh = useCallback(() => {
    // A aba que abriu o checkout (a da gravação, tipicamente) também precisa
    // saber. Ela já ressincroniza no `focus`, mas isto encurta a espera de quem
    // deixa as duas abas visíveis.
    try {
      window.opener?.postMessage({ type: "scriba:coins-updated" }, window.location.origin);
    } catch {
      // cross-origin ou sem opener — o refresh no focus cobre.
    }
  }, []);

  useEffect(() => {
    if (canceled) return;
    let polls = 0;
    let cancelledEffect = false;

    const tick = async () => {
      if (cancelledEffect) return;
      const next = await refreshBalance();
      void refreshSummary();
      if (cancelledEffect || next === null) return;

      if (baselineRef.current === null) {
        baselineRef.current = next;
        return;
      }
      if (next > baselineRef.current) {
        setCredited(next - baselineRef.current);
        setSettled(true);
        openerRefresh();
      }
    };

    /**
     * Antes de ficar esperando o webhook, PERGUNTAMOS. A reconciliação
     * confirma a sessão direto com o Stripe e credita se o webhook não tiver
     * creditado — é o que impede "paguei e não recebi" quando a entrega do
     * evento falha. Quando o webhook funciona normalmente, esta chamada volta
     * com `credited: 0` e o polling segue como antes.
     */
    const reconcile = async () => {
      if (!sessionId) return;
      try {
        const res = await fetch("/api/billing/reconcile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { credited?: number; balance?: number };
        if (cancelledEffect) return;
        if (typeof body.balance === "number") setBalanceInStore(body.balance);
        if (typeof body.credited === "number" && body.credited > 0) {
          // A baseline pode ainda nem ter sido lida; o valor creditado veio do
          // servidor, então é ele que mostramos.
          setCredited(body.credited);
          setSettled(true);
          openerRefresh();
        }
      } catch {
        // Sem drama: o polling abaixo continua sendo a segunda tentativa.
      }
    };

    void reconcile();
    void tick();
    const id = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(id);
        setSettled(true);
        return;
      }
      void tick();
    }, POLL_MS);

    return () => {
      cancelledEffect = true;
      clearInterval(id);
    };
  }, [canceled, sessionId, refreshBalance, refreshSummary, openerRefresh, setBalanceInStore]);

  const stage: Stage = canceled
    ? "canceled"
    : credited !== null
      ? "credited"
      : settled
        ? "received"
        : "pending";

  const heading = canceled
    ? "Pagamento cancelado"
    : credited !== null
      ? "Créditos adicionados!"
      : settled
        ? "Pagamento recebido"
        : "Confirmando o pagamento…";

  const body = canceled
    ? "Nada foi cobrado. Você pode voltar e tentar de novo quando quiser."
    : credited !== null
      ? `${formatCoins(credited)} créditos entraram na sua conta. Saldo atual: ${formatCoins(balance ?? 0)}.`
      : settled
        ? "Seu pagamento foi registrado e os créditos entram assim que a confirmação chegar — em geral, poucos segundos. Pode fechar esta aba."
        : kind === "subscription"
          ? "Estamos ativando sua assinatura. Isso leva alguns segundos."
          : "Estamos confirmando a compra. Isso leva alguns segundos.";

  const { Icon, spin, tone } = VISUAL[stage];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className={cn("flex size-16 items-center justify-center rounded-full", tone)}>
        <Icon className={cn("size-7", spin && "animate-spin")} strokeWidth={2.2} />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold text-scriba-ink-strong">{heading}</h1>
        <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
          {body}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => window.close()}
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-scriba-blue px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,168,240,0.32)] outline-none transition-colors",
            "hover:bg-scriba-blue-hover focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
          )}
        >
          Fechar esta aba
        </button>
        <Link
          href="/feed"
          className={cn(
            "inline-flex items-center justify-center rounded-full border border-scriba-hairline bg-scriba-paper px-6 py-3 text-sm font-semibold text-scriba-ink outline-none transition-colors",
            "hover:bg-scriba-blue-soft/40 focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          Ir para o Scriba
        </Link>
      </div>

      <p className="text-[11px] font-light text-scriba-ink-mute">
        Se você estava gravando, aquela aba continua aberta e a gravação intacta.
      </p>
    </main>
  );
}
