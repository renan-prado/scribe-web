import "server-only";
import { APP_VERSION } from "@/lib/app-version";
import {
  type ChatCost,
  computeAudioCost,
  computeChatCost,
  hasAudioPricing,
  hasChatPricing,
} from "@/lib/llm/pricing";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("usage");

/**
 * Persist a single upstream LLM call into public.llm_usage_events.
 *
 * These helpers are fire-and-forget: routes await them so ordering in tests
 * is deterministic, but any insert failure is caught and logged, a broken
 * observability write must never surface as a 500 from a working /extract
 * or /transcribe.
 *
 * `userId` vem de quem CHAMA, sempre de `auth.user.id` depois do
 * `requireAuth()` da rota, e a escrita usa o service-role. Antes era o
 * contrário: o client do usuário inseria e a policy
 * `llm_usage_events_insert_own` (`user_id = auth.uid()`) fazia o escopo. O
 * problema é que uma policy de INSERT é uma porta ABERTA, ela autoriza a
 * escrita, não confere o conteúdo. Qualquer sessão logada podia mandar
 *
 *   POST /rest/v1/llm_usage_events { user_id: <o meu>, route: 'transcribe',
 *                                    model: 'gpt-5.1', total_cost_usd: 12345.67 }
 *
 * direto com o anon key, e o custo forjado entrava em `/admin/custos`, os
 * números que decidem o preço da moeda e medem a margem. Reproduzido em dev: HTTP 201. É a mesma lição de `charge_coins`
 * (migração 0037): o gate na rota não protege o que a policy concede por fora
 * dela. A policy foi derrubada na 0039.
 *
 * Continuam fire-and-forget: as rotas aguardam para a ordem ser determinística,
 * mas qualquer falha de insert é capturada e logada, observabilidade quebrada
 * nunca vira 500 numa rota que funcionou. `sessionId` é opcional: rotas sob
 * demanda (format, lookups) rodam fora de uma gravação.
 */

/**
 * As rotas de LLM que o código AINDA ESCREVE.
 *
 * **Ela não lista tudo o que existe em `llm_usage_events`, e não deve.** O
 * produto já teve o feed ao vivo (`bible`, `insights`, `sermon-echo`), os cards
 * de acompanhamento (`rereads*`, `reminders*`, `practices*`), a formatação de
 * parágrafo, o enriquecimento em segunda chamada e o primeiro resumo de uma
 * sessão do modo transcrição (`final-summary-from-transcript`). Nada disso é
 * gerado hoje, e as linhas continuam no banco, sendo LIDAS por
 * `features/admin/server/db/usage.ts` — que trabalha com `string`, justamente para que a
 * medição do passado não dependa de o código do presente ainda conhecer o nome.
 *
 * Ela governa só o que se escreve daqui em diante — e, desde que virou VALOR e
 * não só tipo, é também quem decide o que ganha linha própria na aba "Rotas"
 * de /admin/custos: o que não está aqui já não é gerado e some dentro de
 * "outras", ver `features/admin/server/db/usage.ts`. Acrescentar uma rota nova
 * aqui é, portanto, o mesmo gesto que lhe dar uma linha no painel.
 */
