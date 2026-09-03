import { BookGlyph } from "@/components/icons/BookGlyph";
import { BlockRenderer } from "@/features/session/components/BlockRenderer";
import type { StudyBlock } from "@/lib/domain/study";

/**
 * Renderer do ESTUDO. Delega ao `BlockRenderer` os blocos que o estudo divide
 * com o resumo, e desenha ele mesmo os cinco que não existem lá.
 *
 * Quatro tipos são novos (`objection`, `distinction`, `reading`, `question`) e
 * o quinto — `example` — é reinterpretado: no resumo ele é "Exemplo do
 * pregador", porque veio do sermão; aqui é uma ilustração que o próprio estudo
 * traz, e a etiqueta errada era um dos sinais de que estudo e resumo eram a
 * mesma coisa por dentro. Ver `docs/estudo-v2.md` §1.7 e §5.1.
 */

export function studyBlockKey(block: StudyBlock): string {
  switch (block.type) {
    case "bibleQuote":
      return `${block.reference}-${block.text.slice(0, 24)}`;
    case "quote":
      return `${block.author}-${block.text.slice(0, 24)}`;
    case "distinction":
      return `${block.a}-${block.b}`;
    case "reading":
      return `${block.author}-${block.title}`;
    case "objection":
      return `obj-${block.text.slice(0, 32)}`;
    default:
      return block.text.slice(0, 32);
  }
}

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em]";

export function StudyBlockRenderer({ block }: { block: StudyBlock }) {
  switch (block.type) {
    case "example":
      return (
        <aside className="relative rounded-2xl border-l-4 border-[var(--session-example-border)] bg-[var(--session-example-bg)] px-5 py-4">
          <span className={`mb-1.5 block ${LABEL} text-scriba-ink-mute`}>Ilustração</span>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            {block.text}
          </p>
        </aside>
      );

    case "objection":
      return (
        <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline bg-scriba-paper px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span className={`${LABEL} text-scriba-ink-mute`}>Objeção</span>
            <p className="text-pretty text-[15px] font-medium leading-relaxed text-scriba-ink-strong">
              {block.text}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-scriba-hairline pt-3">
            <span className={`${LABEL} text-scriba-green`}>Resposta</span>
            <p className="text-pretty text-[15px] font-light leading-relaxed text-scriba-ink">
              {block.response}
            </p>
          </div>
        </section>
      );

    case "distinction":
      return (
        <section className="flex flex-col gap-3 rounded-2xl bg-scriba-blue-soft/50 px-5 py-4">
          <span className={`${LABEL} text-scriba-ink-mute`}>Distinção</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-scriba-paper px-3 py-1 text-[13px] font-semibold text-scriba-ink-strong">
              {block.a}
            </span>
            <span aria-hidden className="text-[11px] font-medium text-scriba-ink-mute">
              não é
            </span>
            <span className="rounded-full bg-scriba-paper px-3 py-1 text-[13px] font-semibold text-scriba-ink-strong">
              {block.b}
            </span>
          </div>
          <p className="text-pretty text-[15px] font-light leading-relaxed text-scriba-ink">
            {block.text}
          </p>
        </section>
      );

    case "reading":
      return (
        <aside className="flex items-start gap-3.5 rounded-2xl border border-scriba-hairline-soft px-5 py-4">
          <BookGlyph aria-hidden className="mt-1 size-4 shrink-0 border-scriba-ink-mute" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className={`${LABEL} text-scriba-ink-mute`}>Para ler depois</span>
            <p className="text-pretty text-[15px] font-medium leading-snug text-scriba-ink-strong">
              {block.title}
            </p>
            <p className="text-xs font-normal text-scriba-ink-mute">{block.author}</p>
            {block.note ? (
              <p className="mt-1 text-pretty text-sm font-light leading-relaxed text-scriba-ink">
                {block.note}
              </p>
            ) : null}
          </div>
        </aside>
      );

    case "question":
      return (
        <figure className="flex flex-col gap-2 border-l-[2.5px] border-scriba-green pl-4">
          <span className={`${LABEL} text-scriba-green`}>Para continuar pensando</span>
          <blockquote className="text-pretty text-[17px] font-medium leading-snug text-scriba-ink-strong">
            {block.text}
          </blockquote>
        </figure>
      );

    default:
      // Os blocos que o estudo divide com o resumo. `StudyBlock` é estrutural-
      // mente compatível com `SummaryBlock` neles — `quote` só ganhou `work`,
      // que o renderer compartilhado ignora.
      return <BlockRenderer block={block} />;
  }
}
