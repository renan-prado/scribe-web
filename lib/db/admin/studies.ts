import "server-only";
import type { StudyBlock, StudyPayload, StudyPlan } from "@/lib/domain/study";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura dos estudos gerados, para a tela de avaliação do `/admin`.
 *
 * Existe por causa da §7 de `docs/estudo-v2.md`: a qualidade do estudo passou
 * a ser avaliada por leitura humana sobre uma amostra fixa, e dois dos oito
 * critérios — "a abordagem escolhida era a melhor disponível?" e "o estudo é
 * honesto quanto à extensão?" — só são julgáveis se dá para ver a DECISÃO
 * editorial ao lado do texto que ela produziu.
 *
 * Persistir o plano (migração 0033) sem lugar nenhum de lê-lo teria sido
 * guardar evidência num cofre sem chave.
 *
 * Service-role porque a tela é transversal a usuários — só é alcançada depois
 * de `isCurrentUserAdmin()`.
 */

export type StudyBlockCounts = Partial<Record<StudyBlock["type"], number>>;

export type AdminStudyRow = {
  sessionId: string;
  createdAt: string;
  sessionTitle: string | null;
  studyTitle: string;
  thesis: string;
  /** NULL nos estudos gerados antes do pipeline de 5 etapas. */
  plan: StudyPlan | null;
  totalBlocks: number;
  counts: StudyBlockCounts;
  /** Fontes que sobreviveram à selagem — "autor, obra". */
  sources: string[];
  /** Referências bíblicas exibidas, todas conferidas contra a NVI. */
  verses: string[];
};

type Row = {
  session_id: string;
  created_at: string;
  payload: StudyPayload;
  plan: StudyPlan | null;
  session: { title: string | null } | Array<{ title: string | null }> | null;
};

export async function listStudiesForAdmin(limit = 40): Promise<AdminStudyRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_deepenings")
    .select("session_id, created_at, payload, plan, session:sessions!inner(title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listStudiesForAdmin failed: ${error.message}`);

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const blocks = row.payload?.blocks ?? [];
    const counts: StudyBlockCounts = {};
    for (const b of blocks) counts[b.type] = (counts[b.type] ?? 0) + 1;
    const session = Array.isArray(row.session) ? row.session[0] : row.session;

    return {
      sessionId: row.session_id,
      createdAt: row.created_at,
      sessionTitle: session?.title ?? null,
      studyTitle: row.payload?.title?.trim() || "(sem título)",
      thesis: row.payload?.shortSummary?.trim() ?? "",
      plan: row.plan ?? null,
      totalBlocks: blocks.length,
      counts,
      sources: blocks
        .filter(
          (b): b is Extract<StudyBlock, { type: "quote" | "reading" }> =>
            b.type === "quote" || b.type === "reading"
        )
        .map((b) => (b.type === "quote" ? `${b.author}, ${b.work}` : `${b.author}, ${b.title}`)),
      verses: blocks
        .filter((b): b is Extract<StudyBlock, { type: "bibleQuote" }> => b.type === "bibleQuote")
        .map((b) => b.reference),
    };
  });
}
