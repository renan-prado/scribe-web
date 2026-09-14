import "server-only";
import {
  averageRating,
  FEEDBACK_RATINGS,
  FEEDBACK_TOPICS,
  type FeedbackRating,
  type FeedbackSurface,
  type FeedbackTopic,
} from "@/lib/domain/feedback";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A leitura do feedback, para `/admin/feedback`.
 *
 * Service-role porque a tela é transversal a usuários, e porque as tabelas de
 * `0047_feedback.sql` têm RLS ligada e nenhuma policy, então não há outro
 * caminho. Só é alcançada depois de `isCurrentUserAdmin()`.
 *
 * A tela responde a DUAS perguntas, e é por isso que este módulo devolve duas
 * coisas que não se somam:
 *
 *   * **A nota de cada coisa**, a média por tópico, que é o número. Cada
 *     tópico é uma peça com um conserto próprio (o pipeline ao vivo, o resumo,
 *     a transcrição, o estudo), e uma "nota do Scriba" que os misturasse não
 *     apontaria para lugar nenhum.
 *   * **O que as pessoas escreveram**, os comentários, que é o diagnóstico.
 *     Uma média de 2,4 diz que algo está errado; só o texto diz o quê.
 *
 * A taxa de resposta vem junto por uma razão de honestidade: as notas que
 * chegam são as de quem se dispôs a responder, e essa amostra é
 * sistematicamente mais gentil que a realidade. Sem o denominador, 4,0 sobre
 * 12 respostas de 90 perguntas parece um produto adorado.
 */

/** Teto de linhas lidas. O volume esperado é de dezenas por mês; o limite
 * existe para que a tela não vire uma varredura da tabela no dia em que não
 * for. Quando ele apertar, o corte por período nasce aqui. */
const MAX_ROWS = 5_000;
/** Quantos envios a lista mostra. Ler é o que a tela é; paginar 500
 * comentários seria transformar leitura em navegação. */
const MAX_SUBMISSIONS = 120;

export type FeedbackTopicStats = {
  topic: FeedbackTopic;
  count: number;
  /** 1..4, ou `null` quando ninguém respondeu, nunca zero. Ver `averageRating`. */
  average: number | null;
  distribution: Record<FeedbackRating, number>;
};

export type FeedbackSubmissionRow = {
  submissionId: string;
  createdAt: string;
  surface: FeedbackSurface;
  sessionId: string | null;
  comment: string | null;
  appVersion: string | null;
  userEmail: string | null;
  userName: string | null;
  ratings: Array<{ topic: FeedbackTopic; rating: FeedbackRating }>;
};

export type AdminFeedbackOverview = {
  topics: FeedbackTopicStats[];
  submissions: FeedbackSubmissionRow[];
  /** Envios distintos, não linhas: o Ao Vivo grava duas por janela. */
  totalSubmissions: number;
  prompts: { asked: number; answered: number };
};

type ResponseRow = {
  submission_id: string;
  user_id: string;
  surface: string;
  topic: string;
  rating: string;
  comment: string | null;
  session_id: string | null;
  app_version: string | null;
  created_at: string;
};

function emptyDistribution(): Record<FeedbackRating, number> {
  return { ruim: 0, razoavel: 0, boa: 0, excelente: 0 };
}

export async function loadAdminFeedback(): Promise<AdminFeedbackOverview> {
  const admin = createAdminClient();

  const [responses, asked, answered] = await Promise.all([
    admin
      .from("feedback_responses")
      .select(
        "submission_id, user_id, surface, topic, rating, comment, session_id, app_version, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    admin.from("feedback_prompts").select("id", { count: "exact", head: true }),
    admin
      .from("feedback_prompts")
      .select("id", { count: "exact", head: true })
      .not("answered_at", "is", null),
  ]);

  if (responses.error) throw new Error(`loadAdminFeedback failed: ${responses.error.message}`);
  const rows = (responses.data ?? []) as ResponseRow[];

  // --- A nota de cada coisa -------------------------------------------------
  const byTopic = new Map<FeedbackTopic, FeedbackRating[]>();
  for (const row of rows) {
    const topic = row.topic as FeedbackTopic;
    const rating = row.rating as FeedbackRating;
    if (!FEEDBACK_TOPICS.includes(topic) || !FEEDBACK_RATINGS.includes(rating)) continue;
    const list = byTopic.get(topic);
    if (list) list.push(rating);
    else byTopic.set(topic, [rating]);
  }

  // Todos os tópicos aparecem, inclusive os sem resposta. Um tópico ausente da
  // tabela é indistinguível de um tópico que ninguém respondeu, e os dois
  // pedem coisas diferentes de quem lê.
  const topics: FeedbackTopicStats[] = FEEDBACK_TOPICS.map((topic) => {
    const ratings = byTopic.get(topic) ?? [];
    const distribution = emptyDistribution();
    for (const rating of ratings) distribution[rating] += 1;
    return { topic, count: ratings.length, average: averageRating(ratings), distribution };
  });

  // --- O que as pessoas escreveram -----------------------------------------
  // As linhas voltam achatadas (uma por nota) e são reagrupadas por
  // `submission_id`. É a regra que a denormalização do comentário impõe: sem o
  // agrupamento, uma janela do modo Ao Vivo aparece como duas pessoas dizendo
  // exatamente a mesma frase.
  const grouped = new Map<string, FeedbackSubmissionRow>();
  for (const row of rows) {
    const existing = grouped.get(row.submission_id);
    if (existing) {
      existing.ratings.push({
        topic: row.topic as FeedbackTopic,
        rating: row.rating as FeedbackRating,
      });
      continue;
    }
    grouped.set(row.submission_id, {
      submissionId: row.submission_id,
      createdAt: row.created_at,
      surface: row.surface as FeedbackSurface,
      sessionId: row.session_id,
      comment: row.comment,
      appVersion: row.app_version,
      userEmail: null,
      userName: null,
      ratings: [{ topic: row.topic as FeedbackTopic, rating: row.rating as FeedbackRating }],
    });
  }

  const allSubmissions = [...grouped.values()];
  const submissions = allSubmissions.slice(0, MAX_SUBMISSIONS);

  // Quem escreveu. Consulta à parte porque `feedback_responses.user_id`
  // referencia `auth.users`, não `profiles`, não há relação declarada para o
  // PostgREST embutir, e inventar uma FK para uma tela de leitura seria pagar
  // um índice para não escrever um segundo select.
  const ownerBySubmission = new Map(rows.map((r) => [r.submission_id, r.user_id]));
  const ids = [
    ...new Set(
      submissions
        .map((s) => ownerBySubmission.get(s.submissionId))
        .filter((id): id is string => !!id)
    ),
  ];
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ids);
    const byId = new Map(
      (
        (profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>
      ).map((p) => [p.id, p])
    );
    for (const submission of submissions) {
      const owner = ownerBySubmission.get(submission.submissionId);
      const profile = owner ? byId.get(owner) : undefined;
      submission.userEmail = profile?.email ?? null;
      submission.userName = profile?.display_name ?? null;
    }
  }

  return {
    topics,
    submissions,
    totalSubmissions: allSubmissions.length,
    prompts: { asked: asked.count ?? 0, answered: answered.count ?? 0 },
  };
}
