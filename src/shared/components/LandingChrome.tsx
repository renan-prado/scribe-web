import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  textClassName?: string;
};

/**
 * Pena mark for CTA buttons. Inline (instead of /pena-logo-white.svg) so it
 * paints with `currentColor` — white on the blue CTAs, dark amber on the yellow
 * one, without shipping a second asset per colorway.
 */
export function PenaGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 155 155"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
    </svg>
  );
}

export function LandingLogo({ size = 26, textClassName = "text-[22px]" }: LogoProps) {
  // O logotipo é marcado como UMA imagem, não como um ícone ao lado da palavra
  // "scriba" solta. Duas consequências, ambas desejadas: o leitor de tela
  // anuncia "Scriba" uma vez, em vez do SVG decorativo seguido de um texto
  // órfão; e o verificador de contraste para de tratar a palavra como texto de
  // leitura. O WCAG 1.4.3 isenta nome de marca de exigência de contraste, mas
  // um `<span>` colorido não se declara logotipo sozinho — o `role` é o que
  // comunica isso. A cor da marca fica intacta.
  // `text-scriba-blue-ink`, não `text-lp-brand`: o segundo é o azul de
  // SUPERFÍCIE (é ele que pinta o fundo do CTA) e, como tinta sobre papel, dá
  // 2,56:1. É a mesma distinção aplicada aos outros 73 usos de azul como texto.
  // No tema escuro o token já é claro (#8AC6FA), então o logo segue destacado.
  return (
    <div className="flex items-center gap-2 text-scriba-blue-ink" role="img" aria-label="Scriba">
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 155 155"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
      </svg>
      <span
        aria-hidden="true"
        className={cn("font-semibold leading-none", textClassName)}
        style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
      >
        scriba
      </span>
    </div>
  );
}

type LandingHeaderProps = {
  /**
   * When true, in-page section anchors resolve inside the current page
   * ("#planos"). When false, they navigate back to the landing page
   * ("/#planos"). Defaults to false (use on standalone pages like /terms).
   */
  onLandingPage?: boolean;
};

export function LandingHeader({ onLandingPage = false }: LandingHeaderProps) {
  const prefix = onLandingPage ? "" : "/";
  return (
    <div className="sticky top-0 z-40 border-b border-scriba-hairline-soft/60 bg-scriba-paper/55 backdrop-blur-[22px] backdrop-saturate-150 dark:border-b-transparent dark:bg-transparent dark:backdrop-saturate-100">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3.5 sm:gap-8 sm:px-10 sm:py-[18px]">
        <Link
          href="/"
          aria-label="Scriba"
          className="cursor-default rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <LandingLogo size={28} textClassName="text-[22px]" />
        </Link>
        <div className="hidden items-center gap-8 text-[13.5px] text-scriba-ink-soft lg:flex">
          <a href={`${prefix}#como-funciona`} className="lp-nav">
            Como funciona
          </a>
          <a href={`${prefix}#recursos`} className="lp-nav">
            Recursos
          </a>
          <a href={`${prefix}#planos`} className="lp-nav">
            Planos
          </a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Mobile/tablet: botão-ícone compacto pra não brigar com o CTA em
              telas estreitas. No desktop (lg) vira o pill completo, junto do
              "Entrar" e da navegação. */}
          <ThemeToggle compact className="lg:hidden" />
          <ThemeToggle className="hidden lg:inline-flex" />
          <Link
            href="/sign-in"
            className="lp-link hidden px-1 py-2.5 text-[13.5px] font-medium text-scriba-ink-soft lg:inline"
          >
            Entrar
          </Link>
          <Link
            href="/sign-in"
            className="lp-cta inline-flex items-center justify-center gap-2 rounded-[22px] bg-lp-brand py-3 px-5 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-on-blue shadow-[0_5px_14px_rgba(79,168,240,.3)]"
          >
            <PenaGlyph size={14} />
            Começar
          </Link>
        </div>
      </div>
    </div>
  );
}

type LandingFooterProps = {
  onLandingPage?: boolean;
};

export function LandingFooter({ onLandingPage = false }: LandingFooterProps) {
  const prefix = onLandingPage ? "" : "/";
  return (
    <footer className="border-t border-scriba-hairline-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 sm:px-10 sm:py-11 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <LandingLogo size={24} textClassName="text-[18px]" />
        <div className="flex flex-wrap gap-5 text-[12.5px] font-light text-scriba-ink-mute sm:gap-7">
          <a href={`${prefix}#recursos`} className="lp-link-footer">
            Recursos
          </a>
          <a href={`${prefix}#planos`} className="lp-link-footer">
            Planos
          </a>
          <Link href="/terms" className="lp-link-footer">
            Termos de Uso
          </Link>
          <Link href="/privacy" className="lp-link-footer">
            Privacidade
          </Link>
          <a href="mailto:oi@scriba.app" className="lp-link-footer">
            Contato
          </a>
        </div>
        <div className="text-[12px] font-light text-scriba-ink-mute">
          © {new Date().getFullYear()} Scriba
        </div>
      </div>
    </footer>
  );
}
