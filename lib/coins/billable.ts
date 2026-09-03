/**
 * As AÇÕES cobráveis do produto — a unidade em que a precificação é decidida.
 *
 * `pricing.ts` responde "quanto custa" em moedas; este arquivo responde "o que
 * é uma coisa". São perguntas diferentes: `deepening` e `reprocess_deepening`
 * são dois motivos no ledger e UM produto (o mesmo pipeline, o mesmo preço), e
 * `live_minute` é um motivo que só faz sentido lido junto com os minutos que o
 * usuário gravou. Sem esta camada, o painel de custo mostraria motivos de
 * lançamento contábil onde o usuário precisa ver decisões de preço.
 *
 * Client-safe: a tela de precificação lê daqui e a agregação server-only
 * também. É o mesmo motivo de `lib/partners/economics.ts` ser client-safe —
 * duas cópias da conta é como se descobre tarde que uma delas estava errada.
 *
 * O mapeamento ROTA → ação NÃO mora aqui, e sim em `lib/db/admin/usage.ts`:
 * ele depende de `UsageRoute`, que é vocabulário do servidor, e inclui rotas
 * legadas que não existem mais no código mas continuam no banco.
 */

import { type ChargeReason, COIN_COSTS } from "./pricing";

export const BILLABLE_ACTION_KEYS = [
  "live",
  "audio_only",
  "transcript_only",
  "study",
  "reprocess_summary",
] as const;
export type BillableActionKey = (typeof BILLABLE_ACTION_KEYS)[number];

export type BillableAction = {
  key: BillableActionKey;
  label: string;
  /** Moedas debitadas por execução. Espelha COIN_COSTS. */
  coins: number;
  /** O que UMA execução é, no singular, para a coluna "por ...". */
  unit: string;
  /** Motivos do ledger que somam nesta ação. */
  reasons: readonly ChargeReason[];
  /** Por que a linha existe / o que ela inclui. Vira o subtítulo da linha. */
  note: string;
};

export const BILLABLE_ACTIONS: readonly BillableAction[] = [
  {
    key: "live",
    label: "Modo Ao Vivo",
    coins: COIN_COSTS.liveMinute,
    unit: "minuto",
    reasons: ["live_minute"],
    note: "Transcrição, os três pipelines do feed, resumo final e os cards de acompanhamento.",
  },
  {
    key: "audio_only",
    label: "Modo Áudio",
    coins: COIN_COSTS.audioOnlyMinute,
    unit: "minuto",
    reasons: ["audio_only_minute"],
    note: "Transcrição e resumo final, sem os pipelines do feed.",
  },
  {
    key: "transcript_only",
    label: "Modo Transcrição",
    coins: COIN_COSTS.transcriptMinute,
    unit: "minuto",
    reasons: ["transcript_minute"],
    note: "Só transcrição. Nenhuma chamada de LLM além do STT.",
  },
  {
    key: "study",
    label: "Estudo aprofundado",
    coins: COIN_COSTS.deepening,
    unit: "estudo",
    reasons: ["deepening", "reprocess_deepening"],
    // Gerar e reprocessar rodam `generateStudy` com as MESMAS rotas de
    // telemetria, então o custo dos dois é indistinguível no banco. Como o
    // preço também é o mesmo, somá-los não perde informação nenhuma — separar
    // as linhas é que daria um custo por execução inventado.
    note: "Gerar E reprocessar estudo, somados — 50 moedas cada. Mesmo pipeline, custo indistinguível na telemetria.",
  },
  {
    key: "reprocess_summary",
    label: "Reprocessar resumo",
    coins: COIN_COSTS.reprocessSummary,
    unit: "repro",
    reasons: ["reprocess_summary"],
    note: "Reexecução do RESUMO de uma sessão salva — não confundir com reprocessar o estudo, que custa 50 e está na linha acima.",
  },
];

export const BILLABLE_ACTION_BY_KEY: Record<BillableActionKey, BillableAction> = Object.fromEntries(
  BILLABLE_ACTIONS.map((a) => [a.key, a])
) as Record<BillableActionKey, BillableAction>;

/**
 * Custo que NÃO tem ação cobrável atrás dele: chamadas fora de uma gravação
 * (consulta de versículo avulsa, formatação de parágrafo) e eventos cuja
 * sessão foi apagada. Não é uma ação — é a linha que mostra quanto o produto
 * gasta sem cobrar, e ela precisa aparecer ou o custo por moeda fica otimista.
 */
export const UNBILLED_ACTION_KEY = "unbilled" as const;

/**
 * Custo que o PRÓPRIO PAINEL gera: hoje, a análise diária de
 * `/api/admin/insights`. Separado de `unbilled` porque as duas linhas têm
 * consertos opostos — gasto sem cobrança é preço mal ajustado (a resposta é
 * cobrar por aquilo, ou parar de oferecer de graça), e custo interno é
 * despesa operacional nossa, que nunca vai ter moeda atrás.
 *
 * Somá-lo ao `unbilled` faria a tela de precificação sugerir cobrar do
 * usuário por uma chamada que só o admin dispara. Escondê-lo faria o custo
 * total do painel não bater com a fatura da OpenAI.
 */
export const INTERNAL_ACTION_KEY = "internal" as const;

export type UsageActionKey =
  | BillableActionKey
  | typeof UNBILLED_ACTION_KEY
  | typeof INTERNAL_ACTION_KEY;

/** As duas chaves que não são ação cobrável — não entram na tabela de margem. */
export const NON_BILLABLE_ACTION_KEYS: readonly UsageActionKey[] = [
  UNBILLED_ACTION_KEY,
  INTERNAL_ACTION_KEY,
];
