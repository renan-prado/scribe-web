import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrentPartner } from "@/lib/auth/require-partner";
import { ScribaLogo } from "@/shared/brand";

export const metadata: Metadata = {
  title: { default: "Parceiros", template: "%s — Parceiros" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Shell do painel do parceiro.
 *
 * O gate por papel mora AQUI, e não no proxy: um guard por papel no proxy
 * custaria uma consulta ao banco em toda requisição do site para proteger uma
 * área que pouquíssimas pessoas visitam. O proxy já garante que só quem está
 * logado chega até aqui — `/partners` não está na allowlist pública.
 *
 * `notFound()` em vez de 403, pelo mesmo motivo do admin: não confirmamos a
 * existência da área para quem não deveria vê-la.
 */
export default async function PartnersLayout({ children }: { children: ReactNode }) {
  const partner = await getCurrentPartner();
  if (!partner) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-scriba-hairline bg-scriba-paper/85 px-4 backdrop-blur-md sm:px-6">
        <Link href="/partners" className="flex items-center gap-2 text-scriba-ink-strong">
          <ScribaLogo size={26} textClassName="text-[19px]" subtitle="Parceiros" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/feed"
            className="text-[12.5px] font-light text-scriba-ink-soft transition-colors hover:text-scriba-ink-strong"
          >
            Ir para o app →
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
