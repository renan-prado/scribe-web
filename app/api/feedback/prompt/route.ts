import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveFeedbackPrompt } from "@/lib/db/feedback";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("feedback/prompt");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    kind: z.enum(["recording", "study"]),
    sessionId: UuidSchema,
  })
  .strict();

/**
 * POST /api/feedback/prompt, "devo perguntar agora?"
 *
 * POST, e não GET, porque ela ESCREVE: quando a resposta é sim, a pergunta já
 * nasce registrada em `feedback_prompts`. É o que impede a janela de voltar
 * quando a pessoa reabre a mesma página, e um GET que grava seria disparado
 * por qualquer prefetch do router.
 *
 * O cliente não manda ordinal, marco nem superfície, ele diz apenas qual
 * sessão está na tela. Tudo o que decide mora em `resolveFeedbackPrompt`; do
 * contrário o navegador escolheria quando é perguntado, e a amostra deixaria
 * de ser a que escolhemos medir.
 *
 * A resposta normal é `{ prompt: null }`. Só três gravações e três estudos na
 * vida de cada usuário devolvem outra coisa.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["feedback-prompt"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const prompt = await resolveFeedbackPrompt({
      userId: auth.user.id,
      kind: parsed.data.kind,
      sessionId: parsed.data.sessionId,
    });
    return NextResponse.json({ prompt });
  } catch (err) {
    // A janela é um extra sobre uma tela que já entregou o que a pessoa veio
    // buscar. Um erro aqui vira "não perguntar" e some, derrubar a leitura do
    // resumo por causa da pesquisa de satisfação seria trocar o produto pela
    // medição dele.
    log.error("falha ao resolver pergunta", { error: (err as Error).message });
    return NextResponse.json({ prompt: null });
  }
}
