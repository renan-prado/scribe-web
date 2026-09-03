import "server-only";
import { recordChatUsage } from "@/lib/db/usage";
import {
  type AdminInsightScope,
  type AdminInsightsRecord,
  parseAdminInsightsFromLLM,
} from "@/lib/domain/admin-insights";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { computeChatCost } from "@/lib/llm/pricing";
import { createLogger } from "@/lib/log";
import { adminInsightsSystemPrompt } from "@/lib/prompts/admin-insights";
import { buildInsightsBriefing } from "./briefing";
import { readAdminInsights, writeAdminInsights } from "./store";

/**
 * A geração: briefing → modelo → parser → banco, e a telemetria no fim.
 *
 * **É a chamada de LLM mais cara do produto por execução, e a única que roda
 * sem ninguém pedindo.** Daí as três defesas:
 *
 *   - o chamador confere a validade ANTES (o card só dispara quando a linha
 *     está velha ou não existe), e a rota confere DE NOVO, porque dois admins
 *     abrindo o painel ao mesmo tempo são duas requisições;
 *   - a janela é fixa em 30 dias, então não há uma geração por filtro de tela;
 *   - o custo é gravado em `llm_usage_events` como qualquer outra rota, na
 *     ação `internal`. Uma análise de custo que não contabiliza a si mesma é
 *     exatamente o tipo de omissão que ela existe para pegar.
 *
 * `maxTokens` é generoso, e o motivo não é o tamanho do texto: nos modelos de
 * raciocínio o orçamento é COMPARTILHADO com os tokens de raciocínio, que aqui
 * são a maior parte. Medido num briefing real, em `medium`: 6.005 tokens de
 * saída, dos quais 5.078 de raciocínio — o JSON em si é menos de mil. Um teto
 * apertado corta no meio do objeto, o parser descarta tudo e a chamada inteira
 * é desperdiçada, que sai bem mais caro que a folga.
 */

const log = createLogger("admin/insights");

/**
 * MEDIDO, sobre um briefing real de 2.697 tokens de entrada:
 *
 *   reasoning_effort  latência   tokens de raciocínio
 *   high              203s       15.182
 *   medium             83s        5.078
 *
 * O teto era 180s e o esforço era `high` — ou seja, a chamada estourava por
 * 23 segundos e o card mostrava "a OpenAI não respondeu a tempo" em toda
 * tentativa. O conserto é o esforço, não o teto: 203s de espera por um card
 * seria inaceitável mesmo se coubesse, e a resposta em `medium` não é pior
 * (nas duas medições ela citou os mesmos cinco achados, com o valor à vista no
 * headline). O teto foi para 240s como folga contra variação do upstream,
 * abaixo do `maxDuration` de 300 da rota, deixando espaço para gravar.
 */
const TIMEOUT_MS = 240_000;
const MAX_TOKENS = 24_000;

/**
 * A falha carrega `detail`, e ele CHEGA ATÉ A TELA.
 *
 * A primeira versão colapsava toda falha de upstream numa frase só ("a OpenAI
 * não respondeu a tempo"), e isso custou uma rodada inteira de diagnóstico: o
 * card dizia a mesma coisa para timeout, 400 e 401, e não havia como saber
 * qual era sem abrir o terminal do servidor. Numa tela que só o admin vê, o
 * texto do upstream não é vazamento — é o dado que encurta o conserto.
 */
export type GenerateOutcome =
  | {
      ok: true;
      record: AdminInsightsRecord;
      /**
       * Não-nulo quando a análise SAIU mas não foi gravada.
       *
       * A leitura já foi paga — 85 segundos de modelo de raciocínio — e
       * descartá-la porque o INSERT falhou é queimar dólar por um problema que
       * não é dela. Ela vai para a tela do mesmo jeito, avisando que não
       * sobreviverá ao reload. Foi assim que a tabela faltando em produção se
       * manifestou: a chamada rodou inteira e o 500 veio depois.
       */
      persistError: string | null;
    }
  | { ok: false; reason: "upstream" | "unparseable"; detail: string };

function describe(error: { kind: string; status?: number; message: string }): string {
  if (error.kind === "http") return `HTTP ${error.status}: ${error.message.slice(0, 300)}`;
  // O abort do timeout chega aqui como falha de fetch, indistinguível de queda
  // de rede — daí os dois nomes na mesma frase.
  return `rede ou timeout (${TIMEOUT_MS / 1000}s): ${error.message.slice(0, 300)}`;
}

export async function generateAdminInsights(
  scope: AdminInsightScope,
  adminId: string
): Promise<GenerateOutcome> {
  const model = serverEnv.OPENAI_ADMIN_INSIGHTS_MODEL;
  const briefing = await buildInsightsBriefing(scope);

  const result = await callChat({
    model,
    messages: [
      { role: "system", content: adminInsightsSystemPrompt(scope) },
      { role: "user", content: briefing.text },
    ],
    temperature: 0.4,
    maxTokens: MAX_TOKENS,
    // `medium` é uma decisão MEDIDA, não uma economia — ver TIMEOUT_MS. A
    // tarefa é aritmética sobre uma dúzia de números cruzados, e o esforço
    // médio dá conta dela em 83s; o alto gasta 15 mil tokens de raciocínio,
    // leva 203s e chega nos mesmos achados.
    reasoningEffort: "medium",
    responseFormat: { type: "json_object" },
    timeoutMs: TIMEOUT_MS,
    store: true,
    metadata: { ...buildLlmMetadata({ route: "admin-insights", userId: adminId }), scope },
  });

  if (!result.ok) {
    log.error("upstream falhou", { scope, model, error: result.error });
    return { ok: false, reason: "upstream", detail: describe(result.error) };
  }

  const payload = parseAdminInsightsFromLLM(result.data.content);

  // A telemetria acontece mesmo quando o parse falha: o dólar saiu do bolso do
  // mesmo jeito, e uma falha de formato que não aparecesse no custo seria uma
  // sangria invisível.
  await recordChatUsage({
    sessionId: null,
    route: "admin-insights",
    model,
    promptTokens: result.data.usage.promptTokens,
    completionTokens: result.data.usage.completionTokens,
    cachedTokens: result.data.usage.cachedTokens,
    latencyMs: result.data.latencyMs,
  });

  if (!payload) {
    log.warn("resposta não passou no parser", {
      scope,
      finishReason: result.data.finishReason,
      chars: result.data.content.length,
    });
    return {
      ok: false,
      reason: "unparseable",
      // `finish_reason: "length"` aqui significa que o teto de tokens cortou o
      // JSON — é a diferença entre "suba o MAX_TOKENS" e "conserte o prompt".
      detail: `finish_reason=${result.data.finishReason}, ${result.data.content.length} caracteres`,
    };
  }

  const costUsd = computeChatCost(
    model,
    result.data.usage.promptTokens,
    result.data.usage.completionTokens,
    result.data.usage.cachedTokens
  ).totalUsd;

  let generatedAt = new Date().toISOString();
  let persistError: string | null = null;
  try {
    generatedAt = await writeAdminInsights({
      scope,
      payload,
      model,
      windowDays: briefing.windowDays,
      costUsd,
      adminId,
    });
  } catch (err) {
    persistError = (err as Error).message;
    log.error("gravação falhou — devolvendo a leitura mesmo assim", { scope, error: persistError });
  }

  return {
    ok: true,
    record: { scope, payload, model, windowDays: briefing.windowDays, costUsd, generatedAt },
    persistError,
  };
}

export { readAdminInsights };
