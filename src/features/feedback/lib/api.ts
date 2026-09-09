import type { FeedbackRating, FeedbackSurface, FeedbackTopic } from "@/lib/domain/feedback";

/**
 * As duas chamadas do feedback, do lado do navegador.
 *
 * As duas FALHAM EM SILÊNCIO por desenho. A janela é um extra sobre uma tela
 * que já entregou o que a pessoa veio buscar: um erro de rede não pode virar
 * um toast vermelho sobre o resumo que ela acabou de gerar. O que se perde é
 * uma resposta; o que se protege é a leitura.
 */

export type FeedbackPromptInfo = {
  promptId: string;
  surface: FeedbackSurface;
  topics: FeedbackTopic[];
  ordinal: number;
};

/**
 * "Devo perguntar agora?". Devolve `null` na esmagadora maioria das chamadas —
 * é o caminho normal, não um erro.
 */
export async function checkFeedbackPrompt(body: {
  kind: "recording" | "study";
  sessionId: string;
}): Promise<FeedbackPromptInfo | null> {
  try {
    const res = await fetch("/api/feedback/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { prompt?: FeedbackPromptInfo | null };
    return payload?.prompt ?? null;
  } catch {
    return null;
  }
}

/** Envia as notas. `true` quando gravou. */
export async function submitFeedback(body: {
  promptId?: string;
  answers: Array<{ topic: FeedbackTopic; rating: FeedbackRating }>;
  comment?: string;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
