import Link from "next/link";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";

export const metadata = {
  title: "Criar conta",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Crie sua conta no Scriba"
      subtitle="Sua conta é criada automaticamente no primeiro login. Grátis para começar, sem cartão de crédito."
      footer={
        <>
          Já tem conta?{" "}
          <Link
            href="/sign-in"
            className="font-medium transition-colors hover:text-[#33414F]"
            style={{ color: "#4FA8F0" }}
          >
            Entrar
          </Link>
        </>
      }
    >
      <GoogleSignInButton next="/feed" label="Criar conta com Google" />
      <p className="text-center text-[11.5px]" style={{ fontWeight: 300, color: "#9BA6B3" }}>
        Ao continuar, você aceita nossos termos e a política de privacidade.
      </p>
    </AuthShell>
  );
}
