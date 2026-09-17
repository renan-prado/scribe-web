import "server-only";
import { parseVerseReference } from "@/lib/domain/reference";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * O cumprimento e os primeiros chips. **Sem LLM, e essa é a decisão.**
 *
 * Abrir a gaveta não gasta presente, não gasta moeda, não gasta dólar e não
 * espera nada. Uma abertura gerada custaria uma chamada a cada gaveta aberta,
 * inclusive as que ninguém usa — e ela é a única parte da conversa cujo
 * material está INTEIRO na tela: o título, a ideia central e as passagens
 * citadas bastam para a primeira frase ser específica, que é o que o
 * `biblo.md` §4 pede.
 *
 * Chips com inteligência de verdade são os OUTROS: os que vêm depois de uma
 * resposta, puxados do que acabou de ser dito, e que saem de graça no mesmo
 * JSON que escreveu a resposta.
 */

export type BibloOpening = { greeting: string; chips: string[] };

/** Três a cinco por vez, nunca a lista inteira (`biblo.md` §4). */
const MAX_CHIPS = 5;

/**
 * Os dois que valem para qualquer texto, e que ficam por último de propósito:
 * os derivados do conteúdo são melhores, e estes existem para a fileira nunca
 * ficar curta.
 */
const GENERIC_CHIPS = ["Uma pergunta que incomode", "O que ler sobre isso"];

const EMPTY_CHIPS = [
  "Sobre qual passagem quero escrever?",
  "Me ajuda a achar um tema",
  "O que a Bíblia diz sobre perdão?",
];

/**
 * As referências citadas no texto, em ordem de aparição e sem repetir.
 *
 * Vem dos blocos `bibleQuote` E da prosa: uma passagem mencionada no meio de um
 * parágrafo é tão citada quanto a que virou bloco, e `parseVerseReference` é o
 * mesmo parser que a tela usa para transformá-la em link — um segundo parser
 * aqui faria a gaveta e o texto discordarem sobre o que "Romanos 8" significa.
 */
function citedReferences(summary: SummaryPayload): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const parsed = parseVerseReference(raw);
    if (!parsed) return;
    // O CAPÍTULO, não o versículo: "Contexto de Jonas 1" é a pergunta que a
    // pessoa faria; "Contexto de Jonas 1:1-3" é a mesma pergunta com uma
    // precisão que ninguém pediu — e faz dois chips iguais quando o texto cita
    // dois trechos do mesmo capítulo.
    const display = `${parsed.bookDisplay} ${parsed.chapter}`;
    const key = display.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(display);
  };

  for (const block of summary.blocks) {
    if (block.type === "bibleQuote") push(block.reference);
  }
  return found;
}

/**
 * O cumprimento.
 *
 * **Ele chama a pessoa pelo nome, e o verbo olha o modo da sessão.** Um resumo
 * que veio de gravação ou do YouTube é algo que ela está LENDO; o `/escrever`
 * é algo que ela está ESCREVENDO, e dizer "vi que você está lendo" para quem
 * está com a própria página aberta erra na primeira frase — que é a única que
 * todo mundo lê.
 *
 * `firstName` nulo tira só o nome: "Olá!" continua sendo um cumprimento, e
 * nenhum fallback genérico entra no lugar — ninguém se reconhece em "Olá,
 * usuário!".
 */
/**
 * A apresentação, dita nas primeiras conversas e só nelas.
 *
 * **Ela diz o que ele FAZ, não o que ele é.** "Sou um assistente de IA" não
 * responde a pergunta que a pessoa tem diante de uma gaveta que acabou de
 * abrir, que é "o que eu pergunto aqui?". Quatro capacidades concretas
 * respondem, e são as mesmas quatro do `biblo.md` §2 — as mesmas que os chips
 * oferecem logo abaixo, para a frase e as pastilhas dizerem a mesma coisa.
 *
 * **E ela não diz nada sobre a SITUAÇÃO**, de propósito: quem diz é a frase
 * seguinte, que sabe se a pessoa está lendo um sermão, escrevendo o próprio
 * texto ou diante de uma folha em branco. A primeira versão abria com "eu leio
 * junto com você", e no `/escrever` isso estava simplesmente errado.
 *
 * **A quarta capacidade é a mais larga de propósito.** As três primeiras são
 * sobre o texto que está na tela; "conversar sobre qualquer tema" abre a
 * porta para a pergunta que não nasceu do sermão — a dúvida que a pessoa tem há
 * meses e nunca perguntou a ninguém. É a que o `biblo.md` §2 chama de "a
 * pergunta básica que alguém teria vergonha de fazer em público", e ela precisa
 * estar na primeira frase para ser feita.
 *
 * Quem decide se ela aparece é o contador de `biblo/intro.ts`.
 */
const INTRODUCTION =
  "Meu nome é Biblo. Eu posso explicar uma passagem bíblica, trazer o contexto histórico, apresentar um personagem bíblico ou conversar sobre qualquer tema.";

function buildGreeting(input: {
  title: string;
  speakerName: string | null;
  firstName: string | null;
  authored: boolean;
  introduce: boolean;
}): string {
  const hello = input.firstName ? `Olá, ${input.firstName}!` : "Olá!";
  const intro = input.introduce ? ` ${INTRODUCTION}` : "";
  const question = "Tem algum trecho ou tema que você queira conversar a respeito?";
  if (!input.title) return `${hello}${intro} Li o que está na tela. ${question}`;

  const verb = input.authored ? "escrevendo" : "lendo";
  const author = input.speakerName ? `, de ${input.speakerName}` : "";
  return `${hello}${intro} Vi que você está ${verb} sobre "${input.title}"${author}. ${question}`;
}

export function buildBibloOpening(input: {
  summary: SummaryPayload | null;
  speakerName: string | null;
  firstName: string | null;
  /** `true` no `/escrever`: o texto na tela é dela, não de um pregador. */
  authored: boolean;
  /**
   * `true` nas primeiras conversas: ele diz quem é antes de falar do texto.
   * Quem conta é `biblo/intro.ts`.
   */
  introduce: boolean;
}): BibloOpening {
  const { summary, speakerName, firstName, authored, introduce } = input;
  const title = summary?.title?.trim() ?? "";
  const hasContent = !!summary && (summary.blocks.length > 0 || !!summary.shortSummary.trim());

  // A folha em branco: cumprimenta sem fingir que sabe de algo. É o caso de
  // quem acabou de abrir o `/escrever`, e um "vi que você está escrevendo
  // sobre" ali seria uma mentira na primeira frase.
  if (!hasContent) {
    const hello = firstName ? `Olá, ${firstName}!` : "Olá!";
    return {
      greeting: introduce
        ? `${hello} ${INTRODUCTION} Sobre o que você quer escrever?`
        : `${hello} Sobre o que você quer escrever?`,
      chips: EMPTY_CHIPS,
    };
  }

  const greeting = buildGreeting({ title, speakerName, firstName, authored, introduce });

  const chips: string[] = [];
  for (const reference of citedReferences(summary)) {
    if (chips.length >= MAX_CHIPS - GENERIC_CHIPS.length) break;
    chips.push(`Contexto de ${reference}`);
  }
  if (summary.shortSummary.trim()) chips.push("Outras passagens sobre isto");
  chips.push(...GENERIC_CHIPS);

  return { greeting, chips: chips.slice(0, MAX_CHIPS) };
}
