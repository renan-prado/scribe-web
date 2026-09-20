"use client";

import { Fragment } from "react";
import { InlineScripture } from "@/features/session/components/ChapterMention";
import { LexiconMention } from "@/features/session/components/LexiconMention";
import { useLexiconIndex } from "@/features/session/components/LexiconProvider";
import { type AnnotatedSegment, annotateText } from "@/lib/domain/annotate";
import { splitMarks } from "@/lib/domain/mark";

/**
 * O texto corrido do RESUMO e do ESTUDO, com as menções marcadas.
 *
 * Um parágrafo de sermão é uma parede: quinze linhas de prosa cinza em que
 * "Filipenses 4:6", "Habacuque" e "Bonhoeffer" pesam exatamente o mesmo que as
 * conjunções em volta. Este componente dá relevo a duas coisas que o olho
 * procura quando volta a um resumo dias depois, a passagem e o nome próprio, e
 * deixa o resto como está.
 *
 * ## As duas menções agora ABREM alguma coisa, e isso mudou a regra
 *
 * Este cabeçalho já disse que o nome próprio recebia "a faixa de marca-texto e
 * mais nada, porque não há para onde ir a partir dele". Havia três categorias
 * (personagem, lugar, figura citada) marcadas no léxico compilado do código, e
 * a marcação era um destaque tipográfico, não um caminho.
 *
 * **Hoje o léxico é cadastro (`lexicon_entries`, migração 0063), e só entra
 * nele o nome que tem CARTÃO.** Título, descrição e, se houver, imagem. A
 * consequência para esta tela é a regra inteira em uma linha:
 *
 * > está marcado ⇔ tem cartão ⇔ abre no toque.
 *
 * Um nome que o cadastro não conhece, ou que está lá como rascunho, não recebe
 * marcação nenhuma. Foi a escolha entre isso e marcar tudo deixando metade dos
 * nomes surda ao toque, que é pior que as duas pontas: promete e não entrega.
 * O preço é conhecido e foi aceito, no dia da migração nada fica marcado, e
 * cada nome acende quando alguém escreve o cartão dele.
 *
 * A CATEGORIA continua nos dados (`data-mention`) e continua fora da tinta.
 * Três cores de faixa num parágrafo produzem uma página de arco-íris, que é o
 * oposto do que o realce existe para fazer: ele só funciona enquanto for
 * exceção.
 *
 * ## Onde aplicar
 *
 * Em PROSA: parágrafo, conclusão, ilustração, objeção, nota de leitura,
 * comentário do Scriba. **Nunca no texto bíblico** dos blocos `bibleQuote` /
 * `relatedVerse`: ali todo nome é personagem e toda linha é a passagem, então
 * a marcação pintaria o bloco inteiro. E nunca nas frases de efeito
 * (`highlight`), que já carregam a faixa amarela, duas marcações sobrepostas
 * na mesma frase é uma a mais.
 *
 * ## Por que ele virou `"use client"`
 *
 * O léxico vem do banco, e chega aqui por contexto em vez de por prop. O
 * porquê, e o que isso custa na landing, está no cabeçalho do
 * `LexiconProvider`.
 */

function Segment({ segment }: { segment: AnnotatedSegment }) {
  if (segment.kind === "scripture") {
    return <InlineScripture reference={segment.reference} text={segment.text} />;
  }
  if (segment.kind === "name") {
    return <LexiconMention slug={segment.slug} category={segment.category} text={segment.text} />;
  }
  return <>{segment.text}</>;
}

function Annotated({
  text,
  lexicon,
}: {
  text: string;
  lexicon: ReturnType<typeof useLexiconIndex>;
}) {
  return (
    <>
      {annotateText(text, lexicon).map((segment, index) => (
        // O índice é chave legítima aqui: a lista é derivada de uma string
        // imutável, então nada entra, sai ou troca de lugar depois do primeiro
        // render. Uma chave "estável" pelo conteúdo seria pior, o mesmo nome
        // aparece duas vezes no mesmo parágrafo o tempo todo.
        // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
        <Fragment key={index}>
          <Segment segment={segment} />
        </Fragment>
      ))}
    </>
  );
}

export function RichText({ children }: { children: string }) {
  const lexicon = useLexiconIndex();

  /**
   * O MARCA-TEXTO é repartido ANTES da anotação, e a ordem é o que torna as
   * duas camadas compatíveis.
   *
   * A marca é da PESSOA: ela arrastou o dedo e disse "isto importa". A anotação
   * é do sistema: ele reconheceu uma referência ou um nome do léxico. As duas
   * têm de conviver no mesmo parágrafo, e a única ordem que funciona é esta —
   * anotando primeiro, as cercas `==` cairiam no meio de um segmento já fechado
   * e apareceriam como texto na tela.
   *
   * O efeito colateral é uma regra, não um defeito: **uma menção partida ao
   * meio por uma marca deixa de ser menção.** Marcar "João 3" e deixar o ":16"
   * de fora entrega dois pedaços, e nenhum deles é a referência inteira. É o
   * comportamento certo — a marca é um recorte deliberado do texto, e o sistema
   * não deve reinterpretar o que ela separou.
   *
   * `<mark>` é a tag do HTML para exatamente isto, e ela vem com fundo amarelo e
   * tinta preta de fábrica: os dois são zerados, porque quem pinta aqui é a
   * `.highlight-phrase`, a MESMA faixa da frase de destaque. Um segundo amarelo
   * no produto seria uma segunda gramática para a mesma ideia.
   */
  return (
    <>
      {splitMarks(children).map((piece, index) =>
        piece.marked ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
            key={index}
            className="highlight-phrase bg-transparent px-0.5 text-inherit [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
          >
            <Annotated text={piece.text} lexicon={lexicon} />
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
          <Fragment key={index}>
            <Annotated text={piece.text} lexicon={lexicon} />
          </Fragment>
        )
      )}
    </>
  );
}
