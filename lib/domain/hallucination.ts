import { z } from "zod";

/**
 * "Alertar alucinação", o usuário percebeu que o Scriba entendeu errado e
 * escreve uma nota curta explicando o que está errado. A nota vai para o LLM
 * junto com a transcrição e o material já produzido (cards do feed ao vivo,
 * ou o resumo salvo); ele decide entre corrigir (apontando quais cards não se
 * sustentam na transcrição), sugerir encerrar a gravação, sugerir reprocessar
 * o resumo, ou apenas registrar quando não há o que corrigir sozinho.
 *
 * A nota é curta de propósito: o valor está em apontar O QUE está errado
 * ("ele não citou Tiago", "o texto era Efésios 2"), não em escrever um
 * relatório. O limite também protege o prompt de payload inflado.
 */
export const MAX_HALLUCINATION_NOTE_CHARS = 300;

/**
 * `live` era o alerta disparado DURANTE a gravação, sobre os cards do feed ao
 * vivo. Nenhum relatório novo nasce com ele desde que o feed deixou de existir;
 * ele fica porque `hallucination_reports` guarda linhas antigas com esse valor.
 */
export const HALLUCINATION_SCOPES = ["live", "summary"] as const;
export type HallucinationScope = (typeof HALLUCINATION_SCOPES)[number];

export const HALLUCINATION_VERDICTS = [
  /**
   * `corrected` era "removi os cards sem apoio na transcrição". Não há mais
   * cards, e o auditor não recebe mais permissão de emiti-lo; ele fica no enum
   * porque `hallucination_reports` guarda vereditos antigos com esse valor.
   */
  "corrected",
  /** A transcrição em si está comprometida; nenhum resumo sobre ela confia. */
  "suggest_stop",
  /** Resumo salvo: o material tem conserto, mas exige reprocessar. */
  "suggest_reprocess",
  /** Nada a corrigir automaticamente, o relato fica registrado. */
  "acknowledged",
] as const;
export type HallucinationVerdict = (typeof HALLUCINATION_VERDICTS)[number];

export type HallucinationReview = {
  verdict: HallucinationVerdict;
  /** Texto curto em pt-BR mostrado ao usuário explicando a conclusão. */
  message: string;
};

const LlmShapeSchema = z.object({
  verdict: z.enum(HALLUCINATION_VERDICTS),
  message: z.string().min(1),
});

const FALLBACK_MESSAGE =
  "Registrei seu alerta, mas não consegui analisar automaticamente agora. " +
  "Se a transcrição continuar ruim, vale encerrar e conferir o microfone.";

/**
 * Converte a resposta do LLM em um HallucinationReview.
 *
 * Um veredito `corrected` que chegue aqui é rebaixado para `acknowledged`: não
 * existe mais nada que o auditor possa remover sozinho, e dizer "corrigi" sem
 * ter corrigido seria mentir para o usuário justamente na tela em que ele veio
 * reclamar de invenção.
 */
export function parseHallucinationReviewFromLLM(content: string): HallucinationReview {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return { verdict: "acknowledged", message: FALLBACK_MESSAGE };
  }
  const parsed = LlmShapeSchema.safeParse(obj);
  if (!parsed.success) {
    return { verdict: "acknowledged", message: FALLBACK_MESSAGE };
  }

  const message = parsed.data.message.trim();
  if (parsed.data.verdict === "corrected") {
    return { verdict: "acknowledged", message };
  }

  return { verdict: parsed.data.verdict, message };
}
