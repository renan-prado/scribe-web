import "server-only";
import {
  BIBLO_SYSTEM_PROMPT,
  bibloContextBlock,
  bibloLexiconBlock,
} from "@/features/session/server/prompts/biblo";
import { anchorReference } from "@/features/session/server/study/anchor";
import type { BibloRow } from "@/lib/db/biblo";
import { getLexiconCards, getLexiconIndex } from "@/lib/db/lexicon";
import { annotateText, asStandaloneScripture } from "@/lib/domain/annotate";
import { type BibloReply, BibloReplySchema, type BibloSuggestion } from "@/lib/domain/biblo";
import type { LexiconCard, LexiconIndexEntry } from "@/lib/domain/lexicon";
import { parseVerseReference } from "@/lib/domain/reference";
import type { SummaryBlock, SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { type ChatMessage, type ChatResult, callChat, type Result } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";

const log = createLogger("biblo");

/**
 * O motor de uma mensagem: monta o prompt, chama o modelo, valida a resposta e
 * resolve as referências bíblicas contra a NVI local.
 *
 * As duas constantes abaixo são AMARRAS DE MARGEM, não ajustes de gosto. O
 * preço de `COIN_COSTS.bibloMessage` foi calculado com as duas no lugar; sem
 * elas o custo de uma mensagem não tem teto superior nenhum — cresce com o
 * tamanho do resumo na entrada e com o tamanho da resposta na saída — e a
 * conta que justifica o preço deixa de valer. Ver `features/coins/pricing.ts`.
 */

/**
 * Teto da saída da chamada. Uma resposta de chat longa demais é pior de ler E
 * dobra a parcela mais cara da conta (token de saída). O prompt já pede
 * resposta curta; isto é a mesma regra escrita onde ela é obrigatória em vez de
 * pedida.
 *
 * ## 700 e não 400, porque 400 CORTAVA O JSON NO MEIO
 *
 * Este número não limita a resposta: limita o OBJETO INTEIRO — a prosa, os
 * quatro chips, a sugestão, a oferta, a passagem e o fio. Em 400 ele era um
 * orçamento apertado para sete campos, e quando estourava o modelo parava de
 * escrever no meio de uma string. O que chegava aqui era um JSON quebrado,
 * `JSON.parse` estourava, e a pessoa via *"Não consegui responder agora"* com
 * a moeda já debitada.
 *
 * **Medido em produção (17/09/2026):** das 105 chamadas do dia, 4 terminaram em
 * `finish_reason: "length"` — todas em 400 tokens exatos, todas com JSON
 * inválido, todas sem resposta na tela. A prosa sozinha ficava em ~270 tokens
 * na mediana e ~350 no topo; o que estourava era a SOMA dos campos, sempre nas
 * respostas em que o modelo também escrevia um bloco para o resumo.
 *
 * Em 700 a folga é de duas vezes o pico medido, e o custo praticamente não se
 * mexe: o teto só é alcançado pelas poucas que o alcançavam, e ~300 tokens de
 * saída a mais nelas são R$ 0,0003. A margem medida de 82% (`/admin/custos`,
 * linha "Biblo") não sente. Quem segura o tamanho da PROSA continua sendo o
 * prompt, que é onde essa decisão é de leitura e não de orçamento.
 */
export const BIBLO_ANSWER_MAX_TOKENS = 700;

/**
 * Teto do resumo que entra no prompt, em CARACTERES (~4 por token em
 * português). Quase todo resumo cabe folgado; o que não couber entra truncado
 * pelo fim — o começo de um resumo (título, ideia central, primeiros blocos) é
 * o que mais diz sobre o que se está conversando.
 */
export const BIBLO_SUMMARY_CHAR_BUDGET = 10_000;

/**
 * A janela: quantos PARES de mensagens vão ao modelo.
 *
 * É o que mantém o custo por mensagem CONSTANTE. Sem ela, cada resposta releria
 * a conversa inteira e a vigésima mensagem custaria quatro vezes a primeira —
 * um preço fixo por mensagem estaria errado justamente na conversa longa, que
 * é a boa. O que fica fora da janela não some: vira o `thread`, o fio que a
 * própria chamada reescreve a cada resposta, de graça.
 */
export const BIBLO_WINDOW_PAIRS = 6;

/**
 * Rede de segurança para um marcador `[[Jonas 1:3]]` perdido.
 *
 * O prompt PEDIU essa sintaxe numa versão e o modelo não a usou: medido, o
 * `gpt-4.1-mini` escreve a referência em prosa ("em Lucas 15 Jesus conta…"),
 * que é o que a gente queria de qualquer jeito — o `RichText` da gaveta já
 * transforma referência em prosa num link para a NVI, igual ao resumo e ao
 * estudo. O prompt passou a pedir a prosa, e isto aqui ficou: se um marcador
 * escapar, ele vira a referência limpa em vez de aparecer com colchetes na
 * cara de quem lê.
 */
const MARKER_RE = /\[\[([^\]]{1,80})\]\]/g;

