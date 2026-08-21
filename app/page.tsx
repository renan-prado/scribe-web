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
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between gap-2">
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          scribe
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="sm:h-9 sm:px-2.5"
          >
            Entrar
          </Button>
          <Button
            render={<Link href="/sign-up" />}
            nativeButton={false}
            size="sm"
            className="sm:h-9 sm:px-2.5"
          >
            Criar conta
          </Button>
        </div>
      </header>

      <section className="mt-12 flex flex-col items-center gap-5 text-center sm:mt-24 sm:gap-6">
        <h1 className="font-heading text-[1.625rem] leading-[1.15] font-bold tracking-tight text-balance text-foreground sm:text-5xl sm:leading-tight">
          O sermão inteiro, transcrito e resumido enquanto acontece.
        </h1>
        <p className="max-w-2xl text-balance text-sm text-muted-foreground sm:text-lg">
          Scribe grava a pregação, transcreve ao vivo, extrai versículos e citações em um feed e
          entrega um resumo estruturado assim que o pregador termina.
        </p>
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            render={<Link href="/sign-up" />}
            nativeButton={false}
            size="lg"
            className="w-full sm:w-auto sm:min-w-40"
          >
            Começar grátis
          </Button>
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto sm:min-w-40"
          >
            Já tenho conta
          </Button>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:mt-28 sm:grid-cols-3 sm:gap-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground sm:pt-16">
        © {new Date().getFullYear()} scribe
      </footer>
    </main>
  );
}
