import Link from "next/link";

/**
 * Shared shell for the unified /sign-in page (also serving as sign-up).
 * Mirrors the landing page aesthetic: soft blue gradient background, sticky
 * logo header, and a rounded auth card centered vertically.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
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
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 249 249"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#0F0D1E]"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M179 0C217.66 0 249 31.3401 249 70V179C249 217.66 217.66 249 179 249H70C31.3401 249 5.96018e-07 217.66 0 179V70C0 31.3401 31.3401 5.95941e-07 70 0H179ZM187.439 57.0098C159.551 59.2819 135.374 67.6406 115.574 81.8604C114.292 82.7832 113.634 84.3421 113.859 85.8994C115.091 94.2864 111.474 104.192 107.856 111.561C106.377 107.376 104.206 103.534 102.131 100.434C101.4 99.3431 100.207 98.6571 98.9023 98.5664C97.5913 98.4933 96.3203 99.0167 95.4541 99.9951C78.5287 119.267 72.9249 139.522 77.707 163.333L58.6504 182.391C56.4504 184.59 56.4504 188.145 58.6504 190.344C59.7463 191.441 61.1871 191.993 62.627 191.993C64.0668 191.993 65.5067 191.441 66.6035 190.344L114.899 142.048C117.098 139.849 120.655 139.849 122.854 142.048C125.053 144.248 125.053 147.802 122.854 150.002L99.9082 172.947C100.342 172.952 100.792 173.03 101.22 173.03C120.648 173.03 137.928 164.942 154.511 148.314C178.023 124.802 188.879 99.6637 191.984 61.5488C192.091 60.317 191.641 59.1019 190.764 58.2295C189.891 57.3585 188.694 56.9315 187.439 57.0098Z"
            />
          </svg>
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

        <div className="flex flex-col gap-4 rounded-[26px] border border-[#EAF2FA] bg-white p-7 shadow-[0_16px_40px_rgba(79,168,240,.14)]">
          {children}
        </div>

        <p className="text-center text-[13px] font-light text-scriba-ink-mute">{footer}</p>
      </main>
    </div>
  );
}
