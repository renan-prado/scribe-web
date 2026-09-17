import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";
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
    // Um tema só: os `dark:` que zeravam fundo e borda aqui eram o desvio do
    // tema escuro, e agora ele é o único. O véu é o CHÃO da página a 72%, não
    // o papel: o header flutua sobre a página, não é um cartão em cima dela.
    <div className="sticky top-0 z-40 border-b border-scriba-hairline bg-background/72 backdrop-blur-[22px]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3.5 sm:gap-8 sm:px-10 sm:py-[18px]">
        <Link
          href="/"
          aria-label="Scriba"
          className="cursor-default rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ScribaLogo size={28} textClassName="text-[22px]" className="text-scriba-ink-strong" />
        </Link>
        {/* Quatro âncoras, e cada uma precisa existir na landing. Aqui já houve
            um "Como funciona" apontando para `#como-funciona`; a seção saiu da
            página e o link foi junto, no mesmo commit. Um item de menu que
            rola para lugar nenhum é pior que um menu menor.

            "Biblo" é o único item que nomeia uma COISA em vez de uma
            categoria, e é de propósito: o nome não se explica sozinho, e é
            justamente por isso que se clica nele. */}
        <div className="hidden items-center gap-8 text-[13.5px] text-scriba-ink-soft lg:flex">
          <a href={`${prefix}#recursos`} className="lp-nav">
            Recursos
          </a>
          <a href={`${prefix}#biblo`} className="lp-nav">
            Biblo
          </a>
          <a href={`${prefix}#planos`} className="lp-nav">
            Planos
          </a>
          <a href={`${prefix}#perguntas`} className="lp-nav">
            Perguntas frequentes
          </a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3.5">
          <Link
            href="/sign-in"
            className="lp-link hidden px-1 py-2.5 text-[13.5px] font-medium text-scriba-ink-soft lg:inline"
          >
            Entrar
          </Link>
          {/* No celular este botão abre a escolha entre instalar e seguir no
              navegador; o texto é o mesmo nos dois lados. Ver `LandingCta`. */}
          <LandingCta
            className="scriba-cta inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--scriba-cta)] py-3 px-5 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink"
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
          <Link href="/parceiros" className="lp-link-footer">
            Parceiros
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

type SectionLabelProps = {
  children: React.ReactNode;
  color?: "blue" | "mute" | "yellow-light";
};

/**
 * A pequena etiqueta em caixa alta que abre cada seção das páginas de venda.
 *
 * Mora aqui, e não em `app/page.tsx`, desde que a LP deixou de ser a única:
 * `/parceiros` usa a mesma linguagem visual, e duas cópias de um átomo de
 * tipografia é como as duas páginas começam a divergir em tracking e peso sem
 * ninguém decidir isso.
 */
export function SectionLabel({ children, color = "mute" }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[.12em]",
        // Era o azul de marca. Hoje o rótulo de seção é a própria tinta forte:
        // o que o distingue do corpo é o versalete e o peso, não a cor.
        color === "blue" && "text-scriba-ink-strong",
        color === "mute" && "text-scriba-ink-mute",
        // Amarelo é a MOEDA no produto inteiro. Na seção da Biblioteca o
        // rótulo vira o post-it limão, que é a cor do acervo — e continua
        // sendo ele depois de a faixa daquela seção sair: o limão é da coisa
        // anunciada, não da superfície embaixo dela.
        color === "yellow-light" && "text-v2-note-lemon"
      )}
    >
      {children}
    </div>
  );
}
