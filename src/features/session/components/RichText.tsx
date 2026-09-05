import { Fragment } from "react";
import { InlineScripture } from "@/features/session/components/ChapterMention";
import { type AnnotatedSegment, annotateText, type NameCategory } from "@/lib/domain/annotate";

/**
 * O texto corrido do RESUMO e do ESTUDO, com as menções marcadas.
 *
 * Um parágrafo de sermão é uma parede: quinze linhas de prosa cinza em que
 * "Filipenses 4:6", "Habacuque" e "Bonhoeffer" pesam exatamente o mesmo que as
 * conjunções em volta. Este componente dá relevo a três coisas que o olho
 * procura quando volta a um resumo dias depois — a passagem, o personagem e
 * quem foi citado — e deixa o resto como está.
 *
 * ## Dois tratamentos, três categorias
 *
 * A referência bíblica é a única CLICÁVEL, e por isso é a única colorida: ela
 * abre o texto da NVI num diálogo (`InlineScripture`). Nome próprio —
 * personagem, lugar ou figura citada — recebe a faixa de marca-texto e mais
 * nada, porque não há para onde ir a partir dele.
 *
 * As três categorias continuam distintas nos DADOS (`data-mention`, e o `title`
 * que nomeia cada uma), mas não na tinta. Três cores diferentes de marcação num
 * parágrafo produzem uma página de arco-íris, que é o oposto do que a marcação
 * existe para fazer: o realce só funciona enquanto for exceção.
 *
 * ## Onde aplicar
 *
 * Em PROSA: parágrafo, conclusão, ilustração, objeção, nota de leitura,
 * comentário do Scriba. **Nunca no texto bíblico** dos blocos `bibleQuote` /
 * `relatedVerse`: ali todo nome é personagem e toda linha é a passagem, então
 * a marcação pintaria o bloco inteiro. E nunca nas frases de efeito
 * (`highlight`), que já carregam a faixa amarela — duas marcações sobrepostas
 * na mesma frase é uma a mais.
 */

const CATEGORY_TITLE: Record<NameCategory, string> = {
  person: "Personagem bíblico",
  place: "Lugar bíblico",
  figure: "Autor citado",
};

/**
 * A faixa começa em 82% da altura da linha: é um traço sob as palavras, não um
 * bloco atrás delas. O glifo continua sobre o papel, então o contraste do
 * parágrafo não muda — e o `box-decoration-break` mantém a faixa inteira quando
 * um nome composto quebra entre duas linhas.
 */
const NAME_CLASSES =
  "font-medium text-scriba-ink-strong bg-[linear-gradient(transparent_82%,var(--session-mention-wash)_82%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

function Segment({ segment }: { segment: AnnotatedSegment }) {
  if (segment.kind === "scripture") {
    return <InlineScripture reference={segment.reference} text={segment.text} />;
  }
  if (segment.kind === "name") {
    return (
      <span
        data-mention={segment.category}
        title={CATEGORY_TITLE[segment.category]}
        className={NAME_CLASSES}
      >
        {segment.text}
      </span>
    );
  }
  return <>{segment.text}</>;
}

export function RichText({ children }: { children: string }) {
  const segments = annotateText(children);

  return (
    <>
      {segments.map((segment, index) => (
        // O índice é chave legítima aqui: a lista é derivada de uma string
        // imutável, então nada entra, sai ou troca de lugar depois do primeiro
        // render. Uma chave "estável" pelo conteúdo seria pior — o mesmo nome
        // aparece duas vezes no mesmo parágrafo o tempo todo.
        // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
        <Fragment key={index}>
          <Segment segment={segment} />
        </Fragment>
      ))}
    </>
  );
}
