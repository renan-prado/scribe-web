"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { type NewPasswordState, updatePassword } from "@/features/auth/actions";
import { AuthAlert, PasswordField, submitClass } from "@/features/auth/components/form-bits";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/lib/password";

/**
 * Definir a nova senha, na sessão que o link de recuperação acabou de criar.
 *
 * Não há campo de senha ANTIGA, e não é esquecimento: quem chega aqui chegou
 * por um link enviado ao e-mail da conta, que é a prova de posse. Pedir a
 * antiga tornaria a recuperação impossível exatamente para quem a esqueceu.
 *
 * Também é por aqui que quem entrou pelo Google ganha uma senha, se quiser
 * passar a ter as duas portas.
 */
const initial: NewPasswordState = { status: "idle" };

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initial);
  const passwordId = useId();

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <PasswordField
          id={passwordId}
          label="Nova senha"
          autoComplete="new-password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Salvando…" : "Salvar a nova senha"}
        </button>
      </form>

      {state.status === "weak_password" ? (
        <AuthAlert>Senha muito curta. Use pelo menos {MIN_PASSWORD_LENGTH} caracteres.</AuthAlert>
      ) : null}
      {state.status === "same_password" ? (
        <AuthAlert>Essa já é a sua senha atual. Escolha uma diferente.</AuthAlert>
      ) : null}
      {state.status === "invalid_input" ? (
        <AuthAlert>Confira a senha digitada e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "unauthenticated" ? (
        <div className="flex flex-col gap-2">
          <AuthAlert>
            Este link expirou ou já foi usado. Peça outro na página de recuperação.
          </AuthAlert>
          <Link
            href="/forgot-password"
            className="text-center text-[12px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
          >
            Pedir um novo link
          </Link>
        </div>
      ) : null}
      {state.status === "error" ? (
        <AuthAlert>Não consegui salvar agora. Tente de novo em instantes.</AuthAlert>
      ) : null}
    </div>
  );
}
