import Link from "next/link";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";

export const metadata = {
  title: "Criar conta",
};

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Criar conta no Scribe
        </h1>
        <p className="text-sm text-muted-foreground">
          Sua conta é criada automaticamente no primeiro login com Google.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <GoogleSignInButton next="/home" label="Criar conta com Google" />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </main>
  );
}
