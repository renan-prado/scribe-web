import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

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
          className="flex items-center gap-2 rounded-full text-lp-brand transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 155 155"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
          </svg>
          <span
            className="text-[22px] font-semibold leading-none"
            style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
          >
            scriba
          </span>
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
