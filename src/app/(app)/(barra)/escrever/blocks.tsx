"use client";

import {
  Flag,
  Heading1,
  Heading2,
  Highlighter,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
} from "lucide-react";
import type { ReactNode } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import {
  abbrevFor,
  BOOK_CANON,
  type CanonBook,
  chapterCountFor,
  chapterVerseCount,
  normalizeBookName,
} from "@/lib/bibles/books";
import { formatPassageRange } from "@/lib/domain/reference";
import type { WrittenBlock, WrittenBlockType } from "@/lib/domain/summary";
import { ScribaMark } from "@/shared/brand";

/**
 * O menu da barra `/`: o que a pessoa pode acrescentar, com o nome que ela
 * usa.
 *
 * **Os rótulos são de leigo, não do schema.** No código o tipo é `h1`, na tela
 * é "Título"; `highlight` é "Frase de destaque"; `conclusion` é "Conclusão".
 * Quem escreve aqui é quem prega, não quem programa, e um menu com "H1 / H2 /
 * blockquote" pediria um vocabulário que a pessoa não tem motivo nenhum para
 * ter aprendido.
 *
 * A exceção é o `example`, cujo rótulo é o MESMO da leitura, "Informação".
 * Aqui o nome do schema não ajudaria em nada, e um segundo nome de leigo
 * ("Ilustração") faria a pessoa escolher uma coisa e ver outra aparecer na
 * tela.
 *
 * A ORDEM é a de uso, e não a do schema: parágrafo primeiro, porque é o que se
 * acrescenta nove vezes em cada dez, e os dois títulos logo atrás. A passagem
 * bíblica vem antes das citações porque este é um produto de sermão. A
 * conclusão é a última porque é a última — e a ideia central (`LEAD_OPTION`,
 * que não mora nesta lista porque não é bloco) é a primeira pela mesma razão.
 *
 * **Essas duas são ÚNICAS, e o menu é quem diz isso**: postas uma vez, elas
 * somem da fileira, e o que sobra na tela é o cartão já criado. Ver
 * `menuOptions` no `Composer`.
 */
export type BlockOption = {
  type: WrittenBlockType;
  label: string;
  /** Uma linha explicando para que serve, no menu. */
  hint: string;
  icon: ReactNode;
};

/**
 * O que o menu pode acrescentar: um bloco, ou a IDEIA CENTRAL, que não é um
 * bloco.
 *
 * Ela é o `shortSummary` do payload — a frase que aparece no cartão da
 * Biblioteca e na busca —, e por isso não tem tipo no `SummaryBlockSchema`. Ela
 * entrou no menu mesmo assim porque, do lado de quem escreve, ela é mais uma
 * coisa que se ACRESCENTA ao texto, e ter uma pastilha própria no topo da folha
 * fazia a mesma pergunta ("o que mais cabe aqui?") ser respondida em dois
 * lugares diferentes. Quem trata a diferença é o `Composer`: a ideia central
 * abre o campo do cabeçalho em vez de virar um bloco na posição escolhida.
 *
 * `"quickBibleQuote"` é a terceira exceção: a citação rápida da barra
 * (`/atos 1:1`, ver `parseQuickBibleReference`). Não é bloco do schema nem
 * campo do payload — é uma ENTRADA A MAIS que a barra reconhece no meio do
 * que se digita, e por isso nunca entra em `BLOCK_OPTIONS`.
 */
export type BlockPick = WrittenBlockType | "leadIdea" | "quickBibleQuote";

export type MenuOption = {
  type: BlockPick;
  label: string;
  hint: string;
  icon: ReactNode;
};

/**
 * A ideia central no menu do `+`.
 *
 * **Ela é a PRIMEIRA da lista porque é o primeiro bloco do texto**, o espelho
 * da conclusão, que é a última porque é a última. É a única das opções que não
 * obedece à ordem de uso, e a razão é que ela e a conclusão são as duas únicas
 * com posição FIXA: o menu as põe nas pontas para que a lista de opções tenha a
 * forma do documento que ela monta.
 *
 * O glifo é a marca do Scriba, e não um ícone de lucide: é exatamente o que
 * está na pastilha do cartão que esta opção cria, na edição e na leitura. Um
 * segundo símbolo aqui faria a pessoa escolher uma coisa e ver outra aparecer.
 */
