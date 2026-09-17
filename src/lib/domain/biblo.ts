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
/**
 * Teto de um chip.
 *
 * 90 e não 48: os chips passaram a ser perguntas faladas ("E os marinheiros
 * junto a Jonas, o que pensavam da situação?"), e as telegráficas que cabiam em
 * 48 eram justamente o que se queria mudar. Acima disto deixa de ser pergunta e
 * vira parágrafo com ponto de interrogação, e a fileira de pastilhas do rodapé
 * vira um bloco de texto.
 *
 * **A folga entre 80 e 90 foi comprada com uma medição.** A `offer` passa por
 * este mesmo teto, e a primeira que o modelo escreveu tinha 84 caracteres:
 * quatro a mais que o limite de então. Ela era descartada em silêncio, e o
 * sintoma era o botão de oferta nunca aparecer — que se lê como "o prompt não
 * funcionou", e leva a mexer no lugar errado.
 */
export const BIBLO_MAX_CHIP_CHARS = 90;

export const BibloSuggestionSchema = z.object({
  /** O rótulo do botão, no vocabulário do usuário. */
  label: z.string().min(1).max(60),
  block: SummaryBlockSchema,
  /** Depois de qual bloco entrar. -1 = antes de todos. */
  afterIndex: z.number().int().min(-1),
});

export type BibloSuggestion = z.infer<typeof BibloSuggestionSchema>;

/**
 * O `afterIndex` que quer dizer "no fim do texto".
 *
 * O campo nasceu para o modelo APONTAR uma posição: ele vê os blocos numerados
 * e diz depois de qual o novo entra. Mas nem toda inserção vem do modelo — o
 * "+" de uma passagem e o "Adicionar ao resumo" de um trecho selecionado são a
 * PESSOA inserindo, e ali não há posição proposta por ninguém.
 *
 * O fim é a resposta certa para esses dois: quem coleta material enquanto
 * conversa está empilhando, não costurando — e mover um bloco dentro do editor
 * é um gesto, enquanto achar onde ele foi parar no meio do texto é uma busca.
 *
 * As duas pontas que consomem uma sugestão já grampeiam o índice ao tamanho da
 * lista (`Math.min` no `BibloSummaryDock`, o `splice` do `insertAt` no editor),
 * então um número grande é literalmente "o fim" nas duas, sem caso especial.
 */
