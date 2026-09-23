"use client";

import { useRef, useState } from "react";
import type { BibloDockHandle } from "@/features/session/components/BibloDock";
import { BibloSummaryDock } from "@/features/session/components/BibloSummaryDock";
import { MobileActionBar } from "../../components/MobileActionBar";

/**
 * O `/summary` no celular: a `MobileActionBar` por cima do `BibloSummaryDock`,
 * que continua dono da conversa e de escrever no resumo — só não desenha mais
 * o próprio disco no celular. Ver o cabeçalho de `BibloDock`
 * ("O gatilho no celular mudou de dono").
 *
 * A busca daqui é a GLOBAL (`GlobalSearchDialog`), não uma busca própria desta
 * tela: a lupa da `TopBar` já é outra coisa, procura DENTRO do resumo
 * (`SummaryFindToggle`).
 */
export function SummaryMobileDock({ sessionId }: { sessionId: string }) {
  const bibloRef = useRef<BibloDockHandle>(null);
  const [bibloThinking, setBibloThinking] = useState(false);

  return (
    <>
      <MobileActionBar onAskBiblo={() => bibloRef.current?.open()} bibloThinking={bibloThinking} />
      <BibloSummaryDock
        ref={bibloRef}
        sessionId={sessionId}
        hideMobileTrigger
        onThinkingChange={setBibloThinking}
      />
    </>
  );
}