export const LEAD_OPTION: MenuOption = {
  type: "leadIdea",
  label: "Ideia central",
  hint: "Em uma frase, do que trata o texto. Abre a leitura.",
  icon: <ScribaMark className="size-3" />,
};

export const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: "paragraph",
    label: "Parágrafo",
    hint: "O texto corrido da mensagem.",
    icon: <Pilcrow className="size-4" />,
  },
  {
    type: "h1",
    label: "Título",
    hint: "Abre uma parte nova.",
    icon: <Heading1 className="size-4" />,
  },
  {
    type: "h2",
    label: "Subtítulo",
    hint: "Divide uma parte por dentro.",
    icon: <Heading2 className="size-4" />,
  },
  {
    type: "bulletList",
    label: "Tópicos",
    hint: "Uma lista de pontos. Um por linha.",
    icon: <List className="size-4" />,
  },
  {
    type: "orderedList",
    label: "Tópicos numerados",
    hint: "O mesmo, em ordem. Os números saem sozinhos.",
    icon: <ListOrdered className="size-4" />,
  },
  {
    type: "bibleQuote",
    // "Bíblia", e não "Passagem bíblica". O nome antigo descrevia o RECORTE
    // (uma passagem) num menu em que todas as outras opções são uma palavra;
    // numa fileira de pastilhas ele era o único com duas, e a segunda não
    // acrescentava nada que o glifo do livro já não dissesse. O que se escolhe
    // ali é a Bíblia, e o passo seguinte é que decide qual pedaço dela.
    //
    // **O TIPO continua `bibleQuote`**, e é isso que mantém de pé todo bloco já
    // salvo: mudou a palavra na tela, não a chave do jsonb.
    label: "Bíblia",
    hint: "Escolha o livro, o capítulo e os versículos.",
    // `size-3`, e não os `size-4` dos vizinhos: o `BookGlyph` é um retângulo
    // vazio (a lombada de um livro visto de cima), e à altura de um glifo de
    // lucide ele deixa de parecer um livro e passa a parecer uma caixa de
    // seleção desmarcada.
    icon: <BookGlyph className="size-3" />,
  },
  {
    type: "highlight",
    label: "Frase de destaque",
    hint: "A frase que resume tudo, em letra grande.",
    icon: <Highlighter className="size-4" />,
  },
  {
    type: "example",
    // "Informação", e não "Exemplo" — que por sua vez já tinha deixado de ser
    // "Exemplo do pregador". O bloco nasceu para UM uso (a ilustração de um
    // sermão) e o produto passou a usá-lo para qualquer nota à parte do texto
    // corrido; "Informação" é o nome que cabe nos dois, e o TÍTULO agora é
    // editável (`block.title`, ver `BlockRenderer` e o `BlockBody` do
    // `Composer`) para quem quiser dizer o que é, sem escolher entre dois
    // rótulos fixos.
    //
    // **O TIPO continua `example`**, e é isso que mantém de pé todo bloco já
    // salvo no banco: o que mudou é a palavra na tela, não a chave do jsonb.
    label: "Informação",
    hint: "Uma nota, exemplo ou comparação à parte do texto.",
    icon: <Info className="size-4" />,
  },
  {
    type: "quote",
    label: "Citação",
    hint: "Uma frase de outra pessoa, com o nome dela.",
    icon: <Quote className="size-4" />,
  },
  {
    type: "conclusion",
    label: "Conclusão",
    hint: "O fecho, no cartão do Scriba.",
    icon: <Flag className="size-4" />,
  },
];

export const BLOCK_LABELS: Record<WrittenBlockType, string> = BLOCK_OPTIONS.reduce(
  (acc, o) => {
    acc[o.type] = o.label;
    return acc;
  },
  {} as Record<WrittenBlockType, string>
);

/** O bloco recém-nascido, vazio, do tipo escolhido. */
export function emptyBlock(type: WrittenBlockType): WrittenBlock {
  if (type === "bibleQuote") return { type, reference: "", text: "" };
  if (type === "quote") return { type, text: "", author: "" };
  return { type, text: "" };
}

/**
 * O texto de rascunho de cada tipo, mostrado enquanto o bloco está vazio.
 *
 * É a instrução ficando onde a dúvida aparece: no menu da barra cabe uma
 * linha sobre para que serve o bloco, mas quem já escolheu está olhando para
 * uma caixa em branco, e o `hint` do menu já saiu da tela.
 */
