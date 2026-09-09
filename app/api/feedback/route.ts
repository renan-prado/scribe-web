import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type FeedbackAnswer,
  loadOpenFeedbackPrompt,
  saveFeedbackResponse,
} from "@/lib/db/feedback";
import {
  FEEDBACK_RATINGS,
  FEEDBACK_TOPICS,
  FEEDBACK_TOPICS_BY_SURFACE,
  MAX_FEEDBACK_COMMENT_CHARS,
} from "@/lib/domain/feedback";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("feedback");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    /**
     * A pergunta que o servidor abriu. Ausente no feedback do /profile, que
     * não nasce de pergunta nossa — é a pessoa que procurou o botão.
     */
    promptId: UuidSchema.optional(),
    answers: z
      .array(
        z.object({ topic: z.enum(FEEDBACK_TOPICS), rating: z.enum(FEEDBACK_RATINGS) }).strict()
      )
      .min(1)
      .max(FEEDBACK_TOPICS.length),
    comment: z.string().trim().max(MAX_FEEDBACK_COMMENT_CHARS).optional(),
  })
  .strict();

/**
 * POST /api/feedback — a nota que o usuário deu.
 *
 * O corpo carrega o MÍNIMO: qual pergunta, as notas e o texto. Superfície e
 * sessão são reconstruídas a partir da linha de `feedback_prompts` que o
 * próprio servidor escreveu (`loadOpenFeedbackPrompt`) — um corpo que
 * afirmasse "isto é sobre o estudo da sessão X" não teria como ser desmentido,
 * e a tabela que orienta o roadmap passaria a aceitar o que o navegador
 * quisesse dizer.
 *
 * Sem `promptId`, o envio é o feedback geral do /profile: superfície
 * `general`, tópico `overall`, sem sessão. É o único caminho em que o usuário
 * escolhe a hora.
 *
 * Não cobra moedas, pela mesma razão de `/api/hallucination-report`: quem está
 * nos ajudando a melhorar o produto não paga por isso.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["feedback-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { promptId, answers, comment } = parsed.data;

  const context = promptId
    ? await loadOpenFeedbackPrompt({ userId: auth.user.id, promptId })
    : { surface: "general" as const, sessionId: null };

  // Pergunta de outra pessoa, inexistente, ou já respondida. As três são o
  // mesmo "não" para quem chama: nada é gravado duas vezes.
  if (!context) return NextResponse.json({ error: "prompt_unavailable" }, { status: 409 });

  // Os tópicos têm de ser os DAQUELA superfície. Sem esta conferência, o envio
  // de uma sessão do modo transcrição poderia carimbar uma nota em
  // `live_suggestions`, e a média do painel passaria a incluir a opinião de
  // quem nunca viu um card ao vivo.
  const allowed = FEEDBACK_TOPICS_BY_SURFACE[context.surface];
  const seen = new Set<string>();
  for (const answer of answers) {
    if (!allowed.includes(answer.topic) || seen.has(answer.topic)) {
      return NextResponse.json({ error: "topic_mismatch" }, { status: 400 });
    }
    seen.add(answer.topic);
  }

  try {
    await saveFeedbackResponse({
      userId: auth.user.id,
      surface: context.surface,
      sessionId: context.sessionId,
      promptId: promptId ?? null,
      answers: answers as FeedbackAnswer[],
      comment: comment?.trim() ? comment.trim() : null,
    });
  } catch (err) {
    log.error("falha ao gravar", { error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  log.debug("ok", { surface: context.surface, topics: answers.length });
  return NextResponse.json({ ok: true });
}