export type BibloAnswerInput = {
  userId: string;
  sessionId: string;
  summary: SummaryPayload | null;
  speakerName: string | null;
  /** A conversa inteira, em ordem. A janela é recortada aqui dentro. */
  history: BibloRow[];
  question: string;
};

export type BibloAnswerOk = {
  reply: BibloReply;
  /** A entrada do léxico que ilustra a resposta, ou `null`. Ver `entityForAnswer`. */
  entitySlug: string | null;
  model: string;
  usage: ChatResult["usage"];
  latencyMs: number;
};

export type BibloAnswerResult =
  | { ok: true; data: BibloAnswerOk }
  | { ok: false; kind: "upstream" | "unparseable"; message: string };

/**
 * Os blocos do resumo, numerados, cortados no orçamento.
 *
 * O índice é o que `suggestion.afterIndex` aponta, e é por isso que ele vai
 * escrito: um modelo que não vê o número chuta a posição, e a sugestão entra no
 * meio do texto errado.
 */
function renderBlocks(blocks: SummaryBlock[]): string[] {
  const lines: string[] = [];
  let used = 0;
  for (const [index, block] of blocks.entries()) {
    const body =
      block.type === "bibleQuote"
        ? `${block.reference}${block.text ? ` — ${block.text}` : ""}`
        : block.type === "quote" && block.author
          ? `${block.text} — ${block.author}`
          : block.text;
    const line = `[${index}] ${block.type}: ${body}`;
    if (used + line.length > BIBLO_SUMMARY_CHAR_BUDGET) {
      lines.push(`[…] (o resumo continua, mais ${blocks.length - index} blocos)`);
      break;
    }
    lines.push(line);
    used += line.length;
  }
  return lines;
}

/** A última resposta do Biblo nesta conversa, ou vazio na primeira mensagem. */
function latestAnswer(history: BibloRow[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") return history[i].content;
  }
  return "";
}

/**
 * A prosa de uma resposta, sem as linhas que são só uma referência.
 *
 * Uma passagem é um CARTÃO dentro da conversa; dentro de um `paragraph` do
 * resumo ela viraria uma referência solta no meio do texto de alguém. Quem
 * quiser a passagem no documento tem o "+" do próprio cartão.
 */
function withoutPassageLines(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => !asStandaloneScripture(paragraph))
    .join("\n\n");
}

/** O fio mais recente: o último que o assistente escreveu. */
function latestThread(history: BibloRow[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const thread = history[i].thread;
    if (thread) return thread;
  }
  return "";
}

function windowMessages(history: BibloRow[]): ChatMessage[] {
  const window = history.slice(-BIBLO_WINDOW_PAIRS * 2);
  return window.map((row) => ({
    role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: row.content,
  }));
}

/**
 * Troca `[[Jonas 1:1-3]]` pela referência limpa, e APAGA a que não resolve.
 *
 * O texto do versículo nunca entra aqui: quem o desenha é o `RichText` da
 * gaveta, que reconhece a referência em prosa e abre a NVI local no clique — o
 * mesmo caminho do resumo e do estudo. Ou seja, **em nenhum ponto o modelo tem
 * a caneta do texto bíblico**, que é a única forma de um versículo inventado
 * ser impossível em vez de improvável.
 */
