"use client";

import { useActionState, useState } from "react";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  applyReferralCode,
  clearReferralCode,
  type ReferralActionState,
} from "@/lib/partners/actions";

/**
 * Campo de código de indicação da tela de entrada.
 *
 * Fica FECHADO por padrão, atrás de um link discreto. A esmagadora maioria de
 * quem chega aqui não tem código nenhum, e um campo vazio à vista sugere que
 * falta alguma coisa para entrar — atrito exatamente no passo que menos pode
 * ter atrito.
 *
 * O componente não lê nem escreve cookie: o valor é gravado por uma server
 * action (`applyReferralCode`), que valida o código antes de aceitar. Este
 * arquivo cuida só do estado do formulário. Ver lib/partners/cookies.ts.
 */

type Props = {
  /** Indicação já ativa, vinda do cookie e resolvida no servidor. */
  active: { partnerName: string; bonusCoins: number } | null;
};

const initialState: ReferralActionState = { status: "idle" };

export function ReferralField({ active }: Props) {
  const [state, formAction, pending] = useActionState(applyReferralCode, initialState);
  const [open, setOpen] = useState(false);

  // Depois de um envio bem-sucedido, o servidor revalida a página e `active`
  // chega preenchido. Até lá, o retorno da própria action já serve — assim a
  // confirmação aparece na hora, sem esperar o refresh.
  const confirmed =
    active ??
    (state.status === "ok" && state.partnerName
      ? { partnerName: state.partnerName, bonusCoins: state.bonusCoins ?? 0 }
      : null);

  if (confirmed) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl bg-scriba-cream px-4 py-3 text-left">
        <CoinMark size={18} className="mt-px flex-none" />
        <div className="flex flex-col gap-1">
          <p className="text-[12.5px] leading-[1.5] text-scriba-cream-body">
            Indicado por <strong className="font-medium">{confirmed.partnerName}</strong>.
            {confirmed.bonusCoins > 0 ? (
              <>
                {" "}
                Você ganha <strong className="font-medium">+{confirmed.bonusCoins} moedas</strong>{" "}
                ao criar sua conta.
              </>
            ) : null}
          </p>
          <form action={clearReferralCode}>
            <button
              type="submit"
              className="text-[11.5px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
            >
              Não fui indicado por essa pessoa
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-center text-[11.5px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
      >
        Tenho um código de indicação
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="referral-code" className="text-[11.5px] font-light text-scriba-ink-soft">
        Código de indicação
      </label>
      <div className="flex gap-2">
        <input
          id="referral-code"
          name="code"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ex.: joao"
          aria-describedby={state.status === "idle" ? undefined : "referral-code-status"}
          className="min-w-0 flex-1 rounded-2xl border border-scriba-hairline bg-background px-4 py-2.5 text-[13px] text-scriba-ink-strong placeholder:text-scriba-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="scriba-cta flex-none rounded-2xl bg-[image:var(--scriba-cta)] px-4 py-2.5 text-[13px] font-medium text-scriba-cta-ink transition-[filter] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "…" : "Aplicar"}
        </button>
      </div>
      {state.status === "invalid" ? (
        <p id="referral-code-status" role="alert" className="text-[11.5px] text-scriba-rose-ink">
          Código não encontrado. Confira com quem te indicou.
        </p>
      ) : null}
      {state.status === "rate_limited" ? (
        <p id="referral-code-status" role="alert" className="text-[11.5px] text-scriba-rose-ink">
          Muitas tentativas. Aguarde alguns minutos.
        </p>
      ) : null}
    </form>
  );
}
