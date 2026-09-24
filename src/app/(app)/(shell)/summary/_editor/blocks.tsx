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
 * O `BibleTarget` é a terceira exceção: a Bíblia reconhecida no meio do que se
 * digita (`/atos`, `/atos 1`, `/atos 1:1`, ver `matchBibleQuery`). Não é bloco
 * do schema nem campo do payload — é uma ENTRADA A MAIS que a barra monta a
 * partir do texto, e por isso nunca entra em `BLOCK_OPTIONS`. É também o único
 * `pick` que CARREGA dado (qual livro, qual capítulo): os outros são um nome
 * de tipo e nada mais, e por isso este é um objeto onde os outros são string
 * — `typeof pick === "string"` é o que separa os dois no `Composer`.
 */
export type BlockPick = WrittenBlockType | "leadIdea" | BibleTarget;

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
  paragraph: "Escreva, ou digite / para ver opções",
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

/**
 * O ALVO de uma opção de Bíblia da barra: o que escolhê-la FAZ.
 *
 * São três porque o que se digitou pode estar em três estágios, e cada um tem
 * uma continuação óbvia — nenhum deles é um beco:
 *
 * - `passage` — `/atos 1:1`, `/at 1:1-4`: a referência está pronta, e escolher
 *   insere o bloco direto, sem seletor.
 * - `chapter` — `/atos 1`: falta o versículo, e o `PassagePicker` abre no
 *   passo 3, com o livro e o capítulo já postos.
 * - `book` — `/atos`, `/at`: falta tudo depois do livro, e o seletor abre no
 *   passo 2, na grade de capítulos daquele livro.
 *
 * **Um pedaço que não existe REBAIXA o alvo, não o apaga.** `Atos 99` vira o
 * alvo `book` (o capítulo não existe, mas o livro existe e a grade mostra os
 * que há), e `Atos 1:999` vira `chapter`. O menu sempre oferece o passo mais
 * fundo que a digitação sustenta, e quem termina de escolher é o seletor.
 */
export type BibleTarget =
  | { kind: "passage"; reference: string }
  | { kind: "chapter"; book: string; chapter: number }
  | { kind: "book"; book: string };

/**
 * `exact` = o livro foi escrito INTEIRO (nome ou sigla), ou já há um número
 * depois dele. É o que decide se as opções de Bíblia entram ANTES ou DEPOIS
 * das opções de bloco no menu: `/tito` é o livro, mas `/ti` ainda é o começo
 * de "Título" tanto quanto de "Tiago". Ver `slashOptions` no `Composer`.
 */
export type BibleQueryResult = { exact: boolean; targets: BibleTarget[] };

/** Quantos livros o menu oferece quando o começo digitado serve a vários. */
const MAX_BOOK_MATCHES = 5;

