import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveBibloAllowance } from "@/features/session/server/biblo/allowance";
import { generateBibloAnswer } from "@/features/session/server/biblo/answer";
import {
  countBibloConversation,
  shouldIntroduceBiblo,
} from "@/features/session/server/biblo/intro";
import { buildBibloOpening } from "@/features/session/server/biblo/opening";
import { type BibloRow, insertBibloMessage, listBibloRows } from "@/lib/db/biblo";
import { chargeCoins } from "@/lib/db/coins";
import { getSessionView } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import {
  BIBLO_MAX_QUESTION_CHARS,
  type BibloConversation,
  type BibloMessage,
  type BibloTurn,
} from "@/lib/domain/biblo";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("biblo");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uma mensagem é UMA chamada a um modelo não-raciocinador: 2 a 4 segundos no
// caso normal. 60 é folga para a cauda, não expectativa — se uma conversa
// chegar perto disso, o problema é o modelo escolhido, não este número.
export const maxDuration = 60;

const PostSchema = z
  .object({
    sessionId: UuidSchema,
    text: z.string().trim().min(1).max(BIBLO_MAX_QUESTION_CHARS),
  })
  .strict();

/** O que vai para a gaveta. `thread` e `billing` ficam no servidor. */
function toMessage(row: BibloRow): BibloMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    chips: row.chips,
    suggestion: row.suggestion,
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/biblo?sessionId=…
 *
 * A conversa guardada, a abertura e o que a pessoa pode fazer agora. Fechar a
 * gaveta não joga nada fora (`biblo.md` §3): reabrir no dia seguinte, em outro
 * aparelho, mostra a conversa onde ela parou.
 *
 * **Não cobra, não chama modelo e não grava nada.** A abertura é derivada do
 * resumo (ver `biblo/opening.ts`), então abrir a gaveta é de graça em todos os
 * sentidos da palavra.
 *
 * **E ela não exige que a sessão EXISTA.** No `/escrever` o id é sorteado no
 * aparelho quando a folha abre, e a linha só nasce no primeiro salvamento — que
 * só acontece depois de a pessoa digitar (ver `escrever/useWrittenDraft.ts`,
 * que mantém de propósito a invariante "linha vazia no banco é impossível").
 * Um 404 aqui tirava o Biblo da tela exatamente no momento em que ele é mais
 * útil: a folha em branco, onde a conversa dele É "sobre o que você quer
 * escrever?".
 *
 * Responder com a conversa vazia não conta nada a ninguém: um id que não existe
 * e o id de outra pessoa devolvem a MESMA coisa (a RLS esconde o segundo), então
 * a rota não vira um oráculo de "esta sessão existe". Quem confere dono é o
 * `POST`, que é onde alguma coisa acontece.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !UuidSchema.safeParse(sessionId).success) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }

  const [session, rows, allowance, introduce] = await Promise.all([
    getSessionView(sessionId),
    listBibloRows(sessionId),
    resolveBibloAllowance(auth.user.id),
    shouldIntroduceBiblo(),
  ]);

  const body: BibloConversation = {
    messages: rows.map(toMessage),
    opening: buildBibloOpening({
      summary: session?.finalSummary ?? null,
      speakerName: session?.speakerName ?? null,
      firstName: auth.user.firstName,
      // O `/escrever` é o único modo em que o texto na tela é de quem está
      // lendo esta frase — e é o que decide entre "escrevendo" e "lendo". Sem
      // linha no banco só se chega aqui pelo `/escrever`, então `true`.
      authored: session ? session.mode === "manual" : true,
      introduce,
    }),
    allowance,
  };
  return NextResponse.json(body);
}

/**
 * POST /api/biblo — uma pergunta, uma resposta.
 *
 * A ordem das operações é a coisa mais importante deste arquivo:
 *
 *   1. auth → rate limit → a sessão é dela?
 *   2. o que ela pode (presente / moedas / nada)
 *   3. **cobra ANTES de chamar o modelo.** Um 402 aqui não gastou token
 *      nenhum, que é a mesma decisão de `/api/deepening`. O débito não volta
 *      se o upstream falhar depois — aqui isso custa 2 moedas ao usuário, e
 *      duas moedas não pagam a complexidade de um estorno.
 *   4. **grava a PERGUNTA antes de chamar o modelo.** Se o modelo falhar, o
 *      que a pessoa escreveu continua na conversa, com um aviso no lugar da
 *      resposta — em vez de sumir da tela levando o texto junto.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.biblo, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, PostSchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId, text } = parsed.data;

  // A RLS é o dono da resposta: uma sessão de outra pessoa simplesmente não
  // volta desta leitura.
  const session = await getSessionView(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  const allowance = await resolveBibloAllowance(auth.user.id);
  if (allowance.kind === "denied") {
    return NextResponse.json(
      { error: "biblo_not_available", reason: allowance.reason },
      { status: 403 }
    );
  }

  let balance: number | null = auth.user.coinBalance;
  if (allowance.kind === "coins") {
    const charge = await chargeCoins("biblo_message", sessionId, auth.user.id);
    if (!charge.ok) {
      if (charge.error === "insufficient_balance") {
        return NextResponse.json(
          { error: "biblo_not_available", reason: "insufficient_balance" },
          { status: 402 }
        );
      }
      log.error("charge failed", { error: charge.error, message: charge.message });
      return NextResponse.json({ error: "charge_failed" }, { status: 500 });
    }
    balance = charge.balance;
  }

  const history = await listBibloRows(sessionId);

  // Conversa nova: o contador da apresentação sobe UMA vez, aqui, e não a cada
  // mensagem — ver o cabeçalho de `biblo/intro.ts`. Vem antes da chamada ao
  // modelo porque é só um `Set-Cookie`, e depois do débito porque uma conversa
  // que não chegou a ser cobrada não é uma conversa.
  if (history.length === 0) await countBibloConversation();

  const question = await insertBibloMessage({
    sessionId,
    userId: auth.user.id,
    role: "user",
    content: text,
    billing: allowance.kind === "gift" ? "gift" : "coins",
  });

  const result = await generateBibloAnswer({
    userId: auth.user.id,
    sessionId,
    summary: session.finalSummary,
    speakerName: session.speakerName,
    history,
    question: text,
  });

  if (!result.ok) {
    log.error("resposta falhou", { kind: result.kind, message: result.message });
    return NextResponse.json(
      { error: "biblo_failed", kind: result.kind, questionId: question.id },
      { status: result.kind === "upstream" ? 502 : 500 }
    );
  }

  const { reply, model, usage, latencyMs } = result.data;

  const answer = await insertBibloMessage({
    sessionId,
    userId: auth.user.id,
    role: "assistant",
    content: reply.answer,
    chips: reply.chips,
    suggestion: reply.suggestion,
    thread: reply.thread,
  });

  await recordChatUsage({
    userId: auth.user.id,
    sessionId,
    route: "biblo",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });

  // O allowance devolvido é o de DEPOIS desta mensagem: é o que faz a gaveta
  // dizer a linha de agradecimento na última do presente sem ter de recontar.
  const next =
    allowance.kind === "gift"
      ? ({ kind: "gift", remaining: Math.max(0, allowance.remaining - 1) } as const)
      : allowance;

  const body: BibloTurn = {
    question: toMessage(question),
    answer: toMessage(answer),
    allowance: next,
    balance,
  };
  return NextResponse.json(body);
}
