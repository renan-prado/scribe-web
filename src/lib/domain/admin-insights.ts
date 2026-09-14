import { z } from "zod";

/**
 * A leitura que um modelo faz dos números do painel.
 *
 * Client-safe: o painel que renderiza isto é um componente cliente (ele
 * precisa do botão que dispara a geração e do estado de carregando), e o
 * parser roda nas DUAS pontas, na geração, antes de persistir, e na leitura,
 * porque o que ficou gravado ontem pode não casar com o tipo de hoje.
 *
 * ## Uma leitura, não três
 *
 * Ela já foi TRÊS, uma por tela de dinheiro (`pricing`, `usage`, `metrics`),
 * cada uma no card lateral da sua página. O arranjo tinha dois defeitos que só
 * aparecem com o painel em uso: as três diziam quase a mesma coisa (saem dos
 * mesmos eventos, só recortados diferente) e nenhuma delas era lida, porque um
 * card ao lado de uma tabela é enfeite da tabela. Hoje é UMA leitura geral, com
 * página própria (`/admin/insights`) e um briefing que atravessa custo, preço e
 * funil, que é como as perguntas de fato se cruzam.
 *
 * ## A forma tem uma tese
 *
 * `finding` e `action` são campos SEPARADOS de propósito. Pedindo um parágrafo
 * livre, o modelo escreve análise: um texto bem-educado que descreve o número
 * que o admin acabou de ler na tabela. Separando, ele tem de terminar cada item
 * com uma frase no imperativo, e um item cuja ação seria "continue observando"
 * fica visivelmente vazio, que é o sinal de que aquele item não devia existir.
 *
 * `severity` existe pela mesma razão que a margem da tabela é uma pastilha
 * colorida: cinco parágrafos de igual peso visual não têm ordem de leitura, e
 * o admin que abre o painel entre duas reuniões precisa saber em 3 segundos
 * se há algo pegando fogo.
 */

export const INSIGHT_SEVERITIES = ["critical", "warning", "ok"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

/** Quantos itens sobrevivem. Mais que isto vira relatório, e relatório não se lê. */
export const MAX_INSIGHTS = 5;

const InsightSchema = z.object({
  title: z.string().min(1).max(80),
  severity: z.enum(INSIGHT_SEVERITIES),
  /** O número e o que ele diz. Precisa CITAR o número, ver o prompt. */
  finding: z.string().min(1).max(600),
  /** O que fazer. Imperativo, específico, e com o valor sugerido quando houver. */
  action: z.string().min(1).max(400),
});

export type AdminInsight = z.infer<typeof InsightSchema>;

const PayloadSchema = z.object({
  /** Uma frase. O estado geral, para quem só vai ler a primeira linha. */
  headline: z.string().min(1).max(240),
  insights: z.array(InsightSchema),
});

export type AdminInsightsPayload = z.infer<typeof PayloadSchema>;

/** O que a tela recebe: o texto mais a procedência dele. */
export type AdminInsightsRecord = {
  payload: AdminInsightsPayload;
  model: string;
  windowDays: number;
  costUsd: number;
  generatedAt: string;
};

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, ok: 2 };

/**
 * Parse do JSON do LLM. Devolve `null` quando não sobrou nada utilizável, um
 * painel vazio é melhor que um painel com um item alucinado, e o chamador trata
 * `null` como "não gerou" em vez de persistir lixo.
 *
 * A ordenação por severidade é feita AQUI e não no prompt: pedir ao modelo que
 * ordene é gastar instrução com uma coisa que o código faz sem errar.
 */
export function parseAdminInsightsFromLLM(content: string): AdminInsightsPayload | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }

  const parsed = PayloadSchema.safeParse(obj);
  if (!parsed.success) {
    // Uma entrada malformada não pode derrubar as outras quatro: revalida item
    // a item e fica com o que passar.
    const rec = (obj ?? {}) as Record<string, unknown>;
    const headline = typeof rec.headline === "string" ? rec.headline.trim().slice(0, 240) : "";
    const raw = Array.isArray(rec.insights) ? rec.insights : [];
    const kept = raw
      .map((entry) => InsightSchema.safeParse(entry))
      .flatMap((r) => (r.success ? [r.data] : []));
    if (!headline || kept.length === 0) return null;
    return sort({ headline, insights: kept });
  }

  if (parsed.data.insights.length === 0) return null;
  return sort(parsed.data);
}

function sort(payload: AdminInsightsPayload): AdminInsightsPayload {
  return {
    headline: payload.headline,
    insights: [...payload.insights]
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, MAX_INSIGHTS),
  };
}

/**
 * A janela de análise é FIXA, e não o filtro de período das telas de dinheiro.
 *
 * /admin/precificacao tem pílulas de 7/30/90 dias, e amarrar a leitura a elas
 * daria quatro variantes da mesma pergunta, cada uma uma chamada de modelo de
 * raciocínio. Trinta dias é a janela em que a pergunta de preço tem resposta:
 * sete dias não cobrem um mês de assinatura, e noventa diluem uma troca de
 * modelo feita semana passada.
 */
export const INSIGHTS_WINDOW_DAYS = 30;
