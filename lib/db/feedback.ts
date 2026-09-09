import "server-only";
import { APP_VERSION } from "@/lib/app-version";
import {
  FEEDBACK_TOPICS_BY_SURFACE,
  type FeedbackRating,
  type FeedbackSurface,
  type FeedbackTopic,
  isFeedbackMilestone,
} from "@/lib/domain/feedback";
import { parseSessionMode, type SessionMode } from "@/lib/domain/session";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A decisão de PERGUNTAR, e o registro da resposta.
 *
 * Tudo aqui roda com service-role e recebe o `userId` de quem chama — as duas
 * tabelas de `0047_feedback.sql` têm RLS ligada e nenhuma policy, de propósito.
 * O cliente não escolhe quando é perguntado nem o que vai para a tabela que
 * orienta o roadmap; ele responde a uma janela que o servidor abriu.
 *
 * A regra do momento em uma frase: **o marco é derivado no servidor, e a
 * pergunta é gravada antes de ser feita.** Derivar é o que faz "1ª gravação"
 * significar a mesma coisa para todo mundo; gravar antes é o que faz a
 * pergunta não voltar quando a pessoa reabre a página.
 */

const log = createLogger("feedback");

export type FeedbackPromptKind = "recording" | "study";

export type ResolvedFeedbackPrompt = {
  promptId: string;
  surface: FeedbackSurface;
  topics: readonly FeedbackTopic[];
  /** Qual marco (1, 3 ou 8). A tela não mostra; serve ao log e ao painel. */
  ordinal: number;
};

/** O modo de captura decide sobre o que faz sentido perguntar. */
function surfaceForMode(mode: SessionMode): FeedbackSurface {
  if (mode === "audio_only") return "audio";
  if (mode === "transcript_only") return "transcript";
  return "live";
}

/**
 * Decide se ESTA visita merece a janela — e, se merecer, já grava a pergunta.
 *
 * Devolve `null` na esmagadora maioria das chamadas, e isso é o caminho
 * normal: só três sessões e três estudos na vida de cada pessoa passam daqui.
 *
 * As quatro portas, em ordem, e o que cada uma protege:
 *
 *   1. **A sessão (ou o estudo) é do usuário e está terminada.** Service-role
 *      não tem RLS atrás dela; o `user_id` no filtro é o gate.
 *   2. **Ela nasceu depois de `profiles.feedback_started_at`.** É o que faz a
 *      contagem começar hoje para quem já tinha quarenta gravações — sem
 *      isso, quem mais usa o produto seria exatamente quem nunca é ouvido.
 *   3. **O ordinal é 1, 3 ou 8.** Contado no banco, nunca no cliente.
 *   4. **A pergunta ainda não foi feita.** `feedback_prompts_once` decide;
 *      um 23505 aqui é "já perguntei", não erro.
 *
 * A ordem importa por custo: as duas primeiras leem uma linha, a terceira
 * conta, e só a quarta escreve.
 */
export async function resolveFeedbackPrompt(input: {
  userId: string;
  kind: FeedbackPromptKind;
  sessionId: string;
}): Promise<ResolvedFeedbackPrompt | null> {
  const { userId, kind, sessionId } = input;
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("feedback_started_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    log.warn("perfil não lido — sem pergunta", { userId, error: profileError?.message });
    return null;
  }
  const startedAt = profile.feedback_started_at as string;

  // O instante do fato que se quer numerar, e a superfície sobre a qual
  // perguntar. As duas famílias divergem só aqui.
  let anchorAt: string;
  let surface: FeedbackSurface;

  if (kind === "recording") {
    const { data: session, error } = await admin
      .from("sessions")
      .select("created_at, ended_at, mode")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !session) return null;
    // Gravação em aberto ainda não terminou: não há experiência completa
    // sobre a qual perguntar.
    if (!session.ended_at) return null;
    anchorAt = session.created_at as string;
    surface = surfaceForMode(parseSessionMode(session.mode));
  } else {
    const { data: deepening, error } = await admin
      .from("session_deepenings")
      .select("created_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !deepening) return null;
    anchorAt = deepening.created_at as string;
    surface = "study";
  }

  // Comparação por instante, não por texto: o Postgres devolve o carimbo com
  // ou sem fração de segundo conforme o valor, e duas grafias do mesmo momento
  // não se ordenam como strings.
  if (new Date(anchorAt).getTime() < new Date(startedAt).getTime()) return null;

  const ordinal = await countUpTo({ userId, kind, startedAt, anchorAt });
  if (ordinal === null || !isFeedbackMilestone(ordinal)) return null;

  const { data: prompt, error: insertError } = await admin
    .from("feedback_prompts")
    .insert({ user_id: userId, kind, session_id: sessionId, ordinal })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // 23505 é a pergunta já feita — o caso comum de quem reabre a página.
    if (insertError.code !== "23505") {
      log.error("falha ao registrar pergunta", { userId, kind, error: insertError.message });
    }
    return null;
  }
  if (!prompt) return null;

  log.debug("perguntando", { userId, kind, surface, ordinal });
  return {
    promptId: prompt.id as string,
    surface,
    topics: FEEDBACK_TOPICS_BY_SURFACE[surface],
    ordinal,
  };
}

