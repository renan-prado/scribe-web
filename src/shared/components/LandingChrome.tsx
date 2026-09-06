import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION } from "@/lib/version";
import { ScribaLogo, ScribaMark } from "@/shared/brand";
import { LandingCta } from "@/shared/components/LandingCta";

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
          <ScribaLogo size={28} textClassName="text-[22px]" className="text-scriba-ink-strong" />
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
          {/* No celular este botão entra pela instalação do PWA; o texto fica.
              Ver `LandingCta`. */}
          <LandingCta
            className="scriba-cta inline-flex items-center justify-center gap-2 rounded-[22px] bg-[image:var(--scriba-cta)] py-3 px-5 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)]"
            icon={<ScribaMark size={18} />}
            label="Começar"
          />
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
        <ScribaLogo size={24} textClassName="text-[18px]" className="text-scriba-ink-strong" />
        <div className="flex flex-wrap gap-5 text-[12.5px] font-light text-scriba-ink-mute sm:gap-7">
          <a href={`${prefix}#recursos`} className="lp-link-footer">
            Recursos
          </a>
          <a href={`${prefix}#planos`} className="lp-link-footer">
            Planos
          </a>
          <Link href="/about" className="lp-link-footer">
            Sobre
          </Link>
          <Link href="/terms" className="lp-link-footer">
            Termos de Uso
          </Link>
          <Link href="/privacy" className="lp-link-footer">
            Privacidade
          </Link>
          <Link href="/contact" className="lp-link-footer">
            Contato
          </Link>
        </div>
        <div className="flex items-baseline gap-2 text-[12px] font-light text-scriba-ink-mute">
          <span>© {new Date().getFullYear()} Scriba</span>
          {/* Sutil de propósito: serve para pedir "qual versão você está
              vendo?" num suporte, não para ser lido por quem visita. */}
          <span className="text-[10px] font-light tabular-nums opacity-60">v{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
