import { z } from "zod";

/**
 * "Alertar alucinação" — o usuário percebeu que o Scriba entendeu errado e
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

export const HALLUCINATION_SCOPES = ["live", "summary"] as const;
export type HallucinationScope = (typeof HALLUCINATION_SCOPES)[number];

export const HALLUCINATION_VERDICTS = [
  /** Encontrou cards que não se sustentam na transcrição — devem sair do feed. */
  "corrected",
  /** A transcrição em si está comprometida; seguir gravando só gasta moedas. */
  "suggest_stop",
  /** Resumo salvo: o material tem conserto, mas exige reprocessar. */
  "suggest_reprocess",
  /** Nada a corrigir automaticamente — o relato fica registrado. */
  "acknowledged",
] as const;
export type HallucinationVerdict = (typeof HALLUCINATION_VERDICTS)[number];

export type HallucinationReview = {
  verdict: HallucinationVerdict;
  /** Texto curto em pt-BR mostrado ao usuário explicando a conclusão. */
  message: string;
  /**
   * Chaves de dedup dos itens do feed que devem sair da tela (apenas no
   * escopo "live"). O servidor traduz os índices devolvidos pelo LLM para
   * chaves — índices sozinhos escorregariam se o feed crescesse entre o envio
   * e a resposta.
   */
  removeKeys: string[];
};

const LlmShapeSchema = z.object({
  verdict: z.enum(HALLUCINATION_VERDICTS),
  message: z.string().min(1),
  removeIndices: z.array(z.number().int().nonnegative()).optional(),
});

const FALLBACK_MESSAGE =
  "Registrei seu alerta, mas não consegui analisar automaticamente agora. " +
  "Se a transcrição continuar ruim, vale encerrar e conferir o microfone.";

/** Usada quando o LLM diz ter corrigido mas não aponta nenhum card existente.
 * A mensagem dele afirmaria uma remoção que não houve. */
const NOTHING_REMOVED_MESSAGE =
  "Registrei seu alerta, mas não identifiquei com segurança qual card remover. " +
  "Se ele continuar na tela, vale encerrar e conferir a transcrição.";

/**
 * Converte a resposta do LLM em um HallucinationReview. `resolveKey` mapeia um
 * índice do feed enviado no prompt para a chave de dedup correspondente, e
 * devolve null para índices fora da lista (alucinação do próprio corretor).
 *
 * Um veredito "corrected" que não aponta nenhum item válido é rebaixado para
 * "acknowledged" — dizer "corrigi" sem remover nada seria mentir para o
 * usuário justamente na tela em que ele veio reclamar de invenção.
 */
export function parseHallucinationReviewFromLLM(
  content: string,
  resolveKey: (index: number) => string | null
): HallucinationReview {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return { verdict: "acknowledged", message: FALLBACK_MESSAGE, removeKeys: [] };
  }
  const parsed = LlmShapeSchema.safeParse(obj);
  if (!parsed.success) {
    return { verdict: "acknowledged", message: FALLBACK_MESSAGE, removeKeys: [] };
  }

  const removeKeys: string[] = [];
  for (const index of parsed.data.removeIndices ?? []) {
    const key = resolveKey(index);
    if (key && !removeKeys.includes(key)) removeKeys.push(key);
  }

  // Rebaixa "corrigi" que não removeu nada — e troca a mensagem junto, senão
  // ela afirmaria uma remoção que não aconteceu.
  if (parsed.data.verdict === "corrected" && removeKeys.length === 0) {
    return { verdict: "acknowledged", message: NOTHING_REMOVED_MESSAGE, removeKeys: [] };
  }

  return { verdict: parsed.data.verdict, message: parsed.data.message.trim(), removeKeys };
}
