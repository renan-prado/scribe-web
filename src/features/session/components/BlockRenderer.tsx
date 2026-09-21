import { BookGlyph } from "@/components/icons/BookGlyph";
import { ChapterMention } from "@/features/session/components/ChapterMention";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { RichText } from "@/features/session/components/RichText";
import { parseVerseReference } from "@/lib/domain/reference";
import { listItems, type SummaryBlock } from "@/lib/domain/summary";
import { ScribaMark } from "@/shared/brand";

export function blockKey(block: SummaryBlock): string {
  if (block.type === "bibleQuote") return `${block.reference}-${block.text.slice(0, 24)}`;
  if (block.type === "quote") return `${block.text.slice(0, 24)}-${block.author ?? ""}`;
  return block.text.slice(0, 32);
}

export function BlockRenderer({ block }: { block: SummaryBlock }) {
  switch (block.type) {
    case "h1":
      return (
        <h2 className="mt-4 font-heading text-[22px] font-bold leading-tight tracking-tight text-scriba-ink-strong sm:text-2xl">
          {block.text}
        </h2>
      );
    case "h2":
      return (
        <h3 className="mt-4 font-heading text-lg font-semibold leading-snug tracking-tight text-session-verse-text">
          {block.text}
        </h3>
      );
    case "paragraph":
      // A linha em branco DENTRO de um bloco vira parágrafo de verdade.
      //
      // Um `<p>` colapsa `\n\n` em espaço, então um bloco com dois parágrafos
      // saía como uma parede de dez linhas — a mesma que o Biblo aprendeu a não
      // escrever. Isso passou a acontecer quando "add isso ao resumo" começou a
      // preencher o bloco com uma resposta inteira dele (ver `verifySuggestion`),
      // e vale para qualquer bloco que tenha a quebra, venha de onde vier.
      //
      // O BLOCO continua sendo um: quem edita vê um campo só, e quem quiser
      // dois blocos os separa no editor. O que muda é só a marcação de leitura.
      return (
        <div className="space-y-3.5">
          {block.text.split(/\n{2,}/).map((paragraph, index) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos de um texto imutável, a ordem é estável
              key={`p-${index}`}
              className="text-pretty text-[15px] font-light leading-[1.72] text-scriba-ink"
            >
              <RichText>{paragraph}</RichText>
            </p>
          ))}
        </div>
      );
    case "bulletList":
    case "orderedList": {
      /**
       * A lista inteira é UM bloco, e cada linha de `text` é um item (ver
       * `listItems`, em `lib/domain/summary.ts`).
       *
       * **A numeração do `orderedList` é derivada aqui, pelo `<ol>`, e nunca
       * guardada.** Um "1." escrito dentro do texto sobreviveria a mover o
       * bloco e a apagar um item, e no primeiro reordenamento o banco diria
       * "3." onde a tela mostra o segundo. Quem conta é o navegador.
       *
       * **Não há vão entre os itens, e isso não é aperto: é o que mantém o
       * editor honesto.** Lá a lista é UMA `textarea` com uma linha por item, e
       * uma `textarea` não tem como pôr 8px entre duas linhas suas. Com um
       * `gap` aqui, os marcadores desenhados atrás da caixa (ver o espelho no
       * `Composer`) sairiam de fase com o texto a partir do segundo item. A
       * entrelinha de 1,72 já dá quase 26px por linha, que é ar de sobra para
       * uma lista de tópicos.
       *
       * `marker:` pinta a bolinha e o número na tinta apagada: em cheio eles
       * pesam mais que as palavras que anunciam. O recuo é de 1,25rem, e ele é
       * o MESMO `pl-5` da caixa do editor — os dois números andam juntos, senão
       * a lista quebra a linha num lugar na escrita e noutro na leitura.
       */
      const items = listItems(block.text);
      if (items.length === 0) return null;
      const face =
        "ml-5 text-pretty text-[15px] font-light leading-[1.72] text-scriba-ink marker:text-scriba-ink-mute";
      return block.type === "orderedList" ? (
        <ol className={`list-decimal ${face} marker:tabular-nums`}>
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: itens de um texto imutável, a ordem é estável
            <li key={`item-${index}`}>
              <RichText>{item}</RichText>
            </li>
          ))}
        </ol>
      ) : (
        <ul className={`list-disc ${face}`}>
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: itens de um texto imutável, a ordem é estável
            <li key={`item-${index}`}>
              <RichText>{item}</RichText>
            </li>
          ))}
        </ul>
      );
    }
    case "example":
      return (
        <aside className="relative rounded-2xl border-l-4 border-[var(--session-example-border)] bg-[var(--session-example-bg)] px-5 py-4">
          {/* "Exemplo", e não "Exemplo do pregador": o rótulo antigo só era
              verdade num resumo gerado a partir de um sermão, e a mesma
              moldura desenha hoje o texto que a pessoa escreveu à mão. O TIPO
              continua `example` — o que mudou é a palavra, não a chave. */}
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            Exemplo
          </span>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            <RichText>{block.text}</RichText>
          </p>
        </aside>
      );
    case "bibleQuote": {
      const parsed = parseVerseReference(block.reference);
      const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;

      // MENÇÃO, não citação. Uma referência solta, "Jonas 1", capítulo sem
      // versículo, não tem o que citar: o pregador NARROU a passagem em vez
      // de ler um versículo, então não há texto na transcrição, e o capítulo
      // inteiro não é uma faixa que `PassageVerses` possa buscar na NVI. A
      // moldura de citação ficava aberta em volta de nada: uma superfície com
      // gradiente, 26px de raio e 24 de padding para exibir duas palavras.
      //
      // A condição é "não há CORPO", e não "a referência é de capítulo": o que
      // torna a moldura vazia é não ter o que emoldurar. Um capítulo que venha
      // com texto continua sendo citação de verdade e mantém a moldura.
      if (!hasRange && !block.text) {
        return <ChapterMention reference={block.reference} />;
      }

      return (
        <figure className="relative flex flex-col gap-3.5 rounded-[26px] p-6 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]">
          <figcaption>
            <span className="inline-flex items-center gap-2 veil-chip rounded-full px-4 py-1.5 text-xs font-medium">
              <BookGlyph className="size-3" />
              {block.reference}
            </span>
          </figcaption>
          {hasRange ? (
            <div className="text-[15px] font-light leading-relaxed text-session-verse-text">
              <PassageVerses
                bookDisplay={parsed.bookDisplay}
                chapter={parsed.chapter}
                startVerse={parsed.startVerse as number}
                endVerse={parsed.endVerse as number}
              />
            </div>
          ) : (
            <blockquote className="text-[15px] font-light leading-relaxed text-session-verse-text">
              {block.text}
            </blockquote>
          )}
        </figure>
      );
    }
    case "highlight":
      return (
        // O que separa a frase do resto é o AR em volta dela e a faixa
        // amarela, não uma moldura: as duas aspas decorativas saíram, e com
        // elas a conta de métrica que existia só para igualar a de baixo à de
        // cima. A margem é a mesma nos dois lados porque agora não há nada
        // assimétrico para compensar.
        <figure className="my-6 flex flex-col items-center px-4 text-center sm:my-8 sm:px-8">
          <blockquote className="text-pretty text-lg font-semibold leading-relaxed text-scriba-ink-strong sm:text-xl">
            <span className="highlight-phrase px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {block.text}
            </span>
          </blockquote>
        </figure>
      );
    case "conclusion":
      return (
        <section className="relative mt-2 flex flex-col gap-3 rounded-[26px] p-6 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
            <ScribaMark className="size-3" />
            Conclusão
          </span>
          <p className="text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text">
            <RichText>{block.text}</RichText>
          </p>
        </section>
      );
    case "quote":
      return (
        <figure className="flex flex-col gap-1.5 border-l-2 border-scriba-hairline pl-4">
          <blockquote className="text-[15px] font-light italic leading-relaxed text-scriba-ink-soft">
            {block.text}
          </blockquote>
          {block.author ? (
            <figcaption className="text-xs font-normal text-scriba-ink-mute">
              {block.author}
            </figcaption>
          ) : null}
        </figure>
      );
    // Tipo desconhecido não desenha. Hoje isso cobre os resumos ANTIGOS, que
    // ainda trazem `contextCard` e `relatedVerse` no `final_summary`, os
    // comentários do Scriba que saíram do produto (ver `lib/domain/summary.ts`).
    default:
      return null;
  }
}
