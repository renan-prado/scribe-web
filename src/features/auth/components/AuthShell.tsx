import Link from "next/link";
import { ScribaPenaMark } from "@/components/icons/ScribaPenaMark";

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
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#F6FBFF_0%,#FFFFFF_60%)] font-[var(--font-poppins),system-ui,sans-serif] text-scriba-ink-strong">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-220px] right-[-160px] size-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-160px] left-[-180px] hidden size-[520px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.14)_0%,rgba(248,198,75,0)_70%)] lg:block"
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <Link href="/" className="flex items-center gap-[9px]" aria-label="Voltar para o início">
          <ScribaPenaMark width={28} height={28} className="text-[#0F0D1E]" />
          <span className="text-[16.5px] font-semibold tracking-[-0.01em]">Scriba</span>
        </Link>
        <Link
          href="/"
          className="text-[13px] font-light text-scriba-ink-soft transition-colors hover:text-[#33414F]"
        >
          ← Voltar
        </Link>
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

        <div className="flex flex-col gap-4 rounded-6.5 border border-[#EAF2FA] bg-white p-7 shadow-[0_16px_40px_rgba(79,168,240,.14)]">
          {children}
        </div>

        <p className="text-center text-[13px] font-light text-scriba-ink-mute">{footer}</p>
      </main>
    </div>
  );
}
