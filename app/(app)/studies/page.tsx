import type { Metadata } from "next";
import { StudiesEmptyState } from "@/features/session/components/StudiesEmptyState";
import { StudiesUpsell } from "@/features/session/components/StudiesUpsell";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_LIST_MS } from "@/features/tour/config";
import { listDeepenings } from "@/lib/db/deepenings";
import { canCurrentUserUse } from "@/lib/entitlements/server";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-1 flex-col bg-scriba-surface">
      <main
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8",
          isEmpty && "justify-center py-0 sm:py-0"
        )}
      >
        {isEmpty ? null : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl">
                Seus estudos
              </h1>
              <p className="text-sm font-light text-scriba-ink-soft">
                Estudos teológicos que o Scriba gerou a partir dos seus sermões.
              </p>
            </div>
          </div>
        )}

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
  );
}
