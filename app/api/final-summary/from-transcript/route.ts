import { NextResponse } from "next/server";
import { z } from "zod";
import { chargeCoins } from "@/lib/db/coins";
import { getSession, updateSessionSummary } from "@/lib/db/sessions";
import { generateFinalSummary } from "@/lib/final-summary/generate";
import { generateAndSaveHighlights } from "@/lib/highlights/save";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateAndSaveReminders } from "@/lib/reminders/save";
import { generateAndSaveRereads } from "@/lib/rereads/save";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("final-summary-from-transcript");

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/final-summary/from-transcript
 *
 * Gera o resumo final de uma sessão que foi gravada no modo transcrição e
 * portanto nunca teve um. Roda `generateFinalSummary` sobre a transcrição já
 * salva na linha — sem `feedItems`, porque aquele modo não tem feed — e grava
 * o payload, mais releia / lembra / frases marcantes, exatamente como as
 * outras duas rotas de resumo.
 *
 * ## Por que existe
 *
 * O modo transcrição foi desenhado como o modo BARATO: só STT, nenhuma chamada
 * de LLM, e a página salva prometia isso. Mas a escolha do modo é feita ANTES
 * da pregação, e a pessoa só descobre que queria o resumo depois de ouvi-la.
 * Sem esta rota, a única saída era gravar de novo — impossível. A promessa que
 * o modo faz é sobre o que ele COBRA por minuto, não sobre o que nunca poderá
 * ser feito com o texto depois.
 *
 * ## Ordem
 *
 * A conferência de dono vem antes da cobrança, e a cobrança antes do modelo —
 * mesmo padrão de `/reprocess` e `/api/deepening`. O 409 de
 * `session_already_summarized` é o que impede pagar duas vezes pelo mesmo
 * trabalho: quem quer refazer um resumo que já existe usa `/reprocess`, e é lá
 * que a semântica de sobrescrever mora.
 *
 * Uma falha do modelo DEPOIS da cobrança não estorna, também como as outras —
 * a alternativa (cobrar no fim) deixa a chamada cara acontecer com saldo zero.
 *
 * ## O modo NÃO é conferido, e isso é deliberado
 *
 * A condição que importa é "encerrada e sem resumo", não "é do modo
 * transcrição". Uma sessão `audio_only` cujo `updateSessionFinal` falhou sai da
 * gravação exatamente nesse estado (o `/api/final-summary` loga "save failed" e
 * devolve o payload assim mesmo), e esta rota é o único caminho de recuperação
 * que ela tem. Exigir o modo trocaria uma recuperação por um beco.
 *
 * O preço disso é que o motivo `summary_from_transcript` no ledger mede "sessão
 * encerrada que ganhou resumo depois", e não estritamente "modo transcrição" —
 * o botão só existe em `/transcript`, então na prática as duas coisas coincidem,
 * mas quem for ler aquele número deve saber da diferença.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(
    request,
    RATE_LIMITS["final-summary-from-transcript"],
    auth.user.id
  );
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const sessionId = parsed.data.sessionId;

  // `getSession` passa pela RLS: sessão de outra pessoa volta null, e a rota
  // cara morre aqui em vez de depois de pagar a OpenAI.
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.endedAt) {
    return NextResponse.json({ error: "session_not_finished" }, { status: 409 });
  }
  if (session.finalSummary) {
    return NextResponse.json({ error: "session_already_summarized" }, { status: 409 });
  }
  const transcript = session.transcript.trim();
  if (!transcript) {
    return NextResponse.json({ error: "empty_transcript" }, { status: 409 });
  }

  const charge = await chargeCoins("summary_from_transcript", sessionId, auth.user.id);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    log.error("charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const result = await generateFinalSummary({
    userId: auth.user.id,
    sessionId,
    transcript,
    // Vazio, e não `session.feedItems`: o modo transcrição não roda nenhum dos
    // pipelines ao vivo, então a coluna é sempre `[]`. Deixar explícito aqui
    // evita a leitura de que houve feed e ele foi descartado.
    feedItems: [],
    logPrefix: "final-summary-from-transcript",
    metadataRoute: "final-summary-from-transcript",
  });

  if (!result.ok) {
    if (result.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.message, latencyMs: result.latencyMs },
      { status: 502 }
    );
  }

  const { payload, latencyMs, model } = result;

  // `keepTitle` quando a pessoa já nomeou a gravação. No modo transcrição o
  // título da linha é sempre humano — ou o que ela digitou no cabeçalho, ou o
  // "Gravação dia N de mês" que o cliente gera no stop —, então o único caso em
  // que o título do resumo é uma melhora é o da linha sem título nenhum.
  const keepTitle = !!session.title?.trim();

  let saved = false;
  try {
    await updateSessionSummary(sessionId, payload, { keepTitle });
    saved = true;
    log.debug("saved", { sessionId });
  } catch (err) {
    log.error("save failed", { sessionId, error: (err as Error).message });
  }

  // Best-effort, mesmo padrão das outras duas rotas: releia (10 versículos),
  // lembra (10 mini-callbacks) e frases marcantes (até 12, sem IA). Nenhuma
  // delas falhando derruba o resumo — a UI trata payload ausente como normal.
  const [rereads, reminders, highlights] = await Promise.all([
    generateAndSaveRereads({
      userId: auth.user.id,
      sessionId,
      transcript,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "rereads-from-transcript",
      metadataRoute: "rereads-from-transcript",
    }),
    generateAndSaveReminders({
      userId: auth.user.id,
      sessionId,
      transcript,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "reminders-from-transcript",
      metadataRoute: "reminders-from-transcript",
    }),
    generateAndSaveHighlights({
      sessionId,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "highlights-from-transcript",
    }),
  ]);

  return NextResponse.json({
    ...payload,
    latencyMs,
    model,
    sessionId,
    saved,
    rereads,
    reminders,
    highlights,
  });
}
