"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackDialog } from "@/features/feedback/components/FeedbackDialog";
import { checkFeedbackPrompt, type FeedbackPromptInfo } from "@/features/feedback/lib/api";
import { useTour } from "@/features/tour/components/TourProvider";

type Props = {
  kind: "recording" | "study";
  sessionId: string;
  /** Ver `src/features/feedback/config.ts`, um valor por superfície. */
  delayMs: number;
};

/**
 * O gatilho da pesquisa, montado nas telas de RESULTADO: resumo salvo,
 * transcrição salva e estudo. Não desenha nada até o servidor dizer que é a
 * 1ª, a 3ª ou a 8ª vez.
 *
 * Ele pergunta ao servidor DEPOIS do atraso, não antes. É uma inversão que
 * parece detalhe e não é: a chamada é o que REGISTRA a pergunta
 * (`feedback_prompts`), então perguntar cedo e esperar para mostrar gastaria o
 * marco de alguém que fechou a aba em três segundos, e aquela pessoa nunca
 * mais seria perguntada sobre a primeira gravação da vida dela.
 *
 * Por isso também o `cancelled`: sair da página antes do prazo não consome
 * nada. O marco continua lá para a próxima visita.
 *
 * A aba escondida (celular bloqueado no bolso enquanto o resumo termina) é
 * tratada como saída: a janela abriria sem ninguém para vê-la, e o marco
 * queimaria em silêncio. Ela volta na próxima abertura da tela.
 *
 * **O TOUR TEM PREFERÊNCIA, e a pesquisa espera.** As duas coisas moram nas
 * mesmas telas (`/summary`, `/deepening`) e as duas abrem sozinhas; juntas,
 * não são duas perguntas, são uma parede. Enquanto um tour está aberto o
 * relógio daqui nem começa, e ele recomeça do zero quando a tela fica livre,
 * o que também protege o marco: perguntar não é só mostrar uma janela, é
 * GASTAR a 1ª, a 3ª ou a 8ª gravação da vida de alguém, e gastá-la atrás de um
 * balão é gastá-la sem receber resposta nenhuma. Quem cede é a pesquisa porque
 * o tour é uma vez na vida e ela ainda terá outros dois marcos.
 */
export function FeedbackPrompt({ kind, sessionId, delayMs }: Props) {
  const [prompt, setPrompt] = useState<FeedbackPromptInfo | null>(null);
  const [open, setOpen] = useState(false);
  // Guarda contra a montagem dupla do StrictMode em dev: sem ele, a primeira
  // chamada registra a pergunta e a segunda recebe "já perguntei".
  const firedRef = useRef(false);
  const { activeTour } = useTour();

  useEffect(() => {
    if (firedRef.current || activeTour !== null) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      firedRef.current = true;
      const info = await checkFeedbackPrompt({ kind, sessionId });
      if (cancelled || !info) return;
      setPrompt(info);
      setOpen(true);
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, sessionId, delayMs, activeTour]);

  if (!prompt) return null;

  return (
    <FeedbackDialog
      open={open}
      onOpenChange={setOpen}
      surface={prompt.surface}
      topics={prompt.topics}
      promptId={prompt.promptId}
    />
  );
}
