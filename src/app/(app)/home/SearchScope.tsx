"use client";

import { Search, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

/**
 * O estado da busca da Biblioteca, compartilhado entre o BOTÃO (que mora na
 * `TopBar`) e a LISTA (que mora no `LibraryBrowser`).
 *
 * Ele existe por causa dessa distância: os dois estão em ramos diferentes da
 * árvore, com um server component no meio, então nenhum dos dois pode segurar
 * o estado do outro. O provider envolve os dois na PÁGINA, e a `TopBar`
 * continua sendo renderizada no servidor mesmo passando por aqui — um server
 * component como filho de um client component é renderizado antes e entregue
 * pronto.
 *
 * Ele guarda só o `open`. O texto e os filtros ficam no `LibraryBrowser`,
 * porque só ele os usa; subi-los para cá faria cada tecla digitada
 * re-renderizar o cabeçalho junto.
 */
type SearchScopeValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SearchScopeContext = createContext<SearchScopeValue | null>(null);

export function SearchScope({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <SearchScopeContext.Provider value={value}>{children}</SearchScopeContext.Provider>;
}

export function useSearchScope(): SearchScopeValue {
  const ctx = useContext(SearchScopeContext);
  if (!ctx) throw new Error("useSearchScope precisa estar dentro de <SearchScope>");
  return ctx;
}

/**
 * O botão da lupa, que abre e fecha a barra.
 *
 * Ele TROCA de glifo quando aberto, e isso não é enfeite: a lupa aberta e a
 * lupa fechada seriam o mesmo botão dizendo a mesma coisa em dois estados
 * diferentes, e a pessoa que abriu sem querer não teria como saber por onde
 * desfazer. O "×" é a saída.
 */
export function SearchToggle() {
  const { open, setOpen } = useSearchScope();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? "Fechar busca" : "Buscar gravações"}
      aria-expanded={open}
      // O alvo do passo "busque pela sua biblioteca" do tour `library`, e é a
      // LUPA, não a barra: a barra (`CollectionSearch`, com o
      // `data-tour="collection-search"` que serve aos Estudos) só é montada
      // depois deste clique, então um tour ancorado nela descartava o passo em
      // toda visita, em silêncio. Ver `src/features/tour/AGENTS.md`.
      data-tour="library-search"
      className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-v2-ink transition-colors hover:bg-v2-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {open ? (
        <X className="size-6" strokeWidth={1.75} />
      ) : (
        <Search className="size-6" strokeWidth={1.75} />
      )}
    </button>
  );
}
