import Link from "next/link";

/**
 * Shared shell for /sign-in and /sign-up. Mirrors the landing page aesthetic:
 * soft blue gradient background, sticky logo header, and a rounded auth card
 * centered vertically.
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
    <div
      className="relative flex min-h-svh w-full flex-col overflow-hidden bg-white"
      style={{
        fontFamily: "var(--font-poppins), system-ui, sans-serif",
        color: "#33414F",
        background: "linear-gradient(180deg,#F6FBFF 0%,#FFFFFF 60%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -220,
          right: -160,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(79,168,240,.16) 0%,rgba(79,168,240,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute hidden lg:block"
        style={{
          bottom: -160,
          left: -180,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(248,198,75,.14) 0%,rgba(248,198,75,0) 70%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <Link href="/" className="flex items-center gap-[9px]" aria-label="Voltar para o início">
          <div
            className="flex items-center justify-center rounded-[9px] font-bold text-white"
            style={{
              width: 28,
              height: 28,
              fontSize: 14,
              background: "#4FA8F0",
              boxShadow: "0 5px 12px rgba(79,168,240,.32)",
            }}
          >
            S
          </div>
          <span style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: "-.01em" }}>Scriba</span>
        </Link>
        <Link
          href="/"
          className="text-[13px] font-light transition-colors hover:text-[#33414F]"
          style={{ color: "#6E7C8B" }}
        >
          ← Voltar
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-5 pb-16 pt-4 sm:pb-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            className="text-pretty text-[30px] leading-[1.12] sm:text-[34px]"
            style={{ fontWeight: 600, letterSpacing: "-.022em", color: "#2B3947" }}
          >
            {title}
          </h1>
          <p
            className="max-w-[340px] text-pretty text-[14px] leading-[1.6]"
            style={{ fontWeight: 300, color: "#6E7C8B" }}
          >
            {subtitle}
          </p>
        </div>

        <div
          className="flex flex-col gap-4 rounded-[26px] border bg-white p-7"
          style={{
            borderColor: "#EAF2FA",
            boxShadow: "0 16px 40px rgba(79,168,240,.14)",
          }}
        >
          {children}
        </div>

        <p className="text-center text-[13px]" style={{ fontWeight: 300, color: "#8C98A6" }}>
          {footer}
        </p>
      </main>
    </div>
  );
}
