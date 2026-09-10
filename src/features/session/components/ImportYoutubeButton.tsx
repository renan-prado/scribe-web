import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";

/**
 * A porta da importação, no cabeçalho da Biblioteca.
 *
 * **Secundária de propósito.** O botão primário do app continua sendo "Gravar",
 * no header e no centro da nav, gravar ao vivo é o produto, e importar é o
 * atalho para o que já está online. Um segundo CTA cheio ao lado daquele
 * disputaria a atenção sem ter a mesma importância.
 *
 * **`spinner="none"` + `LinkPendingSwap`, e não o spinner padrão do `NavLink`.**
 * O rótulo é `sm:inline`: no celular este botão é só o ícone, e o
 * `spinner="inline"` ACRESCENTA um segundo glifo ao lado do conteúdo, o botão
 * crescia no meio do toque, empurrando o "atualizar" que fica ao lado. Trocando
 * o ícone pelo spinner a largura não muda. É o mesmo motivo pelo qual a
 * `MobileBottomNav` usa este componente; ver o cabeçalho de `LinkPendingSwap`.
 *
 * Server component: é um link, não tem estado.
 */
export function ImportYoutubeButton() {
  return (
    <NavLink
      href="/importar"
      spinner="none"
      // O alvo do passo "Importar do YouTube" do tour da Biblioteca.
      data-tour="recordings-import"
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-scriba-hairline bg-scriba-paper px-3.5 text-[13px] font-semibold text-scriba-ink transition-colors hover:border-scriba-blue/45 hover:bg-scriba-surface/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25"
      contentClassName="flex items-center gap-2"
    >
      <LinkPendingSwap className="size-4 text-scriba-ink-soft">
        <YoutubeIcon className="size-4 text-scriba-ink-soft" />
      </LinkPendingSwap>
      <span className="hidden sm:inline">Importar</span>
    </NavLink>
  );
}
