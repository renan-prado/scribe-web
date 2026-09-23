"use client";

import { useRef, useState } from "react";
import type { BibloDockHandle } from "@/features/session/components/BibloDock";
import { BibloHomeDock } from "@/features/session/components/BibloHomeDock";
import { MobileActionBar } from "../components/MobileActionBar";

/**
 * A Biblioteca no celular: uma `MobileActionBar` (busca, Biblo, criar) e o
 * `BibloHomeDock` por baixo dela — ele continua dono da conversa e das
 * ferramentas que ESCREVEM um documento (ver o cabeçalho de lá), só não
 * desenha mais o próprio disco no celular.
 *
 * Este arquivo existe porque o estado que os liga (o `ref` que abre a gaveta,
 * o `thinking` que a barra mostra) é do CLIENTE, e `home/page.tsx` é
 * servidor — precisa de um componente cliente para os dois dividirem o mesmo
 * estado sem escalar tudo até a página. A busca da `MobileActionBar` não
 * precisa mais de estado nenhum daqui: ela abre o `GlobalSearchDialog`
 * direto pela `GlobalSearchStore`.
 */
export function HomeDockBar() {
  const bibloRef = useRef<BibloDockHandle>(null);
  const [bibloThinking, setBibloThinking] = useState(false);

  return (
    <>
      <MobileActionBar onAskBiblo={() => bibloRef.current?.open()} bibloThinking={bibloThinking} />
      {/* O Biblo na Biblioteca é o único que ESCREVE um documento em vez de
          sugerir um bloco: aqui não há texto na tela para receber sugestão.
          Ver `BibloHomeDock`. */}
      <BibloHomeDock ref={bibloRef} hideMobileTrigger onThinkingChange={setBibloThinking} />
    </>
  );
}
