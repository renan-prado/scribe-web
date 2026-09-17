import { z } from "zod";
import { SummaryBlockSchema } from "./summary";

/**
 * O vocabulário do Biblo, a conversa que acontece dentro de uma sessão.
 *
 * Client-safe: é o que a gaveta desenha e o que a rota valida, e os dois
 * precisam do MESMO contrato — uma sugestão que o servidor aceita e o cliente
 * não sabe renderizar é um botão que não aparece, sem erro nenhum na tela.
 *
 * Desenho completo em `docs/biblo-implementacao.md`.
 */

/**
 * O que o Biblo oferece para entrar no texto.
 *
 * **É um `SummaryBlock`, e isso é a regra inteira virada em tipo.** Se o que
 * ele quer oferecer não couber nos oito tipos que o editor já desenha, não há
 * sugestão: a resposta fica na conversa e a pessoa copia. Um "bloco do Biblo"
 * seria um nono tipo que o `BlockRenderer`, o `Composer` e o
 * `WRITTEN_BLOCK_TYPES` teriam de aprender — ver o cabeçalho de
 * `domain/summary.ts` sobre o que acontece quando existe um tipo que só um
 * lado conhece.
 */
export const BibloSuggestionSchema = z.object({
  /** O rótulo do botão, no vocabulário do usuário. */
  label: z.string().min(1).max(60),
  block: SummaryBlockSchema,
  /** Depois de qual bloco entrar. -1 = antes de todos. */
  afterIndex: z.number().int().min(-1),
});

export type BibloSuggestion = z.infer<typeof BibloSuggestionSchema>;

/**
 * O JSON que UMA chamada ao modelo devolve: resposta, próximos chips, sugestão
 * e o fio.
 *
 * Os quatro saem juntos de propósito. Chips derivados do que acabou de ser dito
 * são o que faz a conversa andar sem a pessoa ter de escrever uma linha
 * (`biblo.md` §4), e pedi-los numa segunda chamada dobraria o custo de cada
 * mensagem para gerar três frases curtas.
 */
export const BibloReplySchema = z.object({
  answer: z.string().min(1),
  chips: z.array(z.string().min(1).max(48)).max(4).default([]),
  suggestion: BibloSuggestionSchema.nullable().default(null),
  /**
   * O fio: o que já foi conversado ANTES da janela que vai ao modelo,
   * reescrito a cada resposta. É a memória de uma conversa longa sem o custo
   * de reler a conversa longa — ver a janela deslizante em
   * `docs/biblo-implementacao.md` §1.4.
   */
  thread: z.string().max(600).default(""),
});

export type BibloReply = z.infer<typeof BibloReplySchema>;

export type BibloRole = "user" | "assistant";

/** Como UMA mensagem do usuário foi paga. Espelha o check da migração 0062. */
export type BibloBilling = "gift" | "coins";

/** Uma mensagem, como a gaveta a recebe. */
export type BibloMessage = {
  id: string;
  role: BibloRole;
  content: string;
  chips: string[];
  suggestion: BibloSuggestion | null;
  createdAt: string;
};

/**
 * O que a pessoa pode fazer agora, decidido no servidor.
 *
 * `remaining` só existe no `gift`, e é de propósito: é o único caso em que a
 * gaveta precisa saber que há um fim chegando, para dizer a linha gentil na
 * última mensagem. **Quem paga não recebe número nenhum** — não há nada que a
 * gaveta pudesse fazer com ele além de mostrá-lo, e mostrá-lo é exatamente o
 * que o desenho evita (ver `docs/creditos-na-tela.md`).
 */
export type BibloAllowance =
  | { kind: "coins" }
  | { kind: "gift"; remaining: number }
  | { kind: "denied"; reason: BibloDenial };

export type BibloDenial =
  /** Kill switch: fora para todo mundo, inclusive para o presente. */
  | "disabled"
  /** A conta gratuita usou as mensagens de presente. Reversível assinando. */
  | "gift_exhausted"
  /** Um override do admin revogou para esta pessoa. */
  | "revoked"
  /** Sem saldo. Reversível comprando créditos. */
  | "insufficient_balance";

/** Resposta de `GET /api/biblo?sessionId=`. */
export type BibloConversation = {
  messages: BibloMessage[];
  /** O cumprimento e os chips da abertura, quando a conversa está vazia. */
  opening: { greeting: string; chips: string[] };
  allowance: BibloAllowance;
};

/** Resposta de `POST /api/biblo`. */
export type BibloTurn = {
  /** A pergunta, já gravada. */
  question: BibloMessage;
  answer: BibloMessage;
  allowance: BibloAllowance;
  /** Saldo depois do débito, para a store de moedas não ter de reperguntar. */
  balance: number | null;
};

/** Teto do que a pessoa pode digitar. Uma pergunta não é um texto. */
export const BIBLO_MAX_QUESTION_CHARS = 500;
