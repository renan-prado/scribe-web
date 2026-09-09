"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CoinMark } from "@/components/icons/CoinMark";
import { REFERRAL_SIGNUP_COINS, REFERRAL_SUBSCRIPTION_COINS } from "@/lib/referrals/economics";
import { cn } from "@/lib/utils";

/**
 * O lembrete de indicação, no formato de card do feed.
 *
 * Mora no `/feed` e só nele, pela mesma razão do `InstallAppCard`: é a primeira
 * tela de toda sessão de uso, e a única em que a pessoa está olhando em volta
 * em vez de tentando terminar alguma coisa. Um convite desses no meio de uma
 * gravação seria interrupção.
 *
 * ## "De tempos em tempos" é uma soneca, não um sorteio
 *
 * Dispensar não some para sempre nem volta na próxima visita: guarda uma data
 * no `localStorage` e o card reaparece depois dela. Duas semanas quando a
 * pessoa fecha o card, um mês quando ela ACEITA e vai para `/indicar` — quem
 * acabou de mandar o link para os amigos não precisa ser lembrado na semana
 * seguinte.
 *
 * Sorteio (mostrar em 1 de cada N carregamentos) foi descartado: dois
 * carregamentos seguidos podem cair no mesmo lado da moeda, e o resultado é
 * ou um convite que persegue, ou um que a pessoa nunca vê. Data é previsível
 * e explicável.
 *
 * ## Ele começa ESCONDIDO
 *
 * O oposto do `InstallAppCard`, e de propósito: aquele não persiste nada, então
 * não tem o que consultar; este tem. Renderizar visível e sumir depois que o
 * efeito lê o `localStorage` produziria exatamente a piscada que o comentário
 * daquele arquivo evita — um card aparecendo e se retirando na cara de quem
 * pediu para não vê-lo. Esperar um quadro é mais barato.
 *
 * `localStorage` indisponível (janela anônima, cookies bloqueados, iOS em modo
 * restrito) é tratado como "nunca dispensou": o card aparece e o X funciona só
 * para esta visita. Degradar para "aparece sempre" é melhor que degradar para
 * "nunca aparece".
 */

const SNOOZE_KEY = "scriba:invite-snooze";
const DAY = 24 * 60 * 60 * 1000;
const DISMISS_DAYS = 14;
const ACCEPT_DAYS = 30;

function snoozedUntil(): number {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function snooze(days: number): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * DAY));
  } catch {
    // Sem storage não há soneca persistente. O estado local abaixo ainda
    // esconde o card nesta visita, que é o que a pessoa pediu ao clicar.
  }
}

export function InviteFriendCard({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Date.now() >= snoozedUntil()) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[24px] bg-scriba-paper px-4 py-5 ring-1 ring-scriba-hairline sm:px-5",
        className
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 flex-none items-center justify-center rounded-2xl bg-scriba-cream">
          <CoinMark size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-scriba-ink-strong">
            Conhece alguém que ia gostar do Scriba?
          </span>
          <span className="text-xs leading-relaxed text-scriba-ink-soft">
            Você ganha {REFERRAL_SIGNUP_COINS} moedas quando um amigo cria a conta pelo seu link, e
            mais {REFERRAL_SUBSCRIPTION_COINS} se ele assinar.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            snooze(DISMISS_DAYS);
            setVisible(false);
          }}
          aria-label="Dispensar o convite de indicação"
          className="-mt-1 -mr-1 inline-flex size-7 flex-none items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-btn-muted hover:text-scriba-ink-strong focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Link
        href="/indicar"
        onClick={() => snooze(ACCEPT_DAYS)}
        className="scriba-cta inline-flex h-10 w-full items-center justify-center rounded-full bg-[image:var(--scriba-cta)] text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink transition-[filter]"
      >
        Pegar meu link
      </Link>
    </div>
  );
}
