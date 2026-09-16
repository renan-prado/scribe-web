"use client";

import { Flag, Heading1, Heading2, Highlighter, Lightbulb, Pilcrow, Quote } from "lucide-react";
import type { ReactNode } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import type { WrittenBlock, WrittenBlockType } from "@/lib/domain/summary";

/**
 * O menu do `+`: o que a pessoa pode acrescentar, com o nome que ela usa.
 *
 * **Os rótulos são de leigo, não do schema.** No código o tipo é `h1`, na tela
 * é "Título"; `highlight` é "Frase de destaque"; `conclusion` é "Conclusão".
 * Quem escreve aqui é quem prega, não quem programa, e um menu com "H1 / H2 /
 * blockquote" pediria um vocabulário que a pessoa não tem motivo nenhum para
 * ter aprendido.
 *
 * A exceção é o `example`, cujo rótulo é o MESMO da leitura, "Exemplo do
 * pregador". Aqui o nome do schema não ajudaria em nada, e um segundo nome de
 * leigo ("Ilustração") faria a pessoa escolher uma coisa e ver outra aparecer
 * na tela.
 *
 * A ORDEM é a de uso, e não a do schema: parágrafo primeiro, porque é o que se
 * acrescenta nove vezes em cada dez, e os dois títulos logo atrás. A passagem
 * bíblica vem antes das citações porque este é um produto de sermão. A
 * conclusão é a última porque é a última.
 */
export type BlockOption = {
  type: WrittenBlockType;
  label: string;
  /** Uma linha explicando para que serve, no menu. */
  hint: string;
  icon: ReactNode;
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
    type: "bibleQuote",
    label: "Passagem bíblica",
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
    label: "Exemplo do pregador",
    hint: "A história ou comparação que ele usou para explicar.",
    icon: <Lightbulb className="size-4" />,
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
 * É a instrução ficando onde a dúvida aparece: no menu do `+` cabe uma linha
 * sobre para que serve o bloco, mas quem já escolheu está olhando para uma
 * caixa em branco, e o `hint` do menu já saiu da tela.
 */
export const BLOCK_PLACEHOLDERS: Record<WrittenBlockType, string> = {
  paragraph: "Escreva…",
  h1: "Título desta parte",
  h2: "Subtítulo",
  bibleQuote: "Escolha a passagem",
  highlight: "A frase que resume tudo",
  example: "A história que ele contou",
  quote: "A frase citada",
  conclusion: "O que fica da mensagem",
};
