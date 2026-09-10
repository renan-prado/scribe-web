"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { TourRunner } from "@/features/tour/components/TourRunner";
import { finishTour } from "@/features/tour/lib/api";
import {
  shouldRunTour,
  TOURS,
  type TourKey,
  type TourSeenMap,
  type TourStep,
} from "@/lib/domain/tour";

/**
 * O dono do estado dos tours: quem já foi visto, e qual está aberto AGORA.
 *
 * Ele mora no layout de `(app)`, e não em cada página, por duas razões que
 * não são organização:
 *
 * 1. **Um tour por vez, na tela toda.** O overlay é um só, montado aqui. Duas
 *    páginas capazes de abrir o próprio overlay abririam dois véus empilhados
 *    no dia em que alguém montasse dois gatilhos por engano.
 * 2. **O mapa do que já foi visto sobrevive à navegação.** O layout de `(app)`
 *    não é refeito quando se anda entre as telas dele, então o `seen` que veio
 *    do servidor no carregamento continua valendo, e o tour que acabou de ser
 *    visto some da lista sem nenhuma ida ao banco.
 *
 * A conferência daqui é uma CÓPIA da que o servidor faz, não a original. Ela
 * existe para o caso comum, que é não haver nada a mostrar: sem ela, toda
 * visita a toda tela com tour faria uma chamada de rede para ouvir "não". A
 * palavra final continua sendo o `claimTour` do servidor, e é ele que resolve
 * duas abas abertas na mesma tela.
 */

type ActiveTour = { tour: TourKey; steps: TourStep[] };

type TourContextValue = {
  /** Vale a pena sequer perguntar ao servidor? Ver o cabeçalho. */
  canRun: (tour: TourKey) => boolean;
  /** Abre o overlay. Só o `TourTrigger` chama, e só depois do `claimTour`. */
  open: (tour: TourKey, steps: TourStep[]) => void;
  /**
   * Qual tour está na tela, ou `null`.
   *
   * É lido de fora da pasta: a pesquisa de satisfação (`FeedbackPrompt`)
   * espera o tour acabar antes de contar o próprio atraso. Duas janelas
   * pedindo atenção na mesma tela não são duas perguntas, são uma parede.
   */
  activeTour: TourKey | null;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  // Fora do provider ninguém deve rodar tour, e ninguém deve quebrar por
  // causa disso: as telas públicas e o /admin não têm este provider.
  return ctx ?? FALLBACK;
}

const FALLBACK: TourContextValue = {
  canRun: () => false,
  open: () => {},
  activeTour: null,
};

export function TourProvider({ seen, children }: { seen: TourSeenMap; children: ReactNode }) {
  const [seenMap, setSeenMap] = useState<TourSeenMap>(seen);
  const [active, setActive] = useState<ActiveTour | null>(null);

  const canRun = useCallback((tour: TourKey) => shouldRunTour(seenMap, tour), [seenMap]);

  const open = useCallback((tour: TourKey, steps: TourStep[]) => {
    if (steps.length === 0) return;
    setActive({ tour, steps });
  }, []);

  /**
   * O fim, pelos dois caminhos. O `seenMap` é atualizado ANTES da rede: a
   * linha já foi gravada lá atrás, no `claimTour`, e o que esta chamada leva
   * é só o desfecho. Esperar por ela para esconder o balão seria pagar uma
   * viagem de rede por nada.
   */
  const close = useCallback((tour: TourKey, step: number, outcome: "completed" | "dismissed") => {
    setSeenMap((prev) => ({ ...prev, [tour]: TOURS[tour].version }));
    setActive(null);
    finishTour({ tour, step, outcome });
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ canRun, open, activeTour: active?.tour ?? null }),
    [canRun, open, active]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? (
        <TourRunner
          key={active.tour}
          steps={active.steps}
          onClose={(step, outcome) => close(active.tour, step, outcome)}
        />
      ) : null}
    </TourContext.Provider>
  );
}
