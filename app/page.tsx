import { BookOpenText, MicVocal, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: { absolute: "Scribe — Transcrição e resumos ao vivo de sermões" },
};

const FEATURES = [
  {
    icon: MicVocal,
    title: "Transcrição em tempo real",
    body: "Grave o culto direto do navegador. O Scribe transcreve conforme o pregador fala, com prompt de vocabulário bíblico.",
  },
  {
    icon: BookOpenText,
    title: "Feed vivo de versículos e citações",
    body: "Versículos citados, destaques verbatim e autores mencionados aparecem em cards enquanto a pregação acontece.",
  },
  {
    icon: Sparkles,
    title: "Resumo estruturado no final",
    body: "Ao parar a gravação, você recebe título, resumo curto e blocos temáticos gerados a partir do transcrito + do feed curado.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-6 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          scribe
        </span>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost" size="lg">
            Entrar
          </Button>
          <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg">
            Criar conta
          </Button>
        </div>
      </header>

      <section className="mt-16 flex flex-col items-center gap-6 text-center sm:mt-24">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          O sermão inteiro, transcrito e resumido enquanto acontece.
        </h1>
        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Scribe grava a pregação, transcreve ao vivo, extrai versículos e citações em um feed e
          entrega um resumo estruturado assim que o pregador termina.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button
            render={<Link href="/sign-up" />}
            nativeButton={false}
            size="lg"
            className="min-w-40"
          >
            Começar grátis
          </Button>
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="min-w-40"
          >
            Já tenho conta
          </Button>
        </div>
      </section>

      <section className="mt-20 grid gap-6 sm:mt-28 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-16 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} scribe
      </footer>
    </main>
  );
}
