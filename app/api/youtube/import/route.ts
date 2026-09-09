import { NextResponse } from "next/server";
import { z } from "zod";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { chargeCoins } from "@/lib/db/coins";
import { getSession, updateSessionSummary, updateSessionTranscript } from "@/lib/db/sessions";
import {
  parseYoutubeUrl,
  YOUTUBE_MAX_DURATION_MS,
  YOUTUBE_MIN_TRANSCRIPT_CHARS,
} from "@/lib/domain/youtube";
import { generateFinalSummary } from "@/lib/final-summary/generate";
import { generateAndSaveHighlights } from "@/lib/highlights/save";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateAndSaveReminders } from "@/lib/reminders/save";
import { generateAndSaveRereads } from "@/lib/rereads/save";
import { requireAuth } from "@/lib/supabase/require-auth";
import { cleanYoutubeMetadata } from "@/lib/youtube/metadata";
import { fetchYoutubeVideoInfo } from "@/lib/youtube/oembed";
import { fetchYoutubeTranscript } from "@/lib/youtube/transcript";

const log = createLogger("youtube-import");

const BodySchema = z.object({ sessionId: UuidSchema }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * O mesmo teto das rotas do estudo. Uma importação é legenda (1-3s) mais o
 * pipeline inteiro do resumo sobre uma transcrição que pode ter duas horas de
 * pregação — o padrão de 60s não cobre isso, e estourar a função DEPOIS de
 * debitar as 25 moedas é o pior desfecho possível.
 */
export const maxDuration = 300;

/**
 * POST /api/youtube/import
 *
 * Transforma um vídeo do YouTube numa sessão salva: busca a legenda pelo
 * provedor, grava como transcrição, e roda por cima o MESMO pipeline de
 * `/api/final-summary/from-transcript` — resumo, releia, lembra e frases
 * marcantes. Sem áudio, sem chunks, sem STT.
 *
 * A linha da sessão já existe quando esta rota é chamada: o diálogo a criou
 * com `mode: "youtube"` e a URL em `source_url`, e o cliente foi para
 * `/recording/:id/youtube`, que dispara isto. Essa ordem é o que faz um reload
 * no meio da importação não perder nada — e é a mesma dos três modos de
 * captura, onde a linha nasce antes do primeiro segundo de áudio.
 *
 * ## A ORDEM, que é o assunto desta rota
 *
 * ```
 * dono → já importada? → legenda → duração/tamanho → COBRA → resumo
 * ```
 *
 * A legenda vem ANTES da cobrança de propósito, e é uma inversão em relação a
 * `/reprocess` e `/api/deepening`, onde nada acontece antes de pagar. Dois
 * motivos, e os dois são sobre esta rota especificamente:
 *
 * 1. **A legenda é a chamada barata** (~R$ 0,03, 1 crédito de provedor); o
 *    resumo é a cara. A regra que aquelas rotas protegem — não deixar a chamada
 *    CARA rodar antes do débito — continua valendo, e é o débito estar entre a
 *    legenda e o resumo que a cumpre.
 * 2. **É a legenda que diz se o vídeo é importável.** A duração sai do último
 *    segmento dela (ver `lib/youtube/supadata.ts`); "sem legenda", "longo
 *    demais" e "curto demais" só são conhecidos depois. Cobrar antes obrigaria
 *    a estornar três recusas rotineiras — e estorno é o caminho onde um erro
 *    de contagem vira moeda criada do nada.
 *
 * Depois da cobrança o comportamento é o das outras: falha do modelo NÃO
 * estorna. Aqui isso dói menos que lá, porque a transcrição é gravada assim que
 * o pagamento passa — quem pagou e viu o resumo falhar continua com o texto do
 * sermão inteiro na mão, e `/api/final-summary/from-transcript` é o caminho de
 * recuperação que já existe.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["youtube-import"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const sessionId = parsed.data.sessionId;

  // `getSession` passa pela RLS: sessão de outra pessoa volta null, e a rota
  // cara morre aqui em vez de depois de pagar o provedor.
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.mode !== "youtube") {
    return NextResponse.json({ error: "session_not_youtube" }, { status: 409 });
  }
  // Já importada. É o que impede pagar duas vezes pelo mesmo vídeo quando a
  // página é recarregada depois de a importação ter terminado — e a página faz
  // exatamente isso, porque não tem como saber sozinha se o POST anterior
  // chegou ao fim.
  if (session.endedAt) {
    return NextResponse.json({ error: "session_already_imported", sessionId }, { status: 409 });
  }

  const parsedUrl = session.sourceUrl ? parseYoutubeUrl(session.sourceUrl) : null;
  if (!parsedUrl) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // ---- a legenda, antes da cobrança ------------------------------------
  const transcriptResult = await fetchYoutubeTranscript(parsedUrl.canonicalUrl);
  if (!transcriptResult.ok) {
    // `provider_unavailable` é 503 e não 4xx: falta a nossa chave, o usuário
    // não fez nada errado, e a tela precisa dizer "indisponível" em vez de
    // mandá-lo tentar outro link para sempre.
    const status =
      transcriptResult.error === "provider_unavailable"
        ? 503
        : transcriptResult.error === "provider_failed"
          ? 502
          : transcriptResult.error === "video_not_found"
            ? 404
            : 422;
    return NextResponse.json({ error: transcriptResult.error }, { status });
  }

  const { text, durationMs, lang } = transcriptResult;

  if (durationMs > YOUTUBE_MAX_DURATION_MS) {
    return NextResponse.json(
      { error: "video_too_long", durationMs, maxDurationMs: YOUTUBE_MAX_DURATION_MS },
      { status: 422 }
    );
  }
  if (text.length < YOUTUBE_MIN_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: "video_too_short" }, { status: 422 });
  }

  // Enfeite, e best-effort: título e canal para a sessão nascer com o nome que
  // a pessoa reconhece na lista. Falha aqui não interrompe nada — ver
  // `lib/youtube/oembed.ts`.
  const info = await fetchYoutubeVideoInfo(parsedUrl.canonicalUrl);

  // ---- a cobrança ------------------------------------------------------
  const charge = await chargeCoins("youtube_import", sessionId, auth.user.id);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json(
        { error: "insufficient_balance", required: COIN_COSTS.youtubeImport },
        { status: 402 }
      );
    }
    log.error("charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  log.info("charged", { sessionId, durationMs, chars: text.length, lang });

  // ---- o título, separado do amontoado ----------------------------------
  //
  // Roda DEPOIS da cobrança de propósito, mesmo custando trocados: tudo que
  // acontece antes do débito é sobre decidir se o vídeo é importável, e esta
  // etapa não decide nada — ela embeleza. Um caminho de recusa que já tivesse
  // gasto uma chamada de LLM seria a única exceção a essa leitura, por nada.
  //
  // Best-effort como o oEmbed: sem `info` não há o que limpar, e qualquer
  // falha devolve o título cru. Ver `lib/youtube/metadata.ts`.
  const meta = info
    ? await cleanYoutubeMetadata({
        userId: auth.user.id,
        sessionId,
        rawTitle: info.title,
        channel: info.channel,
      })
    : null;

  // ---- a transcrição vai para o banco ANTES do resumo -------------------
  //
  // Duas coisas dependem disso, e as duas são sobre o dinheiro já ter saído da
  // conta: um 502 do modelo daqui para a frente deixa a pessoa com o sermão
  // inteiro em texto (e o caminho de `from-transcript` aberto para tentar o
  // resumo de novo), e o `session.endedAt` que este UPDATE grava é o que faz
  // um POST repetido bater no 409 de `session_already_imported` lá em cima.
  try {
    await updateSessionTranscript(sessionId, {
      transcript: text,
      durationMs,
      title: meta?.title ?? null,
      // Null e não um trecho da legenda: legenda automática do YouTube vem sem
      // pontuação, e as primeiras frases dela viram um cartão ilegível na
      // lista. O resumo preenche este campo logo abaixo, e até lá a sessão
      // aparece só com o título — que é o que o modo transcrição faz quando
      // não há resumo, pelo mesmo motivo de legibilidade.
      shortSummary: null,
      // O CANAL não é o autor — ele é a igreja. Foi assim que "batistadopovo"
      // virou o pregador de um sermão do Yago Martins no primeiro teste do
      // modo. Quem separa os dois é `cleanYoutubeMetadata`, e sem ela o autor
      // fica nulo, que é o mesmo estado de uma gravação em que ninguém digitou
      // o nome — honesto, e corrigível pelo usuário na própria tela.
      speakerName: meta?.speakerName ?? null,
      speakerLocation: meta?.speakerLocation ?? null,
    });
  } catch (err) {
    log.error("transcript save failed", { sessionId, error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  // ---- o resumo --------------------------------------------------------
  const result = await generateFinalSummary({
    userId: auth.user.id,
    sessionId,
    transcript: text,
    // Vazio: uma importação não roda nenhum pipeline ao vivo, então não há
    // feed. Mesmo caso de `/api/final-summary/from-transcript`.
    feedItems: [],
    logPrefix: "youtube-import",
    metadataRoute: "final-summary-youtube",
  });

  if (!result.ok) {
    // A sessão JÁ está salva e legível — este 502 diz "o resumo falhou", não
    // "a importação falhou". O cliente manda para `/summary`, que oferece
    // gerar o resumo a partir da transcrição.
    log.error("summary failed", { sessionId, message: result.message });
    return NextResponse.json(
      { error: "summary_failed", sessionId, transcriptSaved: true },
      { status: 502 }
    );
  }

  const { payload, latencyMs, model } = result;

  // `keepTitle` quando sobrou um título do vídeo: ele é o que a pessoa
  // reconhece na lista de gravações — foi olhando para ele que ela escolheu
  // aquele link.
  //
  // Quando NÃO sobrou, o do resumo é melhor, e esse caso é intencional: um
  // vídeo chamado "Culto de Domingo - 09.03.2025" não tem título de pregação, e
  // `cleanYoutubeMetadata` devolve null justamente para o resumo criar um a
  // partir do conteúdo. Também cobre o oEmbed não ter respondido.
  const keepTitle = !!meta?.title;

  let saved = false;
  try {
    await updateSessionSummary(sessionId, payload, { keepTitle });
    saved = true;
  } catch (err) {
    log.error("summary save failed", { sessionId, error: (err as Error).message });
  }

  // Best-effort, mesmo padrão das outras rotas de resumo: releia (10
  // versículos), lembra (10 mini-callbacks) e frases marcantes (até 12, sem
  // IA). Nenhuma falhando derruba o resumo — a UI trata payload ausente como
  // normal.
  const [rereads, reminders, highlights] = await Promise.all([
    generateAndSaveRereads({
      userId: auth.user.id,
      sessionId,
      transcript: text,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "rereads-youtube",
      metadataRoute: "rereads-youtube",
    }),
    generateAndSaveReminders({
      userId: auth.user.id,
      sessionId,
      transcript: text,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "reminders-youtube",
      metadataRoute: "reminders-youtube",
    }),
    generateAndSaveHighlights({
      sessionId,
      feedItems: [],
      finalSummary: payload,
      logPrefix: "highlights-youtube",
    }),
  ]);

  log.info("imported", { sessionId, saved, latencyMs, durationMs });

  return NextResponse.json({
    ...payload,
    sessionId,
    saved,
    latencyMs,
    model,
    durationMs,
    rereads,
    reminders,
    highlights,
  });
}
