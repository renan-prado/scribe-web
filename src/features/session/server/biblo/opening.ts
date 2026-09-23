import "server-only";
import { randomChapterReference } from "@/lib/bibles/books";
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
 * Quantos chips dependem do ASSUNTO e não das referências citadas. É o que
 * sobra para os "Contexto de X" no corte de `MAX_CHIPS`.
 */
const SUBJECT_CHIPS = 3;

/** Quantas referências citadas viram chip, no máximo. */
const REFERENCE_CHIPS = MAX_CHIPS - SUBJECT_CHIPS;

/**
 * O teto do assunto DENTRO de um chip.
 *
 * Um chip é uma pastilha numa fileira que rola de lado; um título de sermão de
 * oitenta caracteres dentro dela deixa de ser um botão e vira uma linha de
 * texto com fundo. Acima disto a fileira volta a dizer "o assunto", que é
 * genérico mas legível — e genérico e legível ganha de específico e ilegível.
 */
const SUBJECT_MAX_CHARS = 42;

/**
 * Do que esta conversa trata, em palavras que cabem num chip. `null` quando o
 * texto na tela não tem título, ou quando ele é comprido demais.
 */
function subjectOf(summary: SummaryPayload): string | null {
  const title = summary.title?.trim() ?? "";
  if (!title || title.length > SUBJECT_MAX_CHARS) return null;
  return title;
}

/**
 * Os chips que continuam a conversa, com o ASSUNTO no lugar do "isso".
 *
 * **"Falar mais sobre isso" é uma frase que não diz nada.** Ela é a legenda que
 * um robô põe embaixo de qualquer coisa: o "isso" não aponta para nada que a
 * pessoa possa conferir, e numa fileira de pastilhas ela lê como preenchimento.
 * O mesmo valia para "Outras passagens sobre isto" e "O que ler sobre isso" —
 * três chips apontando para um referente que só existe na cabeça de quem
 * escreveu o código.
 *
 * Com o título do texto na mão, o chip passa a NOMEAR o assunto: "Falar mais
 * sobre a suficiência da graça" é um convite; "Falar mais sobre isso" é um
 * rótulo. Sem título (ou com um comprido demais para caber numa pastilha) ele
 * cai em "o assunto", que ao menos é português.
 *
 * **`hasPassages` tira o chip que ficou redundante**, e essa é a segunda
 * lição, aprendida depois que o assunto entrou. Nomear o assunto consertou o
 * "isso" e criou um problema novo: "Outras passagens sobre X" e "Falar mais
 * sobre X" dizem a MESMA coisa (mais sobre X) e caíam lado a lado, enquanto "O
 * que ler sobre X", que é a única das três com um pedido diferente, era
 * cortada pelo teto de cinco. Com o "isso" genérico a repetição não aparecia;
 * com o assunto escrito por extenso, duas pastilhas terminam na mesma frase
 * longa e a fileira parece um robô procurando o que dizer. Fora o dos
 * versículos, "Falar mais" volta a ser a porta larga e aberta que ele sempre
 * foi.
 */
function subjectChips(subject: string | null, hasPassages: boolean): string[] {
  const about = subject ?? "o assunto";
  const chips = ["Uma pergunta que incomode", `O que ler sobre ${about}`];
  return hasPassages ? chips : [`Falar mais sobre ${about}`, ...chips];
}

/**
 * Os chips da folha em branco, com um capítulo SORTEADO no meio.
 *
 * Ele era uma string fixa ("Vamos falar sobre João 1?"), e sugestão fixa
 * envelhece na segunda vez que alguém a vê: deixa de ser convite e vira parte
 * da moldura, como um rótulo. Sorteado, a mesma pastilha propõe uma porta
 * diferente a cada conversa, e a Bíblia inteira cabe num botão só.
 *
 * É uma FUNÇÃO, e não um array no topo do módulo: uma constante seria sorteada
 * uma vez por processo, e todas as gavetas abertas naquele servidor até o
 * próximo deploy ofereceriam o mesmo capítulo.
 *
 * O sorteio corre sobre os capítulos, não sobre os livros — ver
 * `randomChapterReference`.
 */
function emptyChips(): string[] {
  return [
    "Me ajuda a achar um tema?",
    `Vamos falar sobre ${randomChapterReference()}?`,
    "O que a Bíblia diz sobre perdão?",
  ];
}

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
 * que veio de gravação ou do YouTube é algo que ela está LENDO; o `/summary/new`
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
 * junto com você", e no `/summary/new` isso estava simplesmente errado.
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
  /** `true` no `/summary/new`: o texto na tela é dela, não de um pregador. */
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
  // quem acabou de abrir o `/summary/new`, e um "vi que você está escrevendo
  // sobre" ali seria uma mentira na primeira frase.
  if (!hasContent) {
    const hello = firstName ? `Olá, ${firstName}!` : "Olá!";
    return {
      greeting: introduce
        ? `${hello} ${INTRODUCTION} Sobre qual assunto você gostaria de escrever?`
        : `${hello} Sobre qual assunto você gostaria de escrever?`,
      chips: emptyChips(),
    };
  }

  const greeting = buildGreeting({ title, speakerName, firstName, authored, introduce });

  const subject = subjectOf(summary);
  const chips: string[] = [];
  for (const reference of citedReferences(summary)) {
    if (chips.length >= REFERENCE_CHIPS) break;
    chips.push(`Contexto de ${reference}`);
  }
  const hasPassages = !!summary.shortSummary.trim();
  if (hasPassages) chips.push(`Outras passagens sobre ${subject ?? "o assunto"}`);
  chips.push(...subjectChips(subject, hasPassages));

  return { greeting, chips: chips.slice(0, MAX_CHIPS) };
}
