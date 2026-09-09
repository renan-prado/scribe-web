"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackDialog } from "@/features/feedback/components/FeedbackDialog";
import { checkFeedbackPrompt, type FeedbackPromptInfo } from "@/features/feedback/lib/api";

type Props = {
  kind: "recording" | "study";
  sessionId: string;
  /** Ver `src/features/feedback/config.ts` — um valor por superfície. */
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
 * marco de alguém que fechou a aba em três segundos — e aquela pessoa nunca
 * mais seria perguntada sobre a primeira gravação da vida dela.
 *
 * Por isso também o `cancelled`: sair da página antes do prazo não consome
 * nada. O marco continua lá para a próxima visita.
 *
 * A aba escondida (celular bloqueado no bolso enquanto o resumo termina) é
 * tratada como saída: a janela abriria sem ninguém para vê-la, e o marco
 * queimaria em silêncio. Ela volta na próxima abertura da tela.
 */
export function FeedbackPrompt({ kind, sessionId, delayMs }: Props) {
  const [prompt, setPrompt] = useState<FeedbackPromptInfo | null>(null);
  const [open, setOpen] = useState(false);
  // Guarda contra a montagem dupla do StrictMode em dev: sem ele, a primeira
  // chamada registra a pergunta e a segunda recebe "já perguntei".
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
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
  }, [kind, sessionId, delayMs]);

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
