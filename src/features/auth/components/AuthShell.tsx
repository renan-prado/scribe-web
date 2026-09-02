import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScribaLogo } from "@/shared/brand";

/**
 * Shared shell for the unified /sign-in page (also serving as sign-up).
 * Mirrors the landing page aesthetic: soft blue gradient background, sticky
 * logo header, and a rounded auth card centered vertically.
 */
type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-[image:var(--lp-hero-auth)] font-[var(--font-poppins),system-ui,sans-serif] text-scriba-ink-strong">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-220px] right-[-160px] size-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-160px] left-[-180px] hidden size-[520px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.14)_0%,rgba(248,198,75,0)_70%)] lg:block"
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <Link
          href="/"
          aria-label="Voltar para o início"
          className="flex items-center gap-2 rounded-full text-scriba-ink-strong transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ScribaLogo size={28} textClassName="text-[22px]" />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <Link
            href="/"
            className="text-[13px] font-light text-scriba-ink-soft transition-colors hover:text-scriba-ink-strong"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-5 pb-16 pt-4 sm:pb-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-pretty text-[30px] font-semibold leading-[1.12] tracking-[-0.022em] text-scriba-ink-strong sm:text-[34px]">
            {title}
          </h1>
          <p className="max-w-[340px] text-pretty text-[14px] font-light leading-[1.6] text-scriba-ink-soft">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-[26px] border border-scriba-hairline bg-scriba-paper p-7 shadow-[0_16px_40px_rgba(79,168,240,.14)]">
          {children}
        </div>

        <p className="text-center text-[13px] font-light text-scriba-ink-mute">{footer}</p>
      </main>
    </div>
  );
}
