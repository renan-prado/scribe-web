import { AuthShell } from "@/features/auth/components/AuthShell";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata = {
  title: "Recuperar senha · Scriba",
  robots: { index: false, follow: false },
  alternates: { canonical: "/recuperar" },
};

/**
 * "Esqueci minha senha".
 *
 * Pública, como a `/sign-in`: quem chega aqui é justamente quem não consegue
 * entrar. A rota está na lista do `src/proxy.ts` por isso.
 *
 * Ela NÃO está entre as rotas que expulsam quem já tem sessão
 * (`AUTH_ONLY_PREFIXES`), e isso é de propósito: quem entrou pelo Google e
 * quer PASSAR a ter senha usa este mesmo caminho, estando logado.
 */
export default function RecuperarPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Diga o e-mail da sua conta e eu mando um link para você criar uma senha nova."
      footer={<>O link vale por pouco tempo. Se demorar a abrir, é só pedir outro.</>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
