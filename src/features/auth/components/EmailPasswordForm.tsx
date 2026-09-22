"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import {
  type ResendState,
  resendConfirmation,
  type SignInState,
  type SignUpState,
  signInWithPassword,
  signUpWithPassword,
} from "@/features/auth/actions";
import {
  AuthAlert,
  AuthNotice,
  Field,
  fieldClass,
  PasswordField,
  submitClass,
} from "@/features/auth/components/form-bits";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/lib/password";

/**
 * Entrar ou criar conta com e-mail e senha, o caminho que fica ABAIXO do botão
 * do Google na tela de entrada.
 *
 * **A ordem na tela é uma decisão, não um acaso.** O Google continua em cima e
 * sozinho, porque é um toque e não tem senha para esquecer; este formulário
 * atende quem não usa conta Google, quem não quer ligar as duas coisas e o
 * celular emprestado onde a conta Google é de outra pessoa. E ele começa
 * FECHADO, atrás de um botão, para que a tela continue oferecendo uma escolha
 * entre dois botões em vez de um botão e um cadastro.
 *
 * **Um componente, dois modos, dois formulários de verdade.** Entrar e criar
 * conta são duas server actions diferentes, com estados diferentes, então cada
 * modo é um componente com o seu próprio `useActionState`. Trocar o modo
 * DESMONTA um e monta o outro, e é por isso que o erro de um nunca sobrevive
 * para confundir o outro.
 *
 * O componente não fala com o Supabase. Quem cria a sessão é a server action,
 * no servidor, e o motivo está no cabeçalho de `features/auth/actions.ts`.
 */

type Props = {
  /** Para onde ir depois de entrar. Já sanitizado pela página. */
  next: string;
};

export function EmailPasswordForm({ next }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  // FECHADO por padrão, atrás de um botão, pela mesma razão do campo de código
  // de indicação: a maioria de quem chega aqui entra com o Google, e dois
  // campos à vista logo abaixo dele sugerem que é preciso preencher alguma
  // coisa. Quem quer senha diz que quer.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] border border-auth-btn-border bg-transparent px-[22px] py-[16px] text-[14px] font-medium text-scriba-ink-strong transition-colors font-[var(--font-poppins),system-ui,sans-serif] hover:border-auth-btn-border-hover hover:bg-auth-btn-bg-hover"
      >
        <Mail aria-hidden size={18} />
        <span>Entrar com e-mail e senha</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "sign-in" ? <SignInForm next={next} /> : <SignUpForm next={next} />}

      <p className="text-center text-[12px] font-light text-scriba-ink-mute">
        {mode === "sign-in" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="font-normal text-scriba-ink-soft underline underline-offset-2 transition-colors hover:text-scriba-ink-strong"
        >
          {mode === "sign-in" ? "Criar com e-mail" : "Entrar"}
        </button>
      </p>
    </div>
  );
}

const signInInitial: SignInState = { status: "idle" };

