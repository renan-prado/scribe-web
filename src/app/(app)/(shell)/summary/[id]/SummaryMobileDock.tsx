"use client";

import { useRef, useState } from "react";
import { EditGlyph } from "@/components/icons/EditGlyph";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";
import type { BibloDockHandle } from "@/features/session/components/BibloDock";
import { BibloSummaryDock } from "@/features/session/components/BibloSummaryDock";
import { useSummaryFind } from "@/features/session/components/SummaryFind";
import { MOBILE_BAR_BUTTON_CLASS, MobileActionBar } from "../../components/MobileActionBar";

/**
 * O `/summary` no celular: a `MobileActionBar` por cima do `BibloSummaryDock`,
 * que continua dono da conversa e de escrever no resumo — só não desenha mais
 * o próprio disco no celular. Ver o cabeçalho de `BibloDock`
 * ("O gatilho no celular mudou de dono").
 *
 * **A busca daqui é a do RESUMO ABERTO** (`SummaryFind`), a mesma que a lupa da
 * `TopBar` abre — e não a busca global do acervo, que é o que ela já foi. Sobre
 * um texto longo, uma lupa promete procurar dentro dele; a lupa do cabeçalho
 * cumpria essa promessa e a da barra de baixo, que é a única visível no
 * celular, levava para o acervo. Quem quer o acervo tem o voltar, que é por
 * onde entrou.
 *
 * **E a ponta direita é EDITAR**, no lugar do "+" com as três portas de
 * criação. Criar a próxima sessão a partir de um sermão aberto é raro; corrigir
 * o nome que a IA errou é o gesto da vez, e ele só existia na pastilha do
 * cabeçalho, do outro lado da tela em relação ao polegar. É o MESMO destino
 * (`/summary/{id}/edit`) e o mesmo `NavLink` com pena girando: o editor é um pedaço
 * grande de JavaScript, e sem resposta nenhuma no toque a reação natural é
 * tocar de novo.
 *
 * `canEdit` vem da página, e é a existência do resumo: sem payload não há o que
 * abrir no editor, e ali a ponta volta a ser o "+".
 */
export function SummaryMobileDock({ sessionId, canEdit }: { sessionId: string; canEdit: boolean }) {
  const bibloRef = useRef<BibloDockHandle>(null);
  const [bibloThinking, setBibloThinking] = useState(false);
  const { open, toggle } = useSummaryFind();

  return (
    <>
      <MobileActionBar
        onAskBiblo={() => bibloRef.current?.open()}
        bibloThinking={bibloThinking}
        onSearch={toggle}
        searchOpen={open}
        searchLabel="Procurar neste resumo"
        trailing={
          canEdit ? (
            <NavLink
              href={`/summary/${sessionId}/edit`}
              prefetchOnPress
              spinner="none"
              aria-label="Editar este resumo"
              contentClassName="inline-flex items-center justify-center"
              className={MOBILE_BAR_BUTTON_CLASS}
            >
              <LinkPendingSwap className="size-5">
                <EditGlyph className="size-5" />
              </LinkPendingSwap>
            </NavLink>
          ) : undefined
        }
      />
      <BibloSummaryDock
        ref={bibloRef}
        sessionId={sessionId}
        hideMobileTrigger
        onThinkingChange={setBibloThinking}
      />
    </>
  );
}