async function resolveMarkers(text: string): Promise<{ text: string; dropped: number }> {
  const raw = [...text.matchAll(MARKER_RE)].map((m) => m[1].trim());
  if (raw.length === 0) return { text, dropped: 0 };

  const unique = [...new Set(raw)];
  const resolved = new Map<string, string | null>();
  await Promise.all(
    unique.map(async (ref) => {
      const anchored = await anchorReference(ref).catch(() => null);
      resolved.set(ref, anchored?.reference ?? null);
    })
  );

  let dropped = 0;
  const next = text.replace(MARKER_RE, (_match, inner: string) => {
    const hit = resolved.get(inner.trim());
    if (hit) return hit;
    dropped++;
    return "";
  });
  // Um marcador apagado deixa espaço duplo e " ." para trás.
  return {
    text: next
      .replace(/ {2,}/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim(),
    dropped,
  };
}

/**
 * A passagem do campo `passage` encaixada na resposta, como linha própria.
 *
 * ## Por que o servidor encaixa, em vez de o modelo escrever no lugar certo
 *
 * Porque foi pedido e não aconteceu. O prompt tem a regra, o exemplo do formato
 * e o parágrafo dizendo por que ela existe; em duas rodadas seguidas o modelo
 * escreveu "Ela aparece em Lucas 19:11-27 e fala de..." dentro da frase. Não é
 * desobediência, é gravidade: uma instrução sobre a DISPOSIÇÃO de um texto
 * disputa com o hábito de escrever prosa corrida, e perde. O campo separado não
 * disputa com nada — é a mesma lição da `offer`, medida do mesmo jeito.
 *
 * ## Onde ela entra
 *
 * Depois do PRIMEIRO parágrafo: apresenta, mostra, comenta. É a ordem do
 * exemplo do prompt e a ordem natural de quem conversa sobre um texto — ninguém
 * abre a Bíblia antes de dizer o que vai ler, nem depois de já ter comentado.
 * Com um parágrafo só, ela vai ao fim, que é o mesmo lugar.
 *
 * ## Duas guardas
 *
 * **Se a referência já está sozinha numa linha, nada acontece.** O modelo
 * acerta às vezes, e encaixar de novo daria a mesma passagem duas vezes.
 *
 * **A referência é conferida contra a NVI antes de entrar** (`anchorReference`),
 * e a que não resolve é simplesmente ignorada — a resposta segue sem o cartão,
 * como seguia antes. É a mesma régua de `verifySuggestion`: o modelo aponta, a
 * Bíblia em disco escreve.
 */
async function splicePassage(text: string, raw: string | null): Promise<string> {
  if (!raw) return text;

  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.some((paragraph) => asStandaloneScripture(paragraph))) return text;

  const anchored = await anchorReference(raw).catch(() => null);
  if (!anchored) return text;
  // Sem faixa de versículos não há cartão: "Lucas 19" desenharia a pastilha de
  // sempre, agora ocupando uma linha inteira para dizer o que o link da prosa
  // já dizia. Ver `BibloPassage`.
  if (!parseVerseReference(anchored.reference)?.startVerse) return text;

  const head = paragraphs.slice(0, 1);
  const tail = paragraphs.slice(1);
  return [...head, anchored.reference, ...tail].join("\n\n");
}

/**
 * A oferta virada para a VOZ DE QUEM PERGUNTA, e descartada quando não vira.
 *
 * O chip da oferta não é uma fala do Biblo: tocá-lo ENVIA aquele texto como se
 * a pessoa o tivesse digitado. Quando o modelo escreve "Quer que eu escreva um
 * trecho sobre a diferença entre as duas parábolas?" — e ele escreve, apesar de
 * o prompt pedir o contrário com dois exemplos —, o que chega à conversa é a
 * PESSOA perguntando ao Biblo se ELE quer escrever. A frase deixa de fazer
 * sentido no instante exato em que é usada, e a resposta seguinte sai torta.
 *
 * Duas passadas, e as duas são costura de texto, não adivinhação:
 *
 *  1. **Tira o pedido de licença.** "Quer que eu ", "Posso ", "Gostaria que eu "
 *     e os irmãos deles são exatamente o que sobra quando a oferta é escrita na
 *     voz errada. O que vem depois já é o pedido.
 *  2. **Põe o verbo no imperativo.** O que resta da passada 1 vem no infinitivo
 *     ("escrever") ou no subjuntivo ("escrevesse"), e a tabela abaixo cobre os
 *     verbos que o próprio prompt enumera. Um verbo fora dela passa como está —
 *     desajeitado é melhor que ausente.
 *
 * **Sobrou pergunta, não há botão.** Um chip que ainda termina em "?" depois
 * das duas passadas é uma frase que a pessoa não diria; melhor a fileira com
 * quatro perguntas do que com uma quinta que confunde.
 */
const OFFER_PREFIX_RE =
  /^(?:e\s+)?(?:voc[êe]\s+)?(?:quer(?:es)?|gostaria|deseja|posso|devo)\s+(?:que\s+eu\s+)?/i;

const IMPERATIVE: Record<string, string> = {
  escrever: "escreva",
  escrevesse: "escreva",
  reescrever: "reescreva",
  reescrevesse: "reescreva",
  transformar: "transforme",
  transformasse: "transforme",
  resumir: "resuma",
  resumisse: "resuma",
  montar: "monte",
  montasse: "monte",
  fazer: "faça",
  fizesse: "faça",
  colocar: "coloque",
  colocasse: "coloque",
  adicionar: "adicione",
  adicionasse: "adicione",
  trazer: "traga",
  trouxesse: "traga",
  explicar: "explique",
  explicasse: "explique",
  criar: "crie",
  criasse: "crie",
  fechar: "feche",
  fechasse: "feche",
};

