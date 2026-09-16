"use client";

import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { formatMmSs } from "@/features/session/lib/text";

/**
 * O tempo de gravação, compartilhado entre o RELÓGIO (que mora na `TopBar`) e a
 * CAPTURA (que mora no `AudioStudio`).
 *
 * Mesmo desenho do `SearchScope` da Biblioteca, e pela mesma razão: os dois
 * estão em ramos diferentes da árvore com um server component no meio, então o
 * provider precisa envolvê-los na PÁGINA.
 *
 * **O provider guarda a ORIGEM, não o tempo.** Quem conta os segundos é o
 * `RecordingClock`, com o seu próprio `useElapsedTimer`. Subir o contador para
 * cá faria o `AudioStudio` inteiro re-renderizar uma vez por segundo durante a
 * pregação — inclusive a onda, que é desenhada fora do React justamente para
 * não passar por ele.
 */
type ClockScopeValue = {
  /** `performance.now()` ANCORADO: já descontado o tempo pausado, então
   * `agora - startedAt` é sempre o tempo ativo de gravação. */
  startedAtRef: React.RefObject<number>;
  running: boolean;
  setRunning: (running: boolean) => void;
  /** Continua visível na pausa, congelado. Só some ao voltar para o repouso. */
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const ClockScopeContext = createContext<ClockScopeValue | null>(null);

export function ClockScope({ children }: { children: ReactNode }) {
  const startedAtRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  const value = useMemo(
    () => ({ startedAtRef, running, setRunning, visible, setVisible }),
    [running, visible]
  );
  return <ClockScopeContext.Provider value={value}>{children}</ClockScopeContext.Provider>;
}

export function useClockScope(): ClockScopeValue {
  const ctx = useContext(ClockScopeContext);
  if (!ctx) throw new Error("useClockScope precisa estar dentro de <ClockScope>");
  return ctx;
}

/**
 * O relógio no canto direito do cabeçalho.
 *
 * Cinza translúcido, o mesmo tratamento da onda: ele acompanha a gravação sem
 * disputar atenção com ela. `tabular-nums` porque dígito de largura variável faz
 * o número tremer a cada segundo.
 *
 * Fora da gravação ele vira um vão da mesma largura, e não desaparece: sumir
 * encolheria o cabeçalho e faria o título escorregar para a direita bem no
 * instante em que a pessoa aperta parar.
 */
export function RecordingClock() {
  const { startedAtRef, running, visible } = useClockScope();
  const elapsedMs = useElapsedTimer(running, startedAtRef);

  // `w-11` é a largura do vão padrão da `TopBar`, e mantê-la é o que impede o
  // título de escorregar ao trocar entre a Biblioteca e esta tela. "00:00" em
  // `tabular-nums` cabe com folga; só passaria de 99 minutos, e aí a gravação
  // já virou duas partes.
  if (!visible) return <span aria-hidden className="w-11 shrink-0" />;
  return (
    <span
      role="timer"
      aria-label="Tempo de gravação"
      className="w-11 shrink-0 text-right text-[15px] font-light text-v2-wave/50 tabular-nums"
    >
      {formatMmSs(elapsedMs)}
    </span>
  );
}
