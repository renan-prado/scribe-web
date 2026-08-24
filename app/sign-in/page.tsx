import Link from "next/link";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";

export const metadata = {
  title: "Entrar",
};

type Search = { next?: string; error?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, error } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/home";
  const errorMessage =
    error === "exchange_failed"
      ? "Não consegui completar o login. Tente novamente."
      : error
        ? "Algo deu errado no login. Tente novamente."
        : null;

  return (
    <AuthShell
      title="Entre no Scriba"
      subtitle="Use sua conta Google para acessar suas gravações e o feed vivo do próximo culto."
      footer={
        <>
          Novo por aqui?{" "}
          <Link
            href="/sign-up"
            className="font-medium transition-colors hover:text-[#33414F]"
            style={{ color: "#4FA8F0" }}
          >
            Criar conta
          </Link>
        </>
      }
    >
      <GoogleSignInButton next={target} label="Entrar com Google" />
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
