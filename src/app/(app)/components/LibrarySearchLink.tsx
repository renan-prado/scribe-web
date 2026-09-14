import { Search } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * A lupa das telas que NÃO são a Biblioteca.
 *
 * Ela é um LINK, e não um botão: a busca é da Biblioteca — o índice, os
 * filtros e a lista inteira moram no `LibraryBrowser` (ver `SearchScope`), e
 * uma segunda busca no `/summary` procuraria dentro de uma sessão só, que é
 * outra funcionalidade com o mesmo glifo. Daqui a lupa leva para o acervo com
 * o campo JÁ ABERTO (`?busca=1`), que é o que a pessoa queria ao tocá-la.
 *
 * O chip é o mesmo da `SearchToggle` (ver `chip.ts`): a barra tem o mesmo canto
 * direito em toda tela, e um botão que muda de desenho ao navegar faria a
 * pessoa achar que saiu do app.
 */
export function LibrarySearchLink() {
  return (
    <NavLink
      href="/home?busca=1"
      aria-label="Buscar na biblioteca"
      spinner="none"
      contentClassName="inline-flex items-center"
      className={TOPBAR_CHIP_CLASS}
    >
      <Search className="size-5" strokeWidth={1.75} />
    </NavLink>
  );
}