/**
 * Tira o pedido de licença do FIM da resposta.
 *
 * "Quer que eu escreva um trecho explicando essa parábola?" como último
 * parágrafo é a mesma oferta que já está virando botão dois centímetros abaixo,
 * dita duas vezes — e a versão em prosa é a pior das duas, porque não faz nada
 * quando lida. O prompt pede que ela fique só no campo `offer`; isto é a rede,
 * e usa o mesmo reconhecimento de `asUserVoice`.
 *
 * Só o ÚLTIMO parágrafo, e só se ele for curto e terminar em "?": uma pergunta
 * de verdade no fecho ("E você, o que acha que o servo temia?") não começa com
 * "quer que eu" e continua onde está — ela é parte do que o Biblo faz.
 */
function dropTrailingOffer(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length < 2) return text;

  const last = paragraphs[paragraphs.length - 1].trim();
  if (!last.endsWith("?")) return text;
  if (last.length > 160) return text;
  if (!OFFER_PREFIX_RE.test(last)) return text;

  return paragraphs.slice(0, -1).join("\n\n");
}

function asUserVoice(offer: string | null): string | null {
  if (!offer) return null;

  const original = offer.trim();
  let text = original.replace(OFFER_PREFIX_RE, "");
  if (text !== original) {
    text = text.replace(/\?+\s*$/, "").trim();
    const [first, ...rest] = text.split(" ");
    const imperative = IMPERATIVE[first?.toLowerCase() ?? ""];
    if (imperative) text = [imperative, ...rest].join(" ");
  }

  if (!text || text.endsWith("?")) return null;
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * O parágrafo que já é uma PAREDE, e o tamanho para o qual ele é quebrado.
 *
 * O prompt pede parágrafo de até três frases e diz quando um parágrafo acaba.
 * Isto é a rede embaixo: medido, o modelo devolve vinte linhas num bloco só
 * quando o assunto rende — e o que a pessoa vê então é uma tela inteira de
 * cinza sem um ponto de apoio, que é olhada, não lida.
 *
 * O limiar é ALTO de propósito. Quebrar prosa numa fronteira de frase que o
 * autor não escolheu é sempre um pouco errado, então só vale a pena quando o
 * certo já está perdido: até 600 caracteres o parágrafo passa intocado, e o que
 * passa disso é dividido em pedaços de ~380, que é a ordem de grandeza de três
 * frases em português.
 */
const PARAGRAPH_WALL_CHARS = 600;
const PARAGRAPH_TARGET_CHARS = 380;

/** Uma frase: tudo até o ponto final (ou `?`/`!`) e o espaço que o segue. */
const SENTENCE_RE = /[^.!?]+(?:[.!?]+|$)\s*/g;

function splitWall(paragraph: string): string[] {
  if (paragraph.length <= PARAGRAPH_WALL_CHARS) return [paragraph];

  const sentences = paragraph.match(SENTENCE_RE);
  // Parede sem ponto final nenhum: não há onde cortar sem cortar uma frase ao
  // meio, e um corte assim é pior que a parede.
  if (!sentences || sentences.length < 2) return [paragraph];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence;
    if (current.length >= PARAGRAPH_TARGET_CHARS) {
      chunks.push(current.trim());
      current = "";
    }
  }
  // O resto vai junto com o último pedaço quando é curto demais para ser um
  // parágrafo por si: uma linha de seis palavras sozinha no fim lê como erro.
  if (current.trim()) {
    if (current.trim().length < 120 && chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${current.trim()}`;
    } else {
      chunks.push(current.trim());
    }
  }
  return chunks;
}

/** A resposta com respiro: toda parede vira parágrafos. */
function breathe(text: string): string {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitWall)
    .join("\n\n");
}

/**
 * A prosa resgatada de um JSON que o modelo não terminou de escrever.
 *
 * `BIBLO_ANSWER_MAX_TOKENS` subiu para 700 justamente para este caso ficar
 * raro, e isto é a rede embaixo dele: o teto é um número fixo e a prolixidade
 * não é, então um dia ele será alcançado de novo. Quando for, o que está em
 * jogo já não é uma resposta a gerar — é uma resposta JÁ GERADA e JÁ PAGA,
 * inteira no buffer, perdida por causa de uma chave que faltou fechar.
 *
 * **O resgate é possível porque `answer` é o primeiro campo longo do objeto.**
 * O prompt pede a ordem `offtopic, answer, chips, suggestion, offer, passage,
 * thread`, e o modelo a respeita: nas quatro truncagens medidas em produção, a
 * prosa estava completa e o corte caiu dentro de `suggestion` ou depois dela.
 * O que se perde são os chips e o botão, que são decoração; o que se salva é o
 * produto.
 *
 * A varredura é manual, e não um `JSON.parse` de um pedaço: o conteúdo não é
 * JSON válido, é justamente esse o problema. Ela anda caractere a caractere
 * respeitando as escapadas, e para na primeira aspa que não esteja escapada —
 * ou no fim do buffer, quando nem a aspa de fechamento chegou.
 */
function salvageAnswer(content: string): string | null {
  const head = /"answer"\s*:\s*"/.exec(content);
  if (!head) return null;

  let index = head.index + head[0].length;
  let text = "";
  while (index < content.length) {
    const char = content[index];
    if (char === '"') break;
    if (char === "\\") {
      // `\uXXXX` tem seis caracteres; as demais escapadas, dois. Uma escapada
      // cortada ao meio pelo teto não é decodificável, e ali o resgate para.
      const sequence = content.slice(index, index + (content[index + 1] === "u" ? 6 : 2));
      try {
        text += JSON.parse(`"${sequence}"`) as string;
      } catch {
        break;
      }
      index += sequence.length;
      continue;
    }
    text += char;
    index++;
  }

  return text.trim() || null;
}

/**
 * Os tipos de prosa cujo `text` o servidor sabe preencher a partir da resposta.
 *
 * `h2` e `quote` ficam de fora: um subtítulo não é a resposta inteira, e uma
 * citação sem autor não é uma citação.
 */
const FILLABLE_FROM_ANSWER = new Set(["paragraph", "highlight", "conclusion", "example"]);

/**
 * O texto que a sugestão carrega, quando ela carrega algum.
 *
 * Existe para o caminho INVERSO do preenchimento abaixo: o modelo às vezes
 * escreve o trecho pedido dentro do bloco e deixa a conversa vazia. Os dois
 * campos são o mesmo parágrafo — um para ler, outro para inserir —, então
 * quando só um deles tem texto, ele serve aos dois.
 */
function suggestionText(suggestion: BibloSuggestion | null): string {
  if (!suggestion || suggestion.block.type === "bibleQuote") return "";
  return suggestion.block.text.trim();
}

/**
 * A sugestão, conferida — e, quando é o caso, PREENCHIDA.
 *
 * ## O modelo escolhe o bloco; o servidor escreve o texto
 *
 * Era assim só para `bibleQuote` (o texto vem da NVI, e a sugestão inteira cai
 * se a referência não resolver — o modelo nunca teve a caneta do texto
 * bíblico). Agora vale também para a prosa, e por um motivo medido:
 *
 * **quando a pessoa pedia "escreve um parágrafo sobre isso", o modelo escrevia
 * o parágrafo em `answer` e deixava `suggestion` nula.** Seis formulações de
 * prompt não mudaram isso, e a razão é boa: do ponto de vista dele o trabalho
 * estava feito, e repetir cento e tantos tokens que já estão na resposta é
 * exatamente o que o resto do prompt manda não fazer. O sintoma era o pior
 * possível — quem PEDIU o botão ficava sem o botão, depois de pagar.
 *
 * Com o `text` vazio, o modelo só precisa dizer o TIPO e a POSIÇÃO, que é
 * barato e que ele faz de bom grado. O texto é a resposta que ele acabou de
 * escrever, que é o que a pessoa pediu e o que ela está lendo na tela.
 *
 * ## "Add isso ao resumo" preenche com a resposta ANTERIOR
 *
 * O "isso" quase nunca é esta resposta: é a que veio antes. Perguntado o
 * contexto histórico de Filipenses e mandado "Add isso ao resumo", o modelo
 * reescrevia os dois parágrafos INTEIROS para ter o que pôr no bloco — a pessoa
 * lia a mesma coisa duas vezes seguidas, num lugar onde ela só queria um botão,
 * e pagava a saída de modelo pela repetição. Medido, e foi o defeito mais
 * irritante que o Biblo já teve.
 *
 * Hoje o prompt manda responder em UMA linha ("Separei o parágrafo sobre o
 * contexto. É só tocar em Adicionar"), e o texto do bloco vem daqui: a última
 * coisa que ele disse, que é literalmente o "isso" da frase dela.
 *
 * **O gatilho é o TAMANHO da resposta, e não uma bandeira do modelo.** Uma
 * resposta curta demais para ser o trecho é, necessariamente, um ponteiro para
 * outro trecho — não há terceira leitura possível. Uma bandeira no JSON seria
 * mais um campo para ele errar, e este não erra: o número mede o que aconteceu,
 * não o que ele disse que ia acontecer.
 */

/**
 * Abaixo disto, a resposta é um PONTEIRO, não o trecho.
 *
 * "Separei o parágrafo sobre o contexto histórico. É só tocar em Adicionar"
 * tem 73 caracteres. O parágrafo mais curto que já se quis num resumo passa
 * folgado dos 200: os do próprio resumo gerado começam nos 120 e a média fica
 * acima de 300. A folga entre os dois é grande o bastante para o corte não ser
 * uma aposta.
 */
const ANSWER_IS_A_POINTER_BELOW = 200;

async function verifySuggestion(
  suggestion: BibloSuggestion | null,
  blockCount: number,
  answerText: string,
  previousAnswer: string
): Promise<BibloSuggestion | null> {
  if (!suggestion) return null;

  // A resposta desta vez é um PONTEIRO para o que já foi dito ("Separei o
  // parágrafo…"), e não o trecho. Ver `ANSWER_IS_A_POINTER_BELOW`.
  const pointing = answerText.trim().length < ANSWER_IS_A_POINTER_BELOW && !!previousAnswer.trim();

  let block = suggestion.block;
  if (block.type === "bibleQuote") {
    const anchored = await anchorReference(block.reference).catch(() => null);
    if (!anchored) return null;
    block = { type: "bibleQuote", reference: anchored.reference, text: anchored.text };
  } else if (pointing || !block.text.trim()) {
    // Bloco de prosa sem texto: ou é a resposta, ou não é sugestão nenhuma.
    if (!FILLABLE_FROM_ANSWER.has(block.type)) return null;
    // `pointing` VENCE o texto que o modelo escreveu no bloco, e isto é
    // deliberado: apontando para o que já foi dito, o que ele põe ali é uma
    // REESCRITA do parágrafo anterior — a mesma repetição que estamos tirando,
    // só que escondida dentro do JSON em vez de visível na conversa. O que a
    // pessoa leu e mandou adicionar é o texto anterior, palavra por palavra.
    const text = pointing ? previousAnswer.trim() : answerText.trim();
    if (!text) return null;
    block = { ...block, text };
  }

  // O modelo chuta índices fora da lista de vez em quando; um `afterIndex` de
  // 12 num resumo de 5 blocos inseriria no fim sem ninguém pedir. Clampear é a
  // leitura mais próxima da intenção.
  const afterIndex = Math.min(Math.max(suggestion.afterIndex, -1), blockCount - 1);
  return { label: suggestion.label, block, afterIndex };
}

/**
 * Quantos cartões do léxico entram no prompt, e quanto de cada um.
 *
 * São AMARRAS DE MARGEM, como as duas do topo deste arquivo. O bloco cresce com
 * o que a pessoa escreveu na pergunta, e sem teto uma pergunta que cite seis
 * nomes empurraria seis descrições de 2 mil caracteres para dentro da chamada.
 * Três cobre a pergunta real ("quem era Habacuque, e por que ele reclama como
 * Jó?"); 600 caracteres é a ordem de grandeza de um cartão inteiro bem escrito,
 * e o que passa disso entra cortado em vez de ficar de fora.
 *
 * O custo é de ENTRADA, o lado barato da conta, e nem sempre existe: uma
 * conversa que não toca nome nenhum do léxico não paga nada por isto.
 */
const BIBLO_LEXICON_MAX_CARDS = 3;
const BIBLO_LEXICON_CHAR_BUDGET = 600;

/**
 * Os slugs do léxico citados num texto, na ordem em que aparecem.
 *
 * É o MESMO `annotateText` que o `RichText` usa para marcar nome próprio na
 * tela, e essa igualdade é o ponto: o Biblo recebe como fonte exatamente as
 * entradas que a pessoa VÊ marcadas, nem mais nem menos. Uma segunda forma de
 * reconhecer nome aqui faria a conversa e a tela discordarem sobre quem é quem.
 */
function lexiconSlugsIn(text: string, index: LexiconIndexEntry[]): string[] {
  if (!text || index.length === 0) return [];
  const slugs: string[] = [];
  for (const segment of annotateText(text, index)) {
    if (segment.kind === "name" && !slugs.includes(segment.slug)) slugs.push(segment.slug);
  }
  return slugs;
}

/**
 * A entrada cuja IMAGEM acompanha esta resposta, ou `null`.
 *
 * Decidida pelo servidor, e não pelo modelo: as menções da pergunta já foram
 * achadas por regex acima, de graça e sem chance de invenção. O cabeçalho da
 * migração 0065 tem o argumento inteiro.
 *
 * Duas condições, e as duas são conservadoras:
 *
 * - **Exatamente UMA entrada na pergunta.** Com dois nomes não há resposta certa
 *   sobre qual ilustrar, e escolher a primeira é acertar metade das vezes num
 *   lugar onde não desenhar nada não custa nada.
 * - **Ela tem imagem.** O texto do cartão já está na resposta, em prosa; o que
 *   o retrato acrescenta é a única coisa que a prosa não carrega.
 */
function entityForAnswer(slugs: string[], cards: LexiconCard[]): string | null {
  if (slugs.length !== 1) return null;
  const card = cards.find((c) => c.slug === slugs[0]);
  return card?.imageUrl ? card.slug : null;
}

export async function generateBibloAnswer(input: BibloAnswerInput): Promise<BibloAnswerResult> {
  const summary = input.summary;
  const blocks = summary?.blocks ?? [];

  const context = bibloContextBlock({
    title: summary?.title ?? "",
    shortSummary: summary?.shortSummary ?? "",
    speakerName: input.speakerName,
    blocks: renderBlocks(blocks),
    thread: latestThread(input.history),
  });

  // Os nomes do léxico que a PERGUNTA tocou, achados pelo mesmo anotador que
  // marca nome próprio na tela. Duas idas ao banco no pior caso, as duas
  // baratas: o índice é cacheado em memória por um minuto, e os cartões saem
  // numa consulta só.
  //
  // Falha aqui NÃO derruba a resposta: sem o bloco, o Biblo responde do que ele
  // sabe, que é como ele respondia antes desta feature existir. Uma leitura de
  // catálogo não pode custar uma moeda já debitada.
  const index = await getLexiconIndex().catch((): LexiconIndexEntry[] => []);
  const slugs = lexiconSlugsIn(input.question, index).slice(0, BIBLO_LEXICON_MAX_CARDS);
  const cards = slugs.length > 0 ? await getLexiconCards(slugs).catch(() => []) : [];

  // A ordem é deliberada: instruções e contexto PRIMEIRO, e os dois estáveis
  // durante a conversa inteira. É esse prefixo que o cache automático da OpenAI
  // pega (25% do preço na família 4.1), e é a diferença entre 74% e 61% de
  // margem em `features/coins/pricing.ts`. Qualquer coisa variável antes deles
  // invalida o cache a cada mensagem, sem erro nenhum na tela.
  //
  // **O bloco do léxico vem DEPOIS da janela**, pela mesma razão pelo avesso:
  // ele muda a cada pergunta, porque depende dos nomes dela. Entre as duas
  // primeiras mensagens, invalidaria o prefixo cacheado toda vez. Ver
  // `bibloLexiconBlock`.
  const messages: ChatMessage[] = [
    { role: "system", content: BIBLO_SYSTEM_PROMPT },
    { role: "system", content: context },
    ...windowMessages(input.history),
    ...(cards.length > 0
      ? [
          {
            role: "system" as const,
            content: bibloLexiconBlock(
              cards.map((card) => ({
                term: card.term,
                title: card.title,
                description: card.description.slice(0, BIBLO_LEXICON_CHAR_BUDGET),
              }))
            ),
          },
        ]
      : []),
    { role: "user", content: input.question },
  ];

  const model = serverEnv.OPENAI_BIBLO_MODEL;
  const result: Result<ChatResult> = await callChat({
    model,
    messages,
    temperature: 0.7,
    maxTokens: BIBLO_ANSWER_MAX_TOKENS,
    responseFormat: { type: "json_object" },
    store: true,
    metadata: buildLlmMetadata({
      route: "biblo",
      userId: input.userId,
      sessionId: input.sessionId,
    }),
  });

  if (!result.ok) {
    const message =
      result.error.kind === "http"
        ? `${result.error.status}: ${result.error.snippet}`
        : result.error.message;
    return { ok: false, kind: "upstream", message };
  }

  // `finishReason` vai em TODO log de falha daqui para baixo, e é a única coisa
  // que separa "o modelo escreveu bobagem" de "o modelo foi interrompido no
  // meio". Sem ele, as duas causas chegam ao Vercel como a mesma linha, e
  // descobrir qual era custou uma consulta aos logs da OpenAI.
  const { finishReason } = result.data;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.content);
  } catch {
    // Cortado pelo teto: a prosa continua inteira no buffer. Ver `salvageAnswer`.
    const salvaged = salvageAnswer(result.data.content);
    if (!salvaged) {
      log.error("json inválido", { finishReason, chars: result.data.content.length });
      return { ok: false, kind: "unparseable", message: "resposta não é JSON" };
    }
    log.warn("resposta resgatada de um JSON truncado", {
      finishReason,
      completionTokens: result.data.usage.completionTokens,
      chars: salvaged.length,
    });
    parsed = { answer: salvaged };
  }

  const reply = BibloReplySchema.safeParse(parsed);
  if (!reply.success) {
    // Os CAMINHOS, não a contagem: "issues: 1" não diz qual campo caiu, e
    // descobrir isso era refazer a chamada com um log temporário no meio.
    //
    // **Chegar aqui é, hoje, um DEFEITO DE CONTRATO e não um deslize do
    // modelo**: todo campo tem rede, e o único erro fatal é a resposta vazia
    // dos dois lados (ver o cabeçalho de `BibloReplySchema`). Uma linha destas
    // no log significa que um campo novo nasceu sem `.catch()`.
    log.error("schema-drop", {
      finishReason,
      issues: reply.error.issues.map(
        (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.code}`
      ),
    });
    return { ok: false, kind: "unparseable", message: "resposta fora do contrato" };
  }

  // A ordem importa: a sugestão pode ser preenchida com o texto da resposta, e
  // o que vai para o documento tem de ser a resposta JÁ com os marcadores
  // resolvidos — nunca um `[[Jonas 1:3]]` cru entrando no resumo de alguém.
  // A resposta pode vir vazia quando o modelo escreveu o trecho pedido dentro
  // da sugestão (ver o cabeçalho de `answer` em `domain/biblo.ts`). Vazia dos
  // DOIS lados não há o que mostrar, e aí sim é erro — mas é o único caso.
  const written = reply.data.answer.trim() || suggestionText(reply.data.suggestion);
  if (!written) {
    log.error("resposta vazia dos dois lados", { finishReason });
    return { ok: false, kind: "unparseable", message: "resposta vazia" };
  }

  // Fora do território (ver `O TERRITÓRIO` em `prompts/biblo.ts`): a recusa é a
  // resposta inteira, e não há nada nela para pôr no documento de ninguém.
  //
  // O prompt já manda `suggestion` e `offer` nulas aqui, e não é nele que se
  // pode confiar para isto: duas instruções empurram para o lado contrário — o
  // "NA DÚVIDA, PREENCHA" da oferta e o bloco de prosa vazio que o SERVIDOR
  // preenche com a resposta (`verifySuggestion`). As duas somadas desenham
  // "Adicionar este parágrafo" embaixo de "aqui eu só falo de Bíblia", e o
  // estrago de um toque distraído é a recusa dentro do resumo de alguém.
  //
  // A passagem cai pelo mesmo motivo: o cartão da NVI embaixo de uma recusa de
  // receita de miojo não explica nada, só ocupa a tela.
  const offtopic = reply.data.offtopic;
  if (offtopic) log.info("fora do território", { model });

  const answer = await resolveMarkers(written);
  const text = await splicePassage(
    dropTrailingOffer(breathe(answer.text)),
    offtopic ? null : reply.data.passage
  );
  // O bloco preenchido pelo servidor leva a PROSA, sem a linha da passagem: ela
  // é um cartão dentro da conversa, e dentro de um `paragraph` do resumo viraria
  // uma referência solta no meio do texto de alguém. Quem quiser a passagem no
  // documento tem o "+" do próprio cartão.
  const prose = withoutPassageLines(text);
  const suggestion = offtopic
    ? null
    : await verifySuggestion(
        reply.data.suggestion,
        blocks.length,
        prose,
        // A última coisa que ELE disse, já sem a linha da passagem: é o "isso"
        // de "add isso ao resumo". Ver `ANSWER_IS_A_POINTER_BELOW`.
        withoutPassageLines(latestAnswer(input.history))
      );

  if (answer.dropped > 0) {
    // Não é erro de usuário nem motivo para 500: a resposta segue sem a
    // referência que não existe. Mas é sinal de prompt, e ele precisa aparecer.
    log.warn("referência inválida descartada", { dropped: answer.dropped, model });
  }

  // A oferta entra como a PRIMEIRA pastilha da fileira.
  //
  // Ela já foi a última, com o argumento de que as perguntas são o caminho
  // normal da conversa e a oferta é o desvio para dentro do texto. O argumento
  // morreu quando a fileira virou uma linha que ROLA DE LADO (ver `Chips` em
  // `BibloDrawer`): ali "último" quer dizer "fora da tela", e a oferta é o
  // único chip com um destino — é o que separa o Biblo de um chat numa aba.
  // Ela também é a única que não é pergunta, então abrir com ela não confunde
  // a leitura da fileira.
  //
  // Daqui para baixo é um chip como outro qualquer: o banco, a gaveta e o
  // `send` não precisam saber que ela nasceu num campo próprio. E é justamente
  // por isso que a voz dela é acertada ANTES daqui — ver `asUserVoice`.
  const offer = offtopic ? null : asUserVoice(reply.data.offer);
  const chips = offer ? [offer, ...reply.data.chips] : reply.data.chips;

  // O retrato só acompanha resposta DENTRO do território: embaixo de "aqui eu
  // só falo de Bíblia" ele seria um enfeite numa recusa, e a foto de um
  // personagem não tem nada a ver com a receita de miojo que foi pedida.
  const entitySlug = offtopic ? null : entityForAnswer(slugs, cards);

  return {
    ok: true,
    data: {
      reply: { ...reply.data, answer: text, suggestion, chips },
      entitySlug,
      model,
      usage: result.data.usage,
      latencyMs: result.data.latencyMs,
    },
  };
}
