/**
 * As AÇÕES cobráveis do produto, a unidade em que a precificação é decidida.
 *
 * `pricing.ts` responde "quanto custa" em moedas; este arquivo responde "o que
 * é uma coisa". São perguntas diferentes: `deepening` e `reprocess_deepening`
 * são dois motivos no ledger e UM produto (o mesmo pipeline, o mesmo preço), e
 * os quatro motivos por minuto que já existiram são hoje uma linha só. Sem esta camada, o painel de custo mostraria motivos de
 * lançamento contábil onde o usuário precisa ver decisões de preço.
 *
 * Client-safe: a tela de precificação lê daqui e a agregação server-only
 * também. É o mesmo motivo de `lib/partners/economics.ts` ser client-safe,
 * duas cópias da conta é como se descobre tarde que uma delas estava errada.
 *
 * O mapeamento ROTA → ação NÃO mora aqui, e sim em `lib/db/admin/usage.ts`:
 * ele depende de `UsageRoute`, que é vocabulário do servidor, e inclui rotas
 * legadas que não existem mais no código mas continuam no banco.
 */

import { COIN_COSTS } from "./pricing";

export const BILLABLE_ACTION_KEYS = ["recording", "youtube", "study", "reprocess_summary"] as const;
export type BillableActionKey = (typeof BILLABLE_ACTION_KEYS)[number];

export type BillableAction = {
  key: BillableActionKey;
  label: string;
  /** Moedas debitadas por execução. Espelha COIN_COSTS. */
  coins: number;
  /** O que UMA execução é, no singular, para a coluna "por ...". */
  unit: string;
  /**
   * Motivos do ledger que somam nesta ação. `string` e não `ChargeReason`
   * porque as listas incluem motivos LEGADOS, que nenhum cliente emite mais e
   * que continuam gravados em `coin_transactions` (ver `LEGACY_CHARGE_REASONS`
   * em `pricing.ts`). Tipá-los como motivo vivo obrigaria a ressuscitar nomes
   * mortos no enum só para o painel conseguir somar o passado.
   */
  reasons: readonly string[];
  /** Por que a linha existe / o que ela inclui. Vira o subtítulo da linha. */
  note: string;
};

export const BILLABLE_ACTIONS: readonly BillableAction[] = [
  {
    key: "recording",
    label: "Gravação",
    coins: COIN_COSTS.recordingMinute,
    unit: "minuto",
    // Os três motivos antigos eram os três modos de captura, todos cobrados
    // por minuto gravado. Eles viraram um só produto, então viram uma linha só
    // no painel: separá-los hoje seria comparar preços que não existem mais.
    reasons: ["recording_minute", "audio_only_minute", "live_minute", "transcript_minute"],
    note: "Transcrição no stop e resumo final. Único preço por minuto do produto.",
  },
  {
    key: "youtube",
    label: "Importação do YouTube",
    coins: COIN_COSTS.youtubeImport,
    // "vídeo" e não "minuto": esta é a única ação cobrável do produto cuja
    // unidade não é o minuto, e a coluna "por ..." do painel precisa dizer
    // isso, 30 moedas por minuto seria um preço absurdo, e é o que a linha
    // pareceria estar afirmando se herdasse a unidade das três de cima.
    unit: "vídeo",
    reasons: ["youtube_import"],
    note: "Legenda do vídeo pela Supadata (~1 crédito, R$ 0,03) e o resumo completo por cima. Nenhum minuto de STT. O custo cresce com a DURAÇÃO do vídeo e o preço não, é o teto de 2h em lib/domain/youtube.ts que segura a margem.",
  },
  {
    key: "study",
    label: "Estudo aprofundado",
    coins: COIN_COSTS.deepening,
    unit: "estudo",
    reasons: ["deepening", "reprocess_deepening"],
    // Gerar e reprocessar rodam `generateStudy` com as MESMAS rotas de
    // telemetria, então o custo dos dois é indistinguível no banco. Como o
    // preço também é o mesmo, somá-los não perde informação nenhuma, separar
    // as linhas é que daria um custo por execução inventado.
    note: "Gerar E reprocessar estudo, somados, 50 moedas cada. Mesmo pipeline, custo indistinguível na telemetria.",
  },
  {
    key: "reprocess_summary",
    label: "Resumo de sessão salva",
    coins: COIN_COSTS.reprocessSummary,
    unit: "resumo",
    // `summary_from_transcript` era o primeiro resumo de uma sessão do modo
    // transcrição, e rodava o MESMO pipeline pelo mesmo preço. O modo morreu, o
    // motivo continua no ledger, e somá-lo aqui é o que mantém o histórico
    // comparável.
    reasons: ["reprocess_summary", "summary_from_transcript"],
    note: "Resumo rodado FORA da gravação, sobre uma sessão já salva. Não confundir com reprocessar o estudo, que custa 50 e está na linha acima.",
  },
];

export const BILLABLE_ACTION_BY_KEY: Record<BillableActionKey, BillableAction> = Object.fromEntries(
  BILLABLE_ACTIONS.map((a) => [a.key, a])
) as Record<BillableActionKey, BillableAction>;

/**
 * Custo que NÃO tem ação cobrável atrás dele: chamadas fora de uma gravação
 * (consulta de versículo avulsa, formatação de parágrafo) e eventos cuja
 * sessão foi apagada. Não é uma ação, é a linha que mostra quanto o produto
 * gasta sem cobrar, e ela precisa aparecer ou o custo por moeda fica otimista.
 */
export const UNBILLED_ACTION_KEY = "unbilled" as const;

/**
 * Custo que o PRÓPRIO PAINEL gera: hoje, a análise diária de
 * `/api/admin/insights`. Separado de `unbilled` porque as duas linhas têm
 * consertos opostos, gasto sem cobrança é preço mal ajustado (a resposta é
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

/** As duas chaves que não são ação cobrável, não entram na tabela de margem. */
export const NON_BILLABLE_ACTION_KEYS: readonly UsageActionKey[] = [
  UNBILLED_ACTION_KEY,
  INTERNAL_ACTION_KEY,
];