/**
 * A enésima gravação (ou estudo) do usuário desde o início da contagem,
 * incluindo a que ancora a chamada.
 *
 * `lte` sobre o carimbo da própria linha, e não um `count` do total: contar
 * tudo daria o ordinal de HOJE a uma sessão de semanas atrás, e o marco
 * mudaria a cada gravação nova. Aqui ele é uma propriedade da sessão, estável
 * enquanto as anteriores existirem — e é por isso que `feedback_prompts.ordinal`
 * o congela assim que a pergunta é feita.
 */
async function countUpTo(input: {
  userId: string;
  kind: FeedbackPromptKind;
  startedAt: string;
  anchorAt: string;
}): Promise<number | null> {
  const admin = createAdminClient();
  const table = input.kind === "recording" ? "sessions" : "session_deepenings";

  let query = admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("created_at", input.startedAt)
    .lte("created_at", input.anchorAt);

  // Gravação em aberto não conta: ela ainda pode virar sessão nenhuma.
  if (input.kind === "recording") query = query.not("ended_at", "is", null);

  const { count, error } = await query;
  if (error) {
    log.error("falha ao contar", { table, error: error.message });
    return null;
  }
  return count ?? null;
}

/**
 * Recupera a superfície e a sessão de uma pergunta JÁ FEITA, para o envio.
 *
 * Existe para que o cliente não precise mandar nem uma nem outra. Ele devolve
 * só o `promptId` que recebeu, e o servidor reconstrói o resto da linha que
 * ele mesmo escreveu — um corpo que dissesse `surface: "study"` sobre a sessão
 * de outra pessoa não teria como ser desmentido.
 *
 * `null` quando a pergunta não é dele, não existe, ou já foi respondida. A
 * última é o clique duplo no botão de enviar, e é por isso que ela é tratada
 * como as outras duas: recusa silenciosa, nunca uma segunda linha.
 */
export async function loadOpenFeedbackPrompt(input: {
  userId: string;
  promptId: string;
}): Promise<{ surface: FeedbackSurface; sessionId: string } | null> {
  const admin = createAdminClient();
  const { data: prompt, error } = await admin
    .from("feedback_prompts")
    .select("kind, session_id, answered_at")
    .eq("id", input.promptId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error || !prompt || prompt.answered_at) return null;

  const sessionId = prompt.session_id as string;
  if (prompt.kind === "study") return { surface: "study", sessionId };

  const { data: session } = await admin
    .from("sessions")
    .select("mode")
    .eq("id", sessionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!session) return null;
  return { surface: surfaceForMode(parseSessionMode(session.mode)), sessionId };
}

export type FeedbackAnswer = { topic: FeedbackTopic; rating: FeedbackRating };

/**
 * Grava as notas de um envio e marca a pergunta como respondida.
 *
 * As linhas nascem juntas, com o mesmo `submission_id` e o mesmo comentário —
 * ver o porquê da repetição no cabeçalho da migração. `app_version` entra
 * aqui, e não como default da coluna, pelo mesmo motivo de
 * `llm_usage_events`: quem sabe a versão é o processo que está rodando.
 *
 * `promptId` é opcional porque o feedback do /profile não nasce de pergunta
 * nossa — é a pessoa que procurou o botão.
 */
export async function saveFeedbackResponse(input: {
  userId: string;
  surface: FeedbackSurface;
  sessionId: string | null;
  promptId: string | null;
  answers: readonly FeedbackAnswer[];
  comment: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const submissionId = crypto.randomUUID();

  const { error } = await admin.from("feedback_responses").insert(
    input.answers.map((answer) => ({
      user_id: input.userId,
      submission_id: submissionId,
      surface: input.surface,
      topic: answer.topic,
      rating: answer.rating,
      comment: input.comment,
      session_id: input.sessionId,
      app_version: APP_VERSION,
    }))
  );
  if (error) throw new Error(`saveFeedbackResponse failed: ${error.message}`);

  if (!input.promptId) return;
  // A taxa de resposta é a razão de ser da coluna. Falhar aqui não pode
  // derrubar o envio: a nota já está gravada, e é ela que importa.
  const { error: markError } = await admin
    .from("feedback_prompts")
    .update({ answered_at: new Date().toISOString() })
    .eq("id", input.promptId)
    .eq("user_id", input.userId);
  if (markError) {
    log.warn("não consegui marcar a pergunta como respondida", {
      promptId: input.promptId,
      error: markError.message,
    });
  }
}
