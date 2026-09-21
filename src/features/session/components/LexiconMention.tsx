"use client";

import dynamic from "next/dynamic";
import { useMentionDialog } from "@/features/session/components/ChapterMention";
import { useLexiconNav } from "@/features/session/components/LexiconProvider";
import { LEXICON_CATEGORY_LABEL, type LexiconCategory } from "@/lib/domain/lexicon";

/**
 * O nome próprio marcado no meio da prosa: "Habacuque", "Mar Vermelho",
 * "Bonhoeffer". Toca e abre o cartão.
 *
 * ## A marcação é um PONTILHADO, e essa é a terceira e última forma dela
 *
 * Ela foi três tintas (azul personagem, verde lugar, cinza figura citada),
 * depois uma faixa de lavado branco sob as palavras. As duas saíram pelo mesmo
 * motivo, e o motivo é a DENSIDADE: um cartão do léxico cita meia dúzia de
 * nomes num parágrafo, e ali qualquer tratamento com ÁREA — cor de fundo,
 * faixa, realce — deixa de marcar palavras e passa a manchar o bloco. A escala
 * da faixa desceu de 70% para 22% em três passadas tentando resolver isso, e
 * cada degrau comprou menos ruído ao preço de uma marcação que ninguém
 * enxergava. Uma faixa fraca continua sendo uma faixa.
 *
 * O pontilhado não tem área: ele é uma linha de um pixel embaixo da palavra, no
 * mesmo lugar em que um leitor já espera encontrá-la. O parágrafo volta a ler
 * como parágrafo, e o nome continua dizendo "aqui abre algo".
 *
 * **É o MESMO vocabulário da referência bíblica** (`InlineScripture`), e isso
 * deixou de ser um problema para virar a resposta. O argumento de antes era que
 * dois links idênticos com destinos diferentes seriam uma promessa só para duas
 * coisas; o que ele não pesava é que a promessa é a MESMA nos dois casos — "toca
 * e abre" —, e o destino se descobre no toque, como em qualquer link. O que os
 * separa é a FORÇA: a referência leva a tinta clara na letra e o pontilhado a
 * 50%, porque ela é um endereço; o nome fica na tinta do parágrafo, com o
 * pontilhado a 30%, porque ele é uma palavra do texto que por acaso tem ficha.
 *
 * Nada de fundo, nada de recuo, nada de peso: o glifo é exatamente o que era
 * antes de ser marcado. No `hover` só a linha escurece, e no celular, onde não
 * existe hover, nada se perde.
 *
 * O `data-mention` CONTINUA sendo escrito, e continua fora da tinta: ele é o
 * dado da categoria, lido por quem depurar e disponível se um dia ela voltar a
 * significar algo na tela. Quem diz que o nome abre um cartão é ele estar
 * marcado, e essa promessa é uma só.
 *
 * **A área de toque não mudou**: ela é a do `<button>`, que é a palavra, e uma
 * decoração de texto não participa do teste de acerto de nada. O que some é o
 * fundo; o alvo é o mesmo.
 *
 * ## DENTRO de um cartão, ela navega em vez de abrir outro
 *
 * Um cartão pode citar outros nomes do léxico — o do Timóteo fala de Paulo, de
 * Listra e de Éfeso —, e abrir um segundo diálogo por cima do primeiro empilha
 * duas caixas sem caminho de volta. Com o `LexiconNav` preenchido, a menção
 * troca o CONTEÚDO do cartão que já está aberto, e ele ganha um voltar.
 *
 * **E o próprio nome não é marcado.** Num cartão do Timóteo, "Timóteo" é texto:
 * marcá-lo ofereceria à pessoa um caminho para onde ela já está.
 *
 * ## O diálogo entra por `dynamic`
 *
 * Mesma razão do `ChapterMention`, e o mesmo comentário vale inteiro: o
 * `BlockRenderer` é usado pela landing, e um import estático até aqui
 * arrastaria o Dialog do base-ui e o React Query para o bundle da primeira
 * página que um anônimo carrega. `ssr: false` porque não há nada a renderizar
 * no servidor antes de alguém clicar.
 */
const LexiconCardDialog = dynamic(
  () => import("@/features/session/components/LexiconCardDialog").then((m) => m.LexiconCardDialog),
  { ssr: false }
);

const MENTION_CLASSES = [
  // Sem `font-medium` e sem tinta própria: a palavra continua sendo a palavra
  // do parágrafo. Ver o cabeçalho.
  "cursor-pointer rounded-sm",
  // O pontilhado, na mesma mecânica da referência bíblica: mesma distância da
  // linha de base, mesmo estilo, 30% contra os 50% dela. `box-decoration-break`
  // saiu junto com a faixa — uma decoração de texto atravessa a quebra de linha
  // sozinha, que é justamente o que um fundo não faz.
  "underline decoration-dotted decoration-session-mention-ink/30 underline-offset-[3px]",
  "transition-[text-decoration-color] hover:decoration-session-mention-ink/60",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
].join(" ");

export function LexiconMention({
  slug,
  category,
  text,
}: {
  slug: string;
  category: LexiconCategory;
  /** O que o parágrafo escreveu, que pode ser um APELIDO ("Lutero"). */
  text: string;
}) {
  const dialog = useMentionDialog();
  const nav = useLexiconNav();

  // O próprio nome, dentro do próprio cartão: texto e nada mais.
  if (nav?.self === slug) return <>{text}</>;

  return (
    <>
      <button
        type="button"
        onClick={nav ? () => nav.go(slug) : dialog.show}
        data-mention={category}
        // O rótulo diz o que ACONTECE, não o que a palavra é: quem navega por
        // leitor de tela ouve uma lista de botões, e "Habacuque, personagem
        // bíblico" não distingue um botão de um trecho de texto em negrito.
        aria-label={`Sobre ${text}: ${LEXICON_CATEGORY_LABEL[category].toLowerCase()}`}
        className={MENTION_CLASSES}
      >
        {text}
      </button>
      {/* Sem `nav` a menção é dona do próprio diálogo; com ele, quem desenha é
          o cartão que já está aberto. */}
      {!nav && dialog.hasOpened ? (
        <LexiconCardDialog slug={slug} open={dialog.open} onOpenChange={dialog.setOpen} />
      ) : null}
    </>
  );
}
