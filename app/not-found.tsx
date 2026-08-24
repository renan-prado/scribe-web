import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: { absolute: "Página não encontrada — Scriba" },
};

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-12 text-center sm:px-6">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </span>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Página não encontrada
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi movido. Se você chegou aqui a partir de um
          link, ele pode estar desatualizado.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button render={<Link href="/feed" />} nativeButton={false} size="lg">
          Ir para o início
        </Button>
        <Button render={<Link href="/" />} nativeButton={false} size="lg" variant="outline">
          Voltar à landing
        </Button>
      </div>
    </main>
  );
}
