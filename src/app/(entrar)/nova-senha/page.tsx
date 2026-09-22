import { AuthShell } from "@/features/auth/components/AuthShell";
import { NewPasswordForm } from "@/features/auth/components/NewPasswordForm";

export const metadata = {
  title: "Nova senha · Scriba",
  robots: { index: false, follow: false },
  alternates: { canonical: "/nova-senha" },
};

/**
 * Definir a nova senha. É para cá que o link de recuperação desemboca, depois
 * de o `/auth/callback` (ou o `/auth/confirm`) trocar o token por sessão.
 *
 * **É uma rota PROTEGIDA**, e é isso que dispensa qualquer token na URL: quem
 * chega sem sessão é mandado para a entrada pelo `src/proxy.ts`, porque o
 * caminho está em `KNOWN_APP_PREFIXES` e não na lista de públicas. A sessão
 * criada pelo link é a credencial.
 *
 * Mora em `(entrar)` e não em `(app)` porque não é uma tela do app: ela não
 * tem barra, nem chão grafite, nem conta carregada. É a mesma moldura clara da
 * `/sign-in`, que é de onde a pessoa veio.
 */
export default function NovaSenhaPage() {
  return (
    <AuthShell
      title="Criar uma nova senha"
      subtitle="Escolha a senha que você vai usar daqui em diante. Ela substitui a anterior na hora."
      footer={<>Depois de salvar, você já entra direto no app.</>}
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
