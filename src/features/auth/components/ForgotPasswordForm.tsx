"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { type RecoverState, requestPasswordReset } from "@/features/auth/actions";
import {
  AuthAlert,
  AuthNotice,
  Field,
  fieldClass,
  submitClass,
} from "@/features/auth/components/form-bits";

/**
 * "Esqueci minha senha": pede o e-mail e manda o link de recuperação.
 *
 * **A resposta é a mesma para todo endereço**, exista conta ou não, e a frase
 * na tela diz isso com todas as letras ("se houver uma conta"). Um formulário
 * que responde "não encontrei esse e-mail" é uma lista de quem usa o produto,
 * de graça, para quem quiser montá-la. Ver o cabeçalho da action.
 *
 * Serve também para quem entrou pelo Google e quer PASSAR a ter senha: a conta
 * já existe, e definir a senha por aqui não cria uma segunda.
 */
const initial: RecoverState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);
  const emailId = useId();

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-3">
        <AuthNotice title="Confira seu e-mail">
          Se houver uma conta com esse e-mail, o link para criar uma nova senha já está a caminho.
          Se não achar, olhe no spam.
        </AuthNotice>
        <Link
          href="/sign-in"
          className="text-center text-[12px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
        >
          Voltar para a entrada
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Field id={emailId} label="E-mail da conta">
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="voce@email.com"
            className={fieldClass}
          />
        </Field>
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Enviando…" : "Enviar o link"}
        </button>
      </form>

      {state.status === "invalid_input" ? (
        <AuthAlert>Confira o e-mail digitado e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "rate_limited" ? (
        <AuthAlert>Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.</AuthAlert>
      ) : null}

      <Link
        href="/sign-in"
        className="text-center text-[12px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
      >
        Voltar para a entrada
      </Link>
    </div>
  );
}