const BIBLE_QUERY_RE = /^(.+?)(?:\s+(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?)?$/;

/**
 * Os livros por trás do que foi digitado, do mais certo ao menos certo.
 *
 * Três formas, nesta ordem, e a ordem é a resposta para o empate:
 *
 * 1. **A SIGLA exata** do lombo da Bíblia (`at`, `rm`, `1co`), em qualquer
 *    caixa, primeiro COM o acento e depois sem. Ela vem na frente porque é o
 *    que digita quem tem pressa, e porque é o acento dela que decide o caso
 *    `jo`: `Jo` é João e `Jó` é Jó, dois livros que a normalização empata. Quem
 *    escreve `/jo 3:16` quer João, quem escreve `/jó` quer Jó, e o outro fica
 *    logo abaixo na lista.
 * 2. **O nome escrito**, com todos os apelidos de `BOOK_ABBREVS` ("atos dos
 *    apostolos", "i corintios", "revelacao").
 * 3. **O COMEÇO** do nome ou da sigla, a partir de duas letras: `/gene` acha
 *    Gênesis, `/1co` acha 1 Coríntios, `/jo` acha também Joel, Jonas e Josué.
 *    É o que faz o menu responder enquanto se digita, em vez de só no instante
 *    em que a palavra fecha.
 */
function resolveBooks(raw: string): { exact: boolean; books: CanonBook[] } {
  const norm = normalizeBookName(raw);
  if (!norm) return { exact: false, books: [] };
  const books: CanonBook[] = [];
  const push = (book: CanonBook | undefined) => {
    if (book && !books.includes(book)) books.push(book);
  };

  // A sigla COM o acento primeiro, e é ela que resolve `jo`: "Jó" e "Jo" são
  // siglas de livros diferentes, e a normalização — que come os acentos —
  // empata as duas. Quem digita "jó" quer Jó; quem digita "jo" quer João.
  const lower = raw.trim().toLowerCase();
  push(BOOK_CANON.find((b) => b.abbrev.toLowerCase() === lower));
  push(BOOK_CANON.find((b) => normalizeBookName(b.abbrev) === norm));
  const abbrev = abbrevFor(raw);
  if (abbrev) push(BOOK_CANON.find((b) => b.abbrev === abbrev));
  const exact = books.length > 0;

  // O COMEÇO, com os espaços fora dos dois lados: quem digita rápido escreve
  // "1cor", e "1 coríntios" tem um espaço ali que a pressa não tem.
  if (norm.length >= 2) {
    const squashed = norm.replace(/\s+/g, "");
    for (const b of BOOK_CANON) {
      const name = normalizeBookName(b.name).replace(/\s+/g, "");
      const abbr = normalizeBookName(b.abbrev).replace(/\s+/g, "");
      if (name.startsWith(squashed) || abbr.startsWith(squashed)) push(b);
    }
  }
  return { exact, books: books.slice(0, MAX_BOOK_MATCHES) };
}

/** O alvo mais fundo que este livro sustenta com o número (ou a falta dele). */
function targetFor(
  canon: CanonBook,
  chapterStr: string | undefined,
  startStr: string | undefined,
  endStr: string | undefined
): BibleTarget {
  const book = canon.name;
  if (!chapterStr) return { kind: "book", book };
  const chapter = Number.parseInt(chapterStr, 10);
  if (chapter < 1 || chapter > chapterCountFor(book)) return { kind: "book", book };
  if (!startStr) return { kind: "chapter", book, chapter };
  const start = Number.parseInt(startStr, 10);
  const end = endStr ? Number.parseInt(endStr, 10) : start;
  const verses = chapterVerseCount(book, chapter) ?? 0;
  if (start < 1 || end < start || end > verses) return { kind: "chapter", book, chapter };
  // BYTE A BYTE a string que o `PassagePicker` produziria escolhendo a mesma
  // passagem nos três passos, porque é ela que vira a chave do cache de
  // `PassageVerses` (ver `lib/domain/reference.ts`).
  return { kind: "passage", reference: formatPassageRange(book, chapter, start, end) };
}

/**
 * O que a barra oferece quando o que se digitou depois dela parece Bíblia.
 *
 * **Digitar o livro SEMPRE encontra o livro.** A versão anterior só oferecia
 * alguma coisa quando a referência inteira já estava certa (`/atos 1:1`), e
 * até lá a barra respondia "Nada com 'atos'" — que lê como "este produto não
 * cita a Bíblia", e não como "falta terminar de digitar". Agora cada estágio
 * da digitação tem a sua opção, e escolher qualquer uma leva ao passo
 * seguinte em vez de pedir que se comece de novo. Ver `BibleTarget`.
 *
 * O vocabulário é o mesmo do resto do produto (`lib/bibles/books.ts`), e
 * capítulo e versículo são conferidos contra `CHAPTER_VERSE_COUNTS` antes de
 * virarem referência: o atalho não insere o que a leitura não vai conseguir
 * mostrar depois.
 */
export function matchBibleQuery(query: string): BibleQueryResult {
  const m = BIBLE_QUERY_RE.exec(query.trim());
  if (!m) return { exact: false, targets: [] };
  const [, bookRaw, chapterStr, startStr, endStr] = m;
  const { exact, books } = resolveBooks(bookRaw);
  if (books.length === 0) return { exact: false, targets: [] };
  return {
    exact: exact || chapterStr !== undefined,
    targets: books.map((b) => targetFor(b, chapterStr, startStr, endStr)),
  };
}

/**
 * O nome do alvo na tela: "Atos", "Atos 1", "Atos 1:1-4".
 *
 * É a mesma string nos dois usos, e de propósito: ela é o RÓTULO da opção no
 * menu e, quando ainda falta escolher, a referência PARCIAL entregue ao
 * `PassagePicker` (`initialReference`), que a lê de volta para saber em que
 * passo abrir. Um segundo formato entre os dois lados faria a opção dizer uma
 * coisa e o seletor abrir noutra.
 */
export function bibleTargetLabel(target: BibleTarget): string {
  if (target.kind === "passage") return target.reference;
  if (target.kind === "chapter") return `${target.book} ${target.chapter}`;
  return target.book;
}

/**
 * O texto depois da barra PARECE uma referência em andamento — letras
 * seguidas, mais adiante, de um número —, mesmo quando `matchBibleQuery` não
 * achou livro nenhum: o nome tem um erro de digitação (`/romanaos 12:1`), ou
 * é um apelido que o vocabulário não conhece.
 *
 * Quando isto é verdade e nenhuma outra opção sobrou, a barra oferece
 * "Bíblia" (o seletor completo) no lugar: sempre um caminho para a frente,
 * nunca um beco.
 */
export function looksLikeBibleQuery(query: string): boolean {
  return /\p{L}.*\d/u.test(query);
}
