import "server-only";
import {
  type ChatCost,
  computeAudioCost,
  computeChatCost,
  hasAudioPricing,
  hasChatPricing,
} from "@/lib/llm/pricing";
import { createLogger } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("usage");

/**
 * Persist a single upstream LLM call into public.llm_usage_events.
 *
 * These helpers are fire-and-forget: routes await them so ordering in tests
 * is deterministic, but any insert failure is caught and logged — a broken
 * observability write must never surface as a 500 from a working /extract
 * or /transcribe.
 *
 * user_id is injected from the authenticated Supabase session (routes call
 * requireAuth() first); RLS then enforces that the row is written under the
 * correct owner. session_id is optional — on-demand routes (format,
 * lookups) run outside a recording.
 */

export type UsageRoute =
  | "bible"
  | "insights"
  | "sermon-echo"
  | "final-summary"
  | "final-summary-reprocess"
  // Duas rotas para a MESMA chamada de enriquecimento, escolhidas pelo passe
  // que a disparou. Sem a segunda, metade do custo de reprocessar um resumo
  // caía na linha da gravação e o preço de `reprocess_summary` parecia baixo.
  | "summary-enrichment"
  | "summary-enrichment-reprocess"
  // As três etapas de LLM do estudo (`lib/study/generate.ts`). Separadas de
  // propósito: é o que permite ver no /admin/usage quanto custa PERGUNTAR,
  // quanto custa RESPONDER e quanto custa ESCREVER — e portanto onde vale
  // subir ou baixar de modelo. Um "deepening" único não respondia a isso.
  // As linhas antigas ("deepening", "deepening-audit", "study-plan",
  // "study-audit") continuam no banco; o tipo governa só o que se ESCREVE
  // daqui em diante.
  | "study-questions"
  | "study-answers"
  | "study-write"
  // Os dois cortes do guardião, num modelo barato. Mesma rota para os
  // dois: separá-los daria duas linhas de custo irrisório cada.
  | "study-guard"
  | "practices"
  | "rereads"
  | "reminders"
  | "format-paragraphs"
  | "hallucination-report"
  // A análise diária do próprio painel (/api/admin/insights). Entra aqui, e
  // não fora da telemetria, porque é dólar de verdade saindo: fora da tabela,
  // o custo somado do painel deixaria de bater com a fatura da OpenAI. Ela é
  // atribuída à ação `internal` em lib/db/admin/usage.ts — não a `unbilled` —
  // para não parecer gasto de usuário que ninguém cobrou.
  | "admin-insights"
  | "transcribe";

export type RecordChatUsageInput = {
  sessionId: string | null;
  route: UsageRoute;
  model: string;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  cachedTokens: number | undefined;
  latencyMs: number;
};

export type RecordAudioUsageInput = {
  sessionId: string | null;
  route: Extract<UsageRoute, "transcribe">;
  model: string;
  audioSeconds: number;
  /**
   * Subconjunto de `completionTokens`, não uma parcela a somar. Gravado numa
   * coluna própria porque o custo já sai certo sem ele — ele entra em
   * `completion_tokens` e é cobrado como saída — mas a PERGUNTA "quanto desta
   * conta é o modelo pensando?" não tem resposta sem separá-lo. É o que diz
   * se `reasoningEffort` numa etapa é dinheiro no chão.
   */
  reasoningTokens: number | undefined;
  latencyMs: number;
};

export async function recordChatUsage(input: RecordChatUsageInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const cost: ChatCost = computeChatCost(
      input.model,
      input.promptTokens,
      input.completionTokens,
      input.cachedTokens
    );
    if (!hasChatPricing(input.model)) {
      log.warn("no chat pricing for model", { model: input.model });
    }

    const prompt = input.promptTokens ?? null;
    const completion = input.completionTokens ?? null;
    const cached = input.cachedTokens ?? null;
    const total = prompt !== null && completion !== null ? prompt + completion : null;

    const { error } = await supabase.from("llm_usage_events").insert({
      user_id: user.id,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cached_tokens: cached,
      total_tokens: total,
      audio_seconds: null,
      input_cost_usd: cost.inputUsd,
      output_cost_usd: cost.outputUsd,
      total_cost_usd: cost.totalUsd,
      latency_ms: input.latencyMs,
    });
    if (error) {
      reasoning_tokens: input.reasoningTokens ?? null,
      log.error("insert failed", { route: input.route, error: error.message });
    }
  } catch (err) {
    log.error("insert threw", {
      route: input.route,
      error: (err as Error).message,
    });
  }
}

export async function recordAudioUsage(input: RecordAudioUsageInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const totalUsd = computeAudioCost(input.model, input.audioSeconds);
    if (!hasAudioPricing(input.model)) {
      log.warn("no audio pricing for model", { model: input.model });
    }

    const { error } = await supabase.from("llm_usage_events").insert({
      user_id: user.id,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      audio_seconds: Number.isFinite(input.audioSeconds) ? input.audioSeconds : null,
      input_cost_usd: totalUsd,
      output_cost_usd: 0,
      total_cost_usd: totalUsd,
      latency_ms: input.latencyMs,
    });
    if (error) {
      log.error("insert failed", { route: input.route, error: error.message });
    }
  } catch (err) {
    log.error("insert threw", {
      route: input.route,
      error: (err as Error).message,
    });
  }
}
