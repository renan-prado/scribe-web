"use client";

import { useEffect, useRef } from "react";
import { useTour } from "@/features/tour/components/TourProvider";
import { resolveSteps } from "@/features/tour/lib/anchors";
import { startTour } from "@/features/tour/lib/api";
import { TOURS, type TourKey } from "@/lib/domain/tour";

type Props = {
  tour: TourKey;
  /** Ver `src/features/tour/config.ts`, um valor por tipo de tela. */
  delayMs: number;
  /**
   * O portão da própria tela. A captura passa `!hasStarted`: um tour aberto
   * por cima de uma pregação em andamento é o pior defeito que esta pasta
   * poderia ter, e ele não é um risco teórico, `autostart=1` faz a gravação
   * começar sozinha ao chegar na página.
   */
  enabled?: boolean;
};

/**
 * O gatilho, montado no fim de cada tela que tem tour. Não desenha nada.
 *
 * A ordem das quatro coisas que ele faz é o desenho inteiro:
 *
 * 1. **Espera.** Nada acontece antes do atraso. Uma tela ainda montando com um
 *    balão por cima ensina a procurar o X.
 * 2. **Olha a tela.** `resolveSteps` deixa só os passos cujo alvo existe. Se
 *    não sobrar nenhum, ele desiste SEM falar com o servidor: a tela ainda não
 *    tem o que mostrar, e o tour espera a próxima visita.
 * 3. **Pergunta ao servidor**, que responde e grava na mesma chamada.
 * 4. **Abre.**
 *
 * Perguntar DEPOIS do atraso, e não antes, é a mesma inversão do
 * `FeedbackPrompt`: a chamada é o que REGISTRA o tour, então perguntar cedo e
 * esperar para mostrar gastaria a apresentação de quem fechou a aba em dois
 * segundos. Sair da página antes do prazo não consome nada, e aba escondida
 * (celular no bolso) é tratada como saída.
 *
 * **Um tour por vez.** Enquanto outro estiver aberto, este nem começa a
 * contar; ele volta a contar quando a tela ficar livre. Só acontece se alguém
 * montar dois gatilhos na mesma página, e é exatamente aí que o balão
 * empilhado apareceria.
 */
export function TourTrigger({ tour, delayMs, enabled = true }: Props) {
  const { canRun, open, activeTour } = useTour();
  // Guarda contra a montagem dupla do StrictMode em dev: sem ele, a primeira
  // chamada registra o tour e a segunda ouve "já mostrei".
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current || activeTour !== null || !canRun(tour)) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (cancelled || document.visibilityState !== "visible") return;

      const steps = resolveSteps(TOURS[tour].steps);
      if (steps.length === 0) return;

      firedRef.current = true;
      const run = await startTour(tour);
      if (!run || cancelled) return;
      open(tour, steps);
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tour, delayMs, enabled, canRun, open, activeTour]);

  return null;
}
