"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { checkoutErrorMessage, requestCheckout } from "@/features/billing/lib/api";
import { formatBrl, formatCoins, type PaidPlanKey, PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Ponte entre "escolhi um plano na landing page" e o Checkout do Stripe.
 *
 * Existe porque a intenção precisa sobreviver ao login: um visitante clica em
 * "Assinar Pessoal" sem ter conta, passa pelo Google, e tem de voltar
 * exatamente para onde parou. O caminho é
 * `/sign-in?next=/billing/assinar?plan=pessoal` — o `next` já era suportado
 * pelo fluxo de auth; esta página é o destino que faltava.
 *
 * A chave do plano viaja pela URL, e isso é seguro: ela só ENDEREÇA. Quem
 * resolve preço e moedas é o servidor, a partir do catálogo server-only
 * (`lib/billing/catalog.ts`). Trocar `?plan=` na barra de endereço muda qual
 * plano é oferecido, nunca quanto ele custa nem quanto credita.
 *
 * Aqui a navegação é na MESMA aba — ao contrário do diálogo de créditos, que
 * abre em aba nova para não matar uma gravação em curso. Nesta página não há
 * nada para preservar: ela existe só para repassar o usuário ao Stripe.
 */
export function StartSubscription({ plan }: { plan: PaidPlanKey }) {
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);
  const info = PLANS[plan];

  useEffect(() => {
    // Guarda contra o double-invoke do strict mode: duas sessões de checkout
    // criadas para o mesmo clique confundiriam o usuário (e o dashboard).
    if (firedRef.current) return;
    firedRef.current = true;

    // Sem flag de "cancelled" aqui, e isso é deliberado. Com ela, o
    // desmonta-remonta do strict mode em dev deixava a página travada no
    // spinner para sempre: o cleanup marcava cancelled, a segunda execução
    // saía cedo pelo firedRef, e a resposta da primeira era descartada — nem
    // redirect, nem erro. Como o firedRef já garante uma única requisição,
    // a resposta dela sempre deve ser aplicada. Um setState depois de
    // desmontar é no-op no React 18+, e o redirect é o que queremos de toda
    // forma.
    void (async () => {
      const result = await requestCheckout({ kind: "subscription", plan });
      if (!result.ok) {
        setError(checkoutErrorMessage(result.error));
        return;
      }
      window.location.href = result.url;
    })();
  }, [plan]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          error ? "bg-scriba-rose text-scriba-rose-accent" : "bg-scriba-blue-soft text-scriba-blue"
        )}
      >
        {error ? (
          <CircleAlert className="size-7" strokeWidth={2.2} />
        ) : (
          <Loader2 className="size-7 animate-spin" strokeWidth={2.2} />
        )}
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold text-scriba-ink-strong">
          {error ? "Não consegui abrir o pagamento" : `Preparando o plano ${info.name}`}
        </h1>
        <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
          {error ??
            `${formatBrl(info.priceCents)} por mês · ${formatCoins(info.coins)} créditos todo mês. Estamos levando você ao pagamento seguro do Stripe.`}
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          <Link
            href="/profile"
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-scriba-blue px-6 py-3 text-sm font-semibold text-white outline-none transition-colors",
              "hover:bg-scriba-blue-hover focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            Ver planos no perfil
          </Link>
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
      ) : null}
    </main>
  );
}
