import Link from "next/link";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";

export const metadata = {
  title: "Entrar",
};

type Search = { next?: string; error?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, error } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/home";
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Entrar no Scriba
        </h1>
        <p className="text-sm text-muted-foreground">
          Use sua conta Google para acessar suas gravações.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <GoogleSignInButton next={target} label="Entrar com Google" />
        {error ? (
          <p className="text-center text-xs text-destructive">
            {error === "exchange_failed"
              ? "Não consegui completar o login. Tente novamente."
              : "Algo deu errado no login. Tente novamente."}
          </p>
        ) : null}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Novo por aqui?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </main>
  );
}
