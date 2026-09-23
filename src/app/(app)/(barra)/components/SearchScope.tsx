"use client";

import { Search, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * O estado da busca de uma LISTA, compartilhado entre o BOTÃO (que mora na
 * `TopBar`) e a lista em si — hoje só o `StudiesBrowser`, nos Estudos.
 *
 * **A Biblioteca não usa mais isto.** A busca dela é a GLOBAL
 * (`GlobalSearchDialog`, `(barra)/components/`), aberta por Ctrl+K ou pelo
 * `SearchTrigger`/`MobileActionBar` de qualquer tela — não uma barra que só
 * existe depois de já estar em `/home`. Este módulo sobrevive porque os
 * Estudos ainda o usam, e eles estão saindo do produto (ver
 * `src/app/AGENTS.md`).
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

/**
 * `defaultOpen` é a lupa das OUTRAS telas chegando aqui: o `/summary` não tem
 * busca própria, e a dele é um link para `/home?busca=1` (ver
 * `LibrarySearchLink`). Sem isso a pessoa cairia na Biblioteca com o campo
 * fechado, tendo que tocar a lupa de novo na tela seguinte.
 */
export function SearchScope({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <SearchScopeContext.Provider value={value}>{children}</SearchScopeContext.Provider>;
}

export function useSearchScope(): SearchScopeValue {
  const ctx = useContext(SearchScopeContext);
  if (!ctx) throw new Error("useSearchScope precisa estar dentro de <SearchScope>");
  return ctx;
}

/**
 * O botão da lupa, que abre e fecha a barra. As duas telas de lista montam o
 * seu, e por isso o rótulo e o alvo do tour vêm de fora: o que se procura numa
 * é gravação, na outra é estudo, e um `aria-label` genérico ("Buscar") não diz
 * a quem não vê a tela em que lista ele está.
 *
 * Ele TROCA de glifo quando aberto, e isso não é enfeite: a lupa aberta e a
 * lupa fechada seriam o mesmo botão dizendo a mesma coisa em dois estados
 * diferentes, e a pessoa que abriu sem querer não teria como saber por onde
 * desfazer. O "×" é a saída.
 */
export function SearchToggle({
  label = "Buscar gravações",
  tourId = "library-search",
}: {
  label?: string;
  tourId?: string;
} = {}) {
  const { open, setOpen } = useSearchScope();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? "Fechar busca" : label}
      aria-expanded={open}
      // O alvo do passo de busca do tour da tela, e é a LUPA, não a barra: a
      // barra (`CollectionSearch`) só é montada depois deste clique, então um
      // tour ancorado nela descarta o passo em toda visita, em silêncio — foi
      // o que aconteceu na Biblioteca por meses. Ver
      // `src/features/tour/AGENTS.md`.
      data-tour={tourId}
      // O chip da barra, o mesmo do hambúrguer e do voltar. Ver `chip.ts`.
      className={TOPBAR_CHIP_CLASS}
    >
      {open ? (
        <X className="size-5" strokeWidth={1.75} />
      ) : (
        <Search className="size-5" strokeWidth={1.75} />
      )}
    </button>
  );
}