export const USAGE_ROUTES = [
  "transcribe",
  // As três rotas da MESMA chamada, `generateFinalSummary`. Separadas porque a
  // pergunta de preço é diferente em cada uma: a primeira está dentro do minuto
  // gravado, a segunda é o `reprocess_summary` de 15 moedas, e a terceira é a
  // única forma de medir o custo real de uma importação do YouTube contra as 30
  // moedas FIXAS que ela cobra, num custo que cresce com a duração do vídeo.
  "final-summary",
  "final-summary-reprocess",
  "final-summary-youtube",
  // A limpeza do título do vídeo (`lib/youtube/metadata.ts`). Rota própria
  // apesar de custar trocados, porque é a única chamada de LLM do produto que
  // roda sobre METADADO e não sobre o sermão: fundida com a do resumo, um dia
  // alguém leria o custo por importação sem saber que há duas chamadas ali.
  "youtube-metadata",
  // As três etapas de LLM do estudo (`lib/study/generate.ts`). Separadas de
  // propósito: é o que permite ver em /admin/custos quanto custa PERGUNTAR,
  // quanto custa RESPONDER e quanto custa ESCREVER, e portanto onde vale subir
  // ou baixar de modelo. Um "deepening" único não respondia a isso.
  "study-questions",
  "study-answers",
  "study-write",
  // Os dois cortes do guardião, num modelo barato. Mesma rota para os dois:
  // separá-los daria duas linhas de custo irrisório cada.
  "study-guard",
  "hallucination-report",
  // A análise diária do próprio painel (/api/admin/insights). Entra aqui, e não
  // fora da telemetria, porque é dólar de verdade saindo: fora da tabela, o
  // custo somado do painel deixaria de bater com a fatura da OpenAI. Ela é
  // atribuída à ação `internal` em features/admin/server/db/usage.ts, não a `unbilled`,
  // para não parecer gasto de usuário que ninguém cobrou.
  "admin-insights",
  // A conversa com o Biblo. UMA rota para a mensagem inteira, e não uma por
  // parte: a mesma chamada escreve a resposta, os próximos chips, a sugestão
  // de bloco e o fio da conversa, então não há dois custos a separar. O que
  // se quer ler aqui é o custo de UMA mensagem — e, dentro dele,
  // `cached_tokens`, que diz quanta conversa pegou o cache do prefixo. É a
  // diferença entre 74% e 61% de margem em `features/coins/pricing.ts`.
  "biblo",
  // O recado FALADO ao Biblo (`POST /api/biblo/voice`). Rota própria e não
  // `transcribe`: misturar os dois jogaria minutos de recado dentro da
  // medição de minutos de SERMÃO, que é justamente o número que decide se
  // `recordingMinute` continua em 5. Ver `docs/biblo-implementacao.md` §14.
  "biblo-voice",
] as const;

/** A mesma lista, como tipo. Um lugar só, ou a lista e o tipo divergem. */
export type UsageRoute = (typeof USAGE_ROUTES)[number];

export type RecordChatUsageInput = {
  /** Sempre `auth.user.id`, nunca um valor vindo do corpo da requisição. */
  userId: string;
  sessionId: string | null;
  route: UsageRoute;
  model: string;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  cachedTokens: number | undefined;
  /**
   * Subconjunto de `completionTokens`, não uma parcela a somar. Gravado numa
   * coluna própria porque o custo já sai certo sem ele, ele entra em
   * `completion_tokens` e é cobrado como saída, mas a PERGUNTA "quanto desta
   * conta é o modelo pensando?" não tem resposta sem separá-lo. É o que diz
   * se `reasoningEffort` numa etapa é dinheiro no chão.
   */
  reasoningTokens: number | undefined;
  latencyMs: number;
};

export type RecordAudioUsageInput = {
  /** Sempre `auth.user.id`, nunca um valor vindo do corpo da requisição. */
  userId: string;
  sessionId: string | null;
  route: Extract<UsageRoute, "transcribe" | "biblo-voice">;
  model: string;
  audioSeconds: number;
  latencyMs: number;
};

export async function recordChatUsage(input: RecordChatUsageInput): Promise<void> {
  try {
    const supabase = createAdminClient();

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
      user_id: input.userId,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      app_version: APP_VERSION,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cached_tokens: cached,
      reasoning_tokens: input.reasoningTokens ?? null,
      total_tokens: total,
      audio_seconds: null,
      input_cost_usd: cost.inputUsd,
      output_cost_usd: cost.outputUsd,
      total_cost_usd: cost.totalUsd,
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

export async function recordAudioUsage(input: RecordAudioUsageInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    const totalUsd = computeAudioCost(input.model, input.audioSeconds);
    if (!hasAudioPricing(input.model)) {
      log.warn("no audio pricing for model", { model: input.model });
    }

    const { error } = await supabase.from("llm_usage_events").insert({
      user_id: input.userId,
      session_id: input.sessionId,
      route: input.route,
      model: input.model,
      app_version: APP_VERSION,
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