function SignInForm({ next }: Props) {
  const [state, formAction, pending] = useActionState(signInWithPassword, signInInitial);
  // O e-mail é CONTROLADO só para sobreviver ao erro. O React zera os campos
  // não controlados quando a action volta, e redigitar o endereço inteiro para
  // corrigir a senha é o atrito mais bobo possível de uma tela de login. A
  // senha continua sendo zerada, que é o comportamento esperado depois de uma
  // tentativa recusada.
  const [email, setEmail] = useState("");
  const emailId = useId();
  const passwordId = useId();

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <Field id={emailId} label="E-mail">
          <input
            id={emailId}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="voce@email.com"
            className={fieldClass}
          />
        </Field>
        <PasswordField id={passwordId} label="Senha" autoComplete="current-password" />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {state.status === "invalid_credentials" ? (
        <AuthAlert>E-mail ou senha incorretos. Se sua conta é do Google, entre por ele.</AuthAlert>
      ) : null}
      {state.status === "invalid_input" ? (
        <AuthAlert>Confira o e-mail digitado e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "account_disabled" ? (
        <AuthAlert>Esta conta está suspensa. Fale com a gente pela página de contato.</AuthAlert>
      ) : null}
      {state.status === "rate_limited" ? (
        <AuthAlert>Muitas tentativas. Aguarde alguns minutos e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "error" ? (
        <AuthAlert>Não consegui entrar agora. Tente de novo em instantes.</AuthAlert>
      ) : null}
      {state.status === "email_not_confirmed" && state.email ? (
        <ResendConfirmation email={state.email} next={next} />
      ) : null}

      <Link
        href="/recuperar"
        className="text-center text-[11.5px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft"
      >
        Esqueci minha senha
      </Link>
    </div>
  );
}

const signUpInitial: SignUpState = { status: "idle" };

function SignUpForm({ next }: Props) {
  const [state, formAction, pending] = useActionState(signUpWithPassword, signUpInitial);
  // Controlados pelo mesmo motivo do formulário de entrada: nome e e-mail
  // sobrevivem ao erro, a senha não.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  // A confirmação por e-mail está ligada no Supabase: a sessão só nasce quando
  // a pessoa clicar no link. Trocar o formulário por este aviso é o que impede
  // a tentativa de entrar logo em seguida, que só devolveria erro.
  if (state.status === "check_email") {
    return (
      <AuthNotice title="Confira seu e-mail">
        Mandei um link de confirmação para <strong className="font-medium">{state.email}</strong>.
        Abra e sua conta está pronta. Se não achar, olhe no spam.
      </AuthNotice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <Field id={nameId} label="Seu nome">
          <input
            id={nameId}
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            maxLength={80}
            placeholder="Como quer ser chamado"
            className={fieldClass}
          />
        </Field>
        <Field id={emailId} label="E-mail">
          <input
            id={emailId}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="voce@email.com"
            className={fieldClass}
          />
        </Field>
        <PasswordField
          id={passwordId}
          label="Senha"
          autoComplete="new-password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Criando…" : "Criar conta"}
        </button>
      </form>

      {state.status === "weak_password" ? (
        <AuthAlert>Senha muito curta. Use pelo menos {MIN_PASSWORD_LENGTH} caracteres.</AuthAlert>
      ) : null}
      {state.status === "email_taken" ? (
        <AuthAlert>
          Já existe uma conta com esse e-mail. Entre por ela ou recupere a senha.
        </AuthAlert>
      ) : null}
      {state.status === "invalid_input" ? (
        <AuthAlert>Confira os dados digitados e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "rate_limited" ? (
        <AuthAlert>Muitas tentativas. Aguarde alguns minutos e tente de novo.</AuthAlert>
      ) : null}
      {state.status === "error" ? (
        <AuthAlert>Não consegui criar a conta agora. Tente de novo em instantes.</AuthAlert>
      ) : null}
    </div>
  );
}

const resendInitial: ResendState = { status: "idle" };

/**
 * O beco sem saída de quem criou a conta e nunca clicou no link: sem isto,
 * "confirme seu e-mail" é uma parede, e o caminho natural passa a ser tentar
 * criar outra conta com o mesmo endereço.
 */
function ResendConfirmation({ email, next }: { email: string; next: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, resendInitial);

  if (state.status === "sent") {
    return (
      <AuthNotice title="Link reenviado">
        Mandei outro link de confirmação para {email}. Se não achar, olhe no spam.
      </AuthNotice>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AuthAlert>
        Sua conta existe, mas o e-mail ainda não foi confirmado. Abra o link que enviamos.
      </AuthAlert>
      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          disabled={pending}
          className="text-[11.5px] font-light text-scriba-ink-mute underline underline-offset-2 transition-colors hover:text-scriba-ink-soft disabled:opacity-60"
        >
          {pending ? "Reenviando…" : "Reenviar o e-mail de confirmação"}
        </button>
      </form>
      {state.status === "rate_limited" ? (
        <p className="text-[11.5px] text-scriba-ink-mute">
          Já mandei alguns nos últimos minutos. Aguarde um pouco antes de pedir outro.
        </p>
      ) : null}
    </div>
  );
}
