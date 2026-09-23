"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOPBAR_CHIP_CLASS } from "./chip";
import { useGlobalSearchStore } from "./GlobalSearchStore";

/**
 * A lupa da barra do topo, e só no DESKTOP.
 *
 * Ela substituiu o `SearchToggle`/`LibrarySearchLink` da Biblioteca, do
 * `/escrever` e do `/summary`: as três telas hoje têm a `MobileActionBar` no
 * celular, com a busca própria dela, e repetir a lupa aqui em cima duplicava o
 * botão na mesma tela. `hidden md:inline-flex` é a diferença inteira entre
 * este chip e o antigo, e é o padrão — o resto (o disco de 40px, o alvo do
 * tour) é igual.
 *
 * **`/importar` é a exceção**, e passa `mobileVisible`: aquela tela não tem
 * `MobileActionBar` (não é criação de sessão a partir de OUTRA sessão, é a
 * própria porta de criação), então esconder a lupa no celular ali tiraria a
 * busca do alcance de quem chegou por essa tela sem deixar outra em troca.
 *
 * **O tour aponta para o `data-tour` duas vezes**, aqui e no botão de busca
 * da `MobileActionBar`: um dos dois está sempre em `display: none`, e
 * `resolveAnchor` fica com o visível — a mesma técnica de `create-record` /
 * `create-write` / `create-import` entre `CreateActions` e o painel do rodapé.
 */
export function SearchTrigger({
  label = "Buscar na biblioteca",
  tourId = "library-search",
  mobileVisible = false,
}: {
  label?: string;
  tourId?: string;
  mobileVisible?: boolean;
} = {}) {
  const setOpen = useGlobalSearchStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      data-tour={tourId}
      className={cn(TOPBAR_CHIP_CLASS, !mobileVisible && "hidden md:inline-flex")}
    >
      <Search className="size-5" strokeWidth={1.75} />
    </button>
  );
}