export const BLOCK_PLACEHOLDERS: Record<WrittenBlockType, string> = {
  // "Escreva…" sozinho ensinava só metade do editor: sem o "+", que saiu
  // (ver `src/app/AGENTS.md`), a barra é o único jeito de pedir um título, uma
  // passagem ou qualquer outro bloco, e o placeholder é o único lugar onde
  // isso se aprende sem procurar.
  paragraph: "Escreva, ou digite / para ver as opções",
  h1: "Título desta parte",
  h2: "Subtítulo",
  bulletList: "Um tópico por linha",
  orderedList: "Um tópico por linha",
  bibleQuote: "Escolha a passagem",
  highlight: "A frase que resume tudo",
  example: "Uma nota, exemplo ou comparação à parte",
  quote: "A frase citada",
  conclusion: "O que fica da mensagem",
};

const QUICK_REFERENCE_RE = /^(.+?)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/;

/**
 * O livro por trás de "atos", "1 corintios" (nome escrito, `abbrevFor`) OU
 * "at", "rm", "1co" (a SIGLA, sem acento e em qualquer caixa — quem digita
 * rápido usa a abreviação do rótulo do lombo da Bíblia, não o nome por
 * extenso). `abbrevFor` só entende a primeira forma; a segunda casa contra o
 * `abbrev` de `BOOK_CANON` normalizado do mesmo jeito.
 */
function resolveQuickBook(bookRaw: string): CanonBook | undefined {
  const abbrev = abbrevFor(bookRaw);
  if (abbrev) return BOOK_CANON.find((b) => b.abbrev === abbrev);
  const normalized = normalizeBookName(bookRaw);
  return BOOK_CANON.find((b) => normalizeBookName(b.abbrev) === normalized);
}

/**
 * A citação rápida da barra: `/atos 1:1` ou `/at 1:1` já é a referência, sem
 * passar pelo `PassagePicker`.
 *
 * **É o mesmo vocabulário do resto do produto**, e não um parser novo: o
 * nome do livro passa por `resolveQuickBook` (nome escrito OU sigla — os
 * mesmos apelidos de `lib/bibles/books.ts`), e capítulo e versículo são
 * conferidos contra `CHAPTER_VERSE_COUNTS` antes de virar referência. Uma
 * referência que não existe (`Atos 99`) devolve `null`, e a barra
 * simplesmente não oferece a opção — ela não insere o que não pode ler
 * depois.
 *
 * A string devolvida é BYTE A BYTE a mesma que o `PassagePicker` produziria
 * escolhendo a mesma passagem nos três passos (`formatPassageRange`, sem
 * faixa quando só há capítulo), porque é essa string que vira a chave do
 * cache de `PassageVerses` (ver `lib/domain/reference.ts`).
 */
export function parseQuickBibleReference(query: string): string | null {
  const m = QUICK_REFERENCE_RE.exec(query.trim());
  if (!m) return null;
  const [, bookRaw, chapterStr, startStr, endStr] = m;
  const canon = resolveQuickBook(bookRaw);
  if (!canon) return null;
  const chapter = Number.parseInt(chapterStr, 10);
  if (chapter < 1 || chapter > chapterCountFor(canon.name)) return null;
  if (!startStr) return `${canon.name} ${chapter}`;
  const start = Number.parseInt(startStr, 10);
  const end = endStr ? Number.parseInt(endStr, 10) : start;
  const verses = chapterVerseCount(canon.name, chapter) ?? 0;
  if (start < 1 || end < start || end > verses) return null;
  return formatPassageRange(canon.name, chapter, start, end);
}

/**
 * O texto depois da barra PARECE uma referência em andamento — letras
 * seguidas, mais adiante, de um número —, mesmo quando `parseQuickBibleReference`
 * ainda devolve `null`: falta o versículo (`/rm 12`), o livro tem um erro de
 * digitação (`/romanaos 12:1`), ou o capítulo passou do que o livro tem.
 *
 * Sem isto, a barra só mostra alguma opção quando o texto já está CERTO, e
 * até lá ela responde "Nada com…" — que lê como "isto não existe", não como
 * "falta terminar de digitar". Quando isto é verdade e a citação rápida não
 * resolveu, a barra oferece "Bíblia" (o seletor completo) no lugar: sempre
 * um caminho para a frente, nunca um beco.
 */
export function looksLikeBibleQuery(query: string): boolean {
  return /\p{L}.*\d/u.test(query);
}
