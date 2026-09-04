import "server-only";
import type { StudyPayload, StudyRecord } from "@/lib/domain/study";
import { computeStudyMetrics, type StudyMetrics } from "@/lib/study/metrics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Uma sessão, EXECUÇÃO POR EXECUÇÃO.
 *
 * `/admin/usage` e `/admin/precificacao` agregam: a primeira por rota, a
 * segunda por ação. As duas somam tudo o que aconteceu numa sessão, e é o
 * certo para as perguntas delas. Nenhuma responde à pergunta de quem está
 * AJUSTANDO o pipeline: "o que mudou entre a execução de ontem e a de agora?"
 *
 * Reprocessar um estudo grava um segundo conjunto de eventos na MESMA sessão.
 * Somados, os dois viram um número que não descreve nem um nem outro — e é
 * exatamente esse número que as outras telas mostravam. Separar as execuções é
 * a razão de este módulo existir.
 *
 * ## Como uma execução é delimitada
 *
 * **Abre em todo evento `study-questions`**, que é o passo 1 do pipeline e
 * roda exatamente uma vez por estudo (`lib/study/generate.ts`). É um corte
 * exato, não uma heurística de tempo — o que importa quando duas execuções
 * podem ser disparadas com minutos de diferença.
 *
 * O intervalo de 10 minutos é só a rede para o que veio ANTES do pipeline
 * atual: as linhas antigas de rota `deepening` não têm passo 1 para abrir a
 * execução. Limitação assumida: dois estudos legados a menos de 10 minutos um
 * do outro apareceriam fundidos. Não existe caminho no produto que produza
 * isso hoje.
 *
 * Service-role porque a tela é transversal a usuários — só é alcançada depois
 * de `isCurrentUserAdmin()`.
 */

/** Rotas do estudo, incluindo as legadas que ainda vivem no banco. */
const STUDY_ROUTES = [
  "study-questions",
  "study-guard",
  "study-answers",
  "study-write",
  "deepening",
  "deepening-audit",
  "study-plan",
  "study-audit",
] as const;

const RUN_OPENER = "study-questions";
const LEGACY_GAP_MS = 10 * 60 * 1000;

export type RunStep = {
  route: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  cachedTokens: number | null;
  /**
   * Subconjunto de `completionTokens`, cobrado como saída. NULL nas chamadas
   * anteriores à migração 0036 e em todo modelo que não raciocina — nulo é
   * "não medido", nunca zero medido.
   */
  reasoningTokens: number | null;
  costUsd: number;
  latencyMs: number | null;
  createdAt: string;
};

export type SessionRun = {
  startedAt: string;
  endedAt: string;
  steps: RunStep[];
  totalCostUsd: number;
  /**
   * Soma das latências das chamadas. NÃO é o relógio de parede da rota — fora
   * fica a ancoragem, as capas e a persistência —, mas é o que se compara
   * contra o `maxDuration = 300` da rota, porque é o que domina.
   */
  llmMs: number;
  totalReasoningTokens: number | null;
};

export type SessionRunsReport = {
  sessionId: string;
  sessionTitle: string | null;
  captureMode: string | null;
  /** Da mais recente para a mais antiga — é a que se acabou de rodar. */
  runs: SessionRun[];
  /** Custo de tudo o que NÃO é estudo: transcrição, feed ao vivo, resumo. */
  otherCostUsd: number;
  otherEvents: number;
  /**
   * O estudo persistido HOJE. Só a última execução tem payload para conferir:
   * reprocessar sobrescreve a linha (`updateDeepening`), então as execuções
   * anteriores existem em custo e não em texto. É uma perda assumida do
   * produto, e a tela tem de dizê-la em vez de fingir que mediu.
   */
  study: { metrics: StudyMetrics; record: StudyRecord | null; title: string } | null;
};

type EventRow = {
  route: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cached_tokens: number | null;
  reasoning_tokens: number | null;
  total_cost_usd: number | string | null;
  latency_ms: number | null;
  created_at: string;
};

export async function loadSessionRuns(sessionId: string): Promise<SessionRunsReport | null> {
  const admin = createAdminClient();

  const [sessionRes, eventsRes, deepeningRes] = await Promise.all([
    admin.from("sessions").select("id, title, capture_mode").eq("id", sessionId).maybeSingle(),
    admin
      .from("llm_usage_events")
      .select(
        "route, model, prompt_tokens, completion_tokens, cached_tokens, reasoning_tokens, total_cost_usd, latency_ms, created_at"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    admin
      .from("session_deepenings")
      .select("payload, plan")
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (sessionRes.error) throw new Error(`loadSessionRuns failed: ${sessionRes.error.message}`);
  if (!sessionRes.data) return null;
  if (eventsRes.error) throw new Error(`loadSessionRuns failed: ${eventsRes.error.message}`);

  const events = (eventsRes.data ?? []) as EventRow[];
  const studyRoutes = new Set<string>(STUDY_ROUTES);

  const runs: SessionRun[] = [];
  let current: SessionRun | null = null;
  let otherCostUsd = 0;
  let otherEvents = 0;

  for (const row of events) {
    const cost = Number(row.total_cost_usd ?? 0);
    if (!studyRoutes.has(row.route)) {
      otherCostUsd += cost;
      otherEvents += 1;
      continue;
    }

    const gap = current ? Date.parse(row.created_at) - Date.parse(current.endedAt) : Infinity;
    if (!current || row.route === RUN_OPENER || gap > LEGACY_GAP_MS) {
      current = {
        startedAt: row.created_at,
        endedAt: row.created_at,
        steps: [],
        totalCostUsd: 0,
        llmMs: 0,
        totalReasoningTokens: null,
      };
      runs.push(current);
    }

    current.steps.push({
      route: row.route,
      model: row.model,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      cachedTokens: row.cached_tokens,
      reasoningTokens: row.reasoning_tokens,
      costUsd: cost,
      latencyMs: row.latency_ms,
      createdAt: row.created_at,
    });
    current.endedAt = row.created_at;
    current.totalCostUsd += cost;
    current.llmMs += row.latency_ms ?? 0;
    if (row.reasoning_tokens != null) {
      current.totalReasoningTokens = (current.totalReasoningTokens ?? 0) + row.reasoning_tokens;
    }
  }

  const payload = deepeningRes.data?.payload as StudyPayload | undefined;

  return {
    sessionId,
    sessionTitle: sessionRes.data.title ?? null,
    captureMode: sessionRes.data.capture_mode ?? null,
    runs: runs.reverse(),
    otherCostUsd,
    otherEvents,
    study: payload
      ? {
          metrics: computeStudyMetrics(payload),
          record: (deepeningRes.data?.plan as StudyRecord | null) ?? null,
          title: payload.title?.trim() || "(sem título)",
        }
      : null,
  };
}
