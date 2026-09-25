"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TOPBAR_CHIP_CLASS } from "./chip";
import { useGlobalSearchStore } from "./GlobalSearchStore";

/**
 * A lupa da barra do topo, e só no DESKTOP.
 *
 * Ela substituiu o `SearchToggle`/`LibrarySearchLink` da Biblioteca, do
 * `/summary/new` e do `/summary`: as três telas hoje têm a `MobileActionBar` no
 * celular, com a busca própria dela, e repetir a lupa aqui em cima duplicava o
 * botão na mesma tela. `hidden md:inline-flex` é a diferença inteira entre
 * este chip e o antigo, e é o padrão — o resto (o disco de 40px, o alvo do
 * tour) é igual.
 *
 * **`/import` é a exceção**, e passa `mobileVisible`: aquela tela não tem
 * `MobileActionBar` (não é criação de sessão a partir de OUTRA sessão, é a
 * própria porta de criação), então esconder a lupa no celular ali tiraria a
 * busca do alcance de quem chegou por essa tela sem deixar outra em troca.
 *
 * **O tour aponta para o `data-tour` duas vezes**, aqui e no botão de busca
 * da `MobileActionBar`: um dos dois está sempre em `display: none`, e
 * `resolveAnchor` fica com o visível — a mesma técnica de `create-record` /
 * `create-write` / `create-import` entre `CreateActions` e o painel do rodapé.
 *
 * ## Com `href` ele é um LINK, e é para lá que as quatro telas vão
 *
 * Na Biblioteca a busca virou rota (`/home/search`), e abrir uma rota é o que
 * um link faz: ele ganha o Ctrl+clique, o prefetch e o menu de contexto de
 * graça, e o aplicativo que um dia desenhar esta barra em nativo só precisa do
 * endereço. As outras três telas (`/import`, `/summary/new`,
 * `/summary/:id/edit`) ainda abrem o diálogo pela `GlobalSearchStore` — ver
 * `GlobalSearchHost`, que é a ponte enquanto elas não têm rota própria.
 */
export function SearchTrigger({
  href,
  label = "Buscar na biblioteca",
  tourId = "library-search",
  mobileVisible = false,
}: {
  /** O endereço da busca desta tela. Sem ele, o diálogo abre pela store. */
  href?: string;
  label?: string;
  tourId?: string;
  mobileVisible?: boolean;
} = {}) {
  const setOpen = useGlobalSearchStore((s) => s.setOpen);
  const className = cn(TOPBAR_CHIP_CLASS, !mobileVisible && "hidden md:inline-flex");
  const glyph = <Search className="size-5" strokeWidth={1.75} />;

  if (href) {
    return (
      <Link href={href} aria-label={label} data-tour={tourId} className={className}>
        {glyph}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      data-tour={tourId}
      className={className}
    >
      {glyph}
    </button>
  );
}