export const BIBLO_AT_END = Number.MAX_SAFE_INTEGER;

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
  /**
   * A pergunta estava FORA DO TERRITÓRIO, e a resposta é a recusa gentil.
   *
   * Código JavaScript, receita de miojo, tradução de e-mail, lição de casa e a
   * tentativa de trocar as instruções do Biblo. O território inteiro está
   * escrito no prompt, e ele é uma pergunta — "isso ajuda a entender, pregar ou
   * escrever o texto na tela?" —, nunca uma lista de assuntos: um Biblo que
   * recusa Nietzsche porque Nietzsche não está na Bíblia falha justamente no
   * trabalho de quem prega. Ver `O TERRITÓRIO` em `prompts/biblo.ts`.
   *
   * **Ele existe para o SERVIDOR, não para a tela.** A recusa é uma resposta
   * como outra qualquer na gaveta; o que o campo faz é fechar as duas portas do
   * documento (`suggestion` e `offer`), que de outro modo abrem sozinhas — o
   * prompt manda oferecer na dúvida, e `verifySuggestion` preenche bloco de
   * prosa vazio com a resposta. Sem esta bandeira, *"aqui eu só falo de
   * Bíblia"* ganha um "Adicionar este parágrafo" embaixo, e um toque distraído
   * põe a recusa no resumo de alguém.
   *
   * `.catch(false)` pela régua do arquivo: uma bandeira malformada não derruba
   * uma resposta já cobrada. O pior caso é o de antes desta linha existir.
   */
  offtopic: z.boolean().default(false).catch(false),
  /**
   * **Vazia é aceita aqui, e resolvida no servidor** — não derruba a resposta.
   *
   * Ela era `.min(1)`, o último campo fatal do contrato, e cobrava caro pelo
   * privilégio: perguntado "insere no resumo um parágrafo sobre a diferença
   * entre as duas parábolas", o modelo escrevia o parágrafo DENTRO de
   * `suggestion.block.text` e mandava `answer: ""` — o pedido foi atendido, o
   * texto existe, e mesmo assim o `POST` respondia `unparseable` **depois de
   * debitar as duas moedas**. E acontecia justamente no pedido mais valioso da
   * conversa, o de pôr algo no documento.
   *
   * Quem decide o que fazer com o vazio é `generateBibloAnswer`: havendo texto
   * na sugestão, ele VIRA a resposta (os dois campos são o mesmo trecho, um
   * para ler e outro para inserir). Vazio dos dois lados, aí sim não há
   * resposta, e aí sim é erro.
   */
  answer: z.string().default(""),
  /**
   * Os chips, **aparados em vez de recusados**.
   *
   * Eles eram `.max(48)` e o schema inteiro caía quando um passava disso: uma
   * resposta boa, já paga e já cobrada, era descartada porque uma sugestão de
   * próxima pergunta tinha três palavras a mais. Chip é decoração; a resposta é
   * o produto. O que não couber sai da lista, e a resposta chega.
   *
   * (Foi exatamente o que aconteceu quando o prompt passou a pedir perguntas em
   * voz de gente, mais longas que as telegráficas de antes.)
   */
  chips: z
    .array(z.string())
    .default([])
    .transform((list) =>
      list
        .map((chip) => chip.trim())
        .filter((chip) => chip.length > 0 && chip.length <= BIBLO_MAX_CHIP_CHARS)
        .slice(0, 4)
    ),
  /**
   * **`.catch(null)` e não só `.nullable()`**: uma sugestão malformada vira
   * "sem sugestão", e não a perda da resposta inteira.
   *
   * Foi medido: pedindo `text` vazio, o modelo às vezes devolve o BLOCO no
   * lugar do envelope (`{type, text}` em vez de `{label, block, afterIndex}`).
   * Sem o `catch`, esse deslize derrubava o schema todo e a pessoa perdia —
   * já cobrada — uma resposta que estava correta. Mesma régua dos chips.
   */
  suggestion: BibloSuggestionSchema.nullable().catch(null).default(null),
  /**
   * A OFERTA de escrever um trecho, na voz de quem pede: "Escreve um parágrafo
   * sobre isso". `null` quando a resposta não daria texto para o documento.
   *
   * **Ela tem campo próprio porque, dentro de `chips`, ela simplesmente não
   * acontecia.** Os chips são pedidos como perguntas ("escreva-os como ELA
   * perguntaria"), e uma oferta não é uma pergunta: com quatro vagas e uma
   * instrução de pergunta, o modelo enchia as quatro de perguntas e a oferta
   * nunca saía — medido, três rodadas seguidas. Um campo que precisa ser
   * preenchido ou dito nulo é a diferença entre pedir e obter.
   *
   * O servidor a junta a `chips` antes de gravar (ver `biblo/answer.ts`): a
   * oferta é uma pastilha que se toca como as outras, e separá-la na tela
   * seria um segundo mecanismo para o mesmo gesto.
   */
  offer: z
    .string()
    .nullable()
    .default(null)
    .transform((text) => {
      const trimmed = text?.trim() ?? "";
      return trimmed.length > 0 && trimmed.length <= BIBLO_MAX_CHIP_CHARS ? trimmed : null;
    }),
  /**
   * A passagem que a pessoa precisa ter DIANTE DOS OLHOS para acompanhar esta
   * resposta — "Lucas 19:11-27" —, e `null` quando a resposta não gira em torno
   * de um trecho.
   *
   * **Tem campo próprio pela mesma razão que a `offer` tem**, e a medição foi a
   * mesma. O prompt pede que a referência a ser MOSTRADA fique sozinha numa
   * linha (é o que o `BibloPassage` reconhece na tela), com exemplo do formato
   * e uma seção explicando por quê. Duas rodadas seguidas o modelo escreveu
   * "Ela aparece em Lucas 19:11-27 e fala de..." no meio da frase: correto pelo
   * contrato de sempre, e sem a passagem na tela, que é o que se queria.
   *
   * Uma instrução sobre ONDE pôr um texto disputa com o hábito de escrever
   * prosa, e perde. Um campo separado não disputa com nada. O servidor a
   * encaixa na resposta (ver `splicePassage` em `biblo/answer.ts`), depois de
   * conferi-la contra a NVI — o modelo continua sem a caneta do texto bíblico.
   */
  passage: z
    .string()
    .nullable()
    .default(null)
    .transform((text) => {
      const trimmed = text?.trim() ?? "";
      return trimmed.length > 0 && trimmed.length <= 60 ? trimmed : null;
    }),
  /**
   * O fio: o que já foi conversado ANTES da janela que vai ao modelo,
   * reescrito a cada resposta. É a memória de uma conversa longa sem o custo
   * de reler a conversa longa — ver a janela deslizante em
   * `docs/biblo-implementacao.md` §1.4.
   *
   * Cortado, e não recusado, pelo mesmo motivo dos chips: o fio é memória
   * nossa, e um fio comprido demais não é razão para a pessoa perder a
   * resposta que pagou.
   */
  thread: z
    .string()
    .default("")
    .transform((text) => text.slice(0, 600)),
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
