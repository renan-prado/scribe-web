import type { Metadata } from "next";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_LIST_MS } from "@/features/tour/config";
import { listSessions, type SessionListItem } from "@/lib/db/sessions";
import { SearchScope, SearchToggle } from "../components/SearchScope";
import { TopBar } from "../components/TopBar";
import { CreateDock } from "./CreateDock";
import { LibraryBrowser } from "./LibraryBrowser";

export const metadata: Metadata = { title: "Biblioteca" };

/**
 * O Início do v2: a lista de tudo que a pessoa gravou ou importou, agrupada por
 * mês, com busca atrás da lupa, e o botão de criar no rodapé.
 *
 * O layout segue os prints em `public/prints/new-release/`: barra do topo,
 * blocos por mês, botão flutuante. E o CARTÃO agora segue junto — é um mural de
 * POST-ITS de duas colunas (ver `LibraryNote`), com autor, título e data, e
 * nada mais. A troca que a tela propõe deixou de ser só de ordem: o acervo é a
 * primeira tela, criar é o botão que flutua sobre ele, e cada sessão é uma
 * anotação colorida em vez de uma ficha.
 *
 * **Uma consulta só.** A segunda buscava quais sessões já tinham estudo, para
 * uma pastilha "Estudo" que o post-it não mostra; ela saiu junto com a pastilha,
 * porque consulta que alimenta tela que não existe é custo invisível — não
 * aparece como bug, aparece como latência.
 *
 * A busca inteira mora no cliente (`LibraryBrowser`), como no `/recordings`: a
 * página continua sendo só quem BUSCA no banco. O `SearchScope` envolve o
 * cabeçalho e a lista porque o botão está num e o estado no outro; a `TopBar`
 * segue renderizada no servidor mesmo passando por dentro dele.
 *
 * A largura trava em 640px: a tela nasceu de um print de celular, e esticada
 * num monitor viram cartões de 1400px com três palavras em cada.
 */
export default async function V2HomePage({
  searchParams,
}: {
  /** `?busca=1` abre a tela com o campo já aberto. É por onde a lupa das
      outras telas chega aqui, ver `LibrarySearchLink`. */
  searchParams: Promise<{ busca?: string }>;
}) {
  const [sessions, { busca }] = await Promise.all([
    listSessions().catch((): SessionListItem[] => []),
    searchParams,
  ]);

  return (
    <SearchScope defaultOpen={busca === "1"}>
      {/* A folga de baixo é a altura da barra de criar mais o inset do iPhone:
          sem ela o último cartão da lista para debaixo dela e não há rolagem
          que o traga inteiro para a luz. Ver `CreateDock`. */}
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 pt-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <TopBar title="Biblioteca" trailing={<SearchToggle />} />
        <LibraryBrowser sessions={sessions} nowIso={new Date().toISOString()} />
      </main>
      <CreateDock />
      {/* A apresentação da Biblioteca, e a primeira que qualquer pessoa vê: é
          aqui que se cai ao entrar. Ver `src/features/tour/AGENTS.md`. */}
      <TourTrigger tour="library" delayMs={TOUR_DELAY_LIST_MS} />
    </SearchScope>
  );
}
