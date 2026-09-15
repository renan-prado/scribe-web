import type { Metadata } from "next";
import { StudiesEmptyState } from "@/features/session/components/StudiesEmptyState";
import { StudiesUpsell } from "@/features/session/components/StudiesUpsell";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_LIST_MS } from "@/features/tour/config";
import { listDeepenings } from "@/lib/db/deepenings";
import { canCurrentUserUse } from "@/lib/entitlements/server";
import { cn } from "@/lib/utils";
import { SearchScope, SearchToggle } from "../components/SearchScope";
import { TopBar } from "../components/TopBar";
import { StudiesBrowser } from "./StudiesBrowser";

export const metadata: Metadata = { title: "Seus estudos" };

export default async function StudiesPage() {
  const [result, canGenerate] = await Promise.all([
    listDeepenings()
      .then((s) => ({ ok: true as const, studies: s }))
      .catch((err: Error) => ({ ok: false as const, message: err.message })),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);

  const studies = result.ok ? result.studies : [];
  const loadError = result.ok ? null : result.message;
  const now = new Date();

  // O agrupamento por período mora no `StudiesBrowser`: agrupar aqui, antes do
  // filtro, deixaria seções vazias na tela toda vez que a busca esvaziasse um
  // mês.
  const isEmpty = studies.length === 0 && !loadError;
  // Sem o plano e sem nenhum estudo, a página inteira vira o convite: explicar
  // como gerar algo que a pessoa não pode gerar seria pior que não explicar.
  const showUpsellState = isEmpty && !canGenerate;

  return (
    // O `SearchScope` envolve o cabeçalho e a lista: a lupa mora na `TopBar` e
    // o estado dela no `StudiesBrowser`, que estão em ramos diferentes da
    // árvore. Mesma montagem da Biblioteca, ver `SearchScope`.
    <SearchScope>
      <div className="flex flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col gap-6 px-4 pt-2 pb-10">
          {/* O título da página é o da barra, e por isso o cabeçalho gordo saiu:
            ele repetia "Seus estudos" logo abaixo da `TopBar` que já diz
            "Estudos". A frase de apoio foi junto — ela explicava o que a lista
            mostra para quem chegava sem contexto, e no v2 quem chega aqui veio
            pelo menu, que tem o mesmo nome. */}
          {/* A lupa só existe quando há o que procurar: sem nenhum estudo, o
              `StudiesBrowser` nem é montado, e o botão abriria uma barra que
              não tem onde aparecer. Sem `trailing`, a `TopBar` põe um vão do
              tamanho do chip e o título não escorrega. */}
          <TopBar
            title="Estudos"
            trailing={
              studies.length > 0 ? (
                <SearchToggle label="Buscar estudos" tourId="studies-search" />
              ) : undefined
            }
          />

          {/* O `justify-center` da tela vazia mora AQUI, e não no `<main>`: lá ele
          centrava a barra do topo junto, e o cabeçalho do app descia para o
          meio da página junto com o convite. */}

          <div className={cn("flex flex-1 flex-col gap-6", isEmpty && "justify-center")}>
            {/* Tem estudos mas perdeu (ou nunca teve) o plano: a lista fica, o
            convite entra acima dela. Só a GERAÇÃO é restrita, ver
            lib/entitlements/features.ts. */}
            {!canGenerate && studies.length > 0 ? <StudiesUpsell variant="banner" /> : null}

            {loadError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                Não consegui carregar os estudos: {loadError}
              </div>
            ) : showUpsellState ? (
              <StudiesUpsell variant="full" />
            ) : studies.length === 0 ? (
              <StudiesEmptyState />
            ) : (
              <StudiesBrowser studies={studies} nowIso={now.toISOString()} />
            )}
          </div>
        </main>
        {/* A apresentação dos Estudos. Ela não roda para quem chegou na tela de
          convite (`showUpsellState`): ali a página INTEIRA já é uma explicação,
          e um tour por cima dela seria a mesma coisa dita duas vezes. */}
        <TourTrigger
          tour="studies"
          delayMs={TOUR_DELAY_LIST_MS}
          enabled={!isEmpty && !showUpsellState}
        />
      </div>
    </SearchScope>
  );
}
