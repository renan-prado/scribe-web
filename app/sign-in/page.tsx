import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";

export const metadata = {
  title: "Entrar ou criar conta",
};

type Search = { next?: string; error?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, error } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/feed";
  const errorMessage =
    error === "exchange_failed"
      ? "Não consegui completar o login. Tente novamente."
      : error
        ? "Algo deu errado no login. Tente novamente."
        : null;

  return (
    <AuthShell
      title="Entrar no Scriba"
      subtitle="Use sua conta Google para entrar. Se ainda não tem uma conta, ela é criada automaticamente no primeiro acesso — grátis, sem cartão."
      footer={<>Primeira vez por aqui? É só continuar com o Google. Sua conta é criada na hora.</>}
    >
      <GoogleSignInButton next={target} label="Continuar com Google" />
      {errorMessage ? (
        <div
          className="flex items-start gap-2 rounded-2xl px-4 py-3"
          style={{
            background: "#FAEAE5",
            color: "#8A4E3B",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
          role="alert"
        >
          <span
            aria-hidden
            className="mt-1 inline-block size-1.5 flex-none rounded-full"
            style={{ background: "#A8715C" }}
          />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <p className="text-center text-[11.5px]" style={{ fontWeight: 300, color: "#9BA6B3" }}>
        Ao continuar, você aceita nossos termos e a política de privacidade.
      </p>
    </AuthShell>
  );
}
