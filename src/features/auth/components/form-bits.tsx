"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * As peças repetidas dos três formulários de senha (entrar/criar, recuperar e
 * definir a nova). Elas moram aqui porque são as MESMAS em todos, e um campo
 * de e-mail com raio de borda diferente em cada tela é o tipo de coisa que
 * ninguém decide, apenas acontece.
 *
 * Não são componentes de `shared/ui`: eles são o vocabulário do app inteiro, e
 * estas peças só fazem sentido dentro da moldura clara da tela de entrada
 * (`AuthShell`), que tem tipografia e escala próprias.
 */

export const fieldClass =
  "w-full min-w-0 rounded-2xl border border-scriba-hairline bg-background px-4 py-2.5 text-[13px] text-scriba-ink-strong placeholder:text-scriba-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * O `mt-2` não é decoração: os formulários separam os campos com `gap-3`, e sem
 * ele o botão que CONFIRMA ficaria à mesma distância do último campo que os
 * campos ficam entre si, como se fosse mais um deles. A folga extra é o que diz
 * que ali termina o preenchimento e começa a ação.
 */
export const submitClass =
  "scriba-cta mt-2 w-full rounded-2xl bg-[image:var(--scriba-cta)] px-4 py-3 text-[13.5px] font-medium text-scriba-cta-ink transition-[filter] disabled:cursor-not-allowed disabled:opacity-70";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11.5px] font-light text-scriba-ink-soft">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] font-light text-scriba-ink-mute">{hint}</p> : null}
    </div>
  );
}

/**
 * O campo de senha com o botão de revelar. Ele existe porque digitar uma senha
 * às cegas num teclado de celular é a causa mais comum de "senha incorreta" em
 * quem digitou a senha certa.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} hint={hint}>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${fieldClass} pr-11`}
        />
        {/* Ícone, e não as palavras "mostrar"/"ocultar": elas competiam com o
            texto da senha dentro do mesmo campo, e obrigavam a reservar 76px
            de recuo à direita para caber a maior das duas. */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar a senha" : "Mostrar a senha"}
          title={visible ? "Ocultar a senha" : "Mostrar a senha"}
          className="absolute inset-y-0 right-3 my-auto flex h-fit items-center text-scriba-ink-mute transition-colors hover:text-scriba-ink-soft"
        >
          {visible ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
        </button>
      </div>
    </Field>
  );
}

/** O mesmo aviso vermelho que a tela de entrada já usava para o erro do OAuth. */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-2xl bg-scriba-rose px-4 py-3 text-[12.5px] leading-[1.5] text-scriba-rose-ink"
      role="alert"
    >
      <span
        aria-hidden
        className="mt-1 inline-block size-1.5 flex-none rounded-full bg-scriba-rose-accent"
      />
      <span>{children}</span>
    </div>
  );
}

/** O aviso calmo, em creme: "olhe sua caixa de entrada". */
export function AuthNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-scriba-cream px-4 py-3.5 text-left">
      <p className="text-[13px] font-medium text-scriba-cream-body">{title}</p>
      <p className="text-[12.5px] leading-[1.5] text-scriba-cream-body">{children}</p>
    </div>
  );
}

/** O "ou" entre o botão do Google e o formulário de e-mail. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-scriba-hairline" />
      <span className="text-[11px] font-light text-scriba-ink-mute">ou</span>
      <span className="h-px flex-1 bg-scriba-hairline" />
    </div>
  );
}
