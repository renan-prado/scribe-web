import { BlockRenderer } from "@/features/session/components/BlockRenderer";
import { RichText } from "@/features/session/components/RichText";
import type { StudyBlock } from "@/lib/domain/study";
import { cn } from "@/lib/utils";

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

/**
 * Paleta das capas tipográficas. Tokens existentes, nunca cor literal —
 * `src/shared/AGENTS.md`. Índice escolhido pelo título, não sorteado: a mesma
 * obra tem de sair com a mesma cor toda vez que aparecer, em qualquer estudo.
 */
const COVER_TONES = [
  "bg-scriba-blue-soft text-scriba-blue-ink",
  "bg-scriba-green-soft text-scriba-green-ink",
  "bg-scriba-cream text-scriba-cream-ink",
  "bg-scriba-lilac text-scriba-lilac-ink",
  "bg-scriba-rose text-scriba-rose-ink",
  "bg-scriba-mint text-scriba-mint-ink",
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length];
}

/**
 * A capa do livro indicado. Proporção 2:3, a de um livro de verdade.
 *
 * Duas formas, e a tipográfica NÃO é um placeholder degradado: ela é o caso
 * comum. `coverUrl` só existe quando `GOOGLE_BOOKS_API_KEY` está configurada e
 * a API confirmou o par autor+título (ver `lib/study/covers.ts`) — sem chave,
 * toda capa é tipográfica, e o bloco tem de parecer intencional assim.
 *
 * Daí ela carregar o TÍTULO, e não um ícone genérico: uma lombada com o nome
 * do livro é informação, um livrinho cinza é ausência.
 */
function BookCover({
  title,
  author,
  coverUrl,
}: {
  title: string;
  author: string;
  coverUrl?: string;
}) {
  if (coverUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: URL externa e variável; next/image exigiria allowlist de domínio
      <img
        src={coverUrl}
        alt={`Capa de ${title}`}
        width={56}
        height={84}
        loading="lazy"
        className="h-[84px] w-14 shrink-0 rounded-md object-cover shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex h-[84px] w-14 shrink-0 flex-col justify-between rounded-md px-2 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        // A borda esquerda mais grossa é a lombada — é o que faz o retângulo
        // ser lido como livro sem precisar de ilustração.
        "border-l-[3px] border-black/10",
        toneFor(title)
      )}
    >
      <span className="line-clamp-4 text-[8.5px] font-semibold leading-[1.25] tracking-tight">
        {title}
      </span>
      <span className="truncate text-[7px] font-normal opacity-70">{author}</span>
    </div>
  );
}

export function StudyBlockRenderer({ block }: { block: StudyBlock }) {
  switch (block.type) {
    case "example":
      return (
        <aside className="relative rounded-2xl border-l-4 border-[var(--session-example-border)] bg-[var(--session-example-bg)] px-5 py-4">
          <span className={`mb-1.5 block ${LABEL} text-scriba-ink-mute`}>Ilustração</span>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            <RichText>{block.text}</RichText>
          </p>
        </aside>
      );

    case "objection":
      return (
        <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline bg-scriba-paper px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span className={`${LABEL} text-scriba-ink-mute`}>Objeção</span>
            <p className="text-pretty text-[15px] font-medium leading-relaxed text-scriba-ink-strong">
              <RichText>{block.text}</RichText>
            </p>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-scriba-hairline pt-3">
            <span className={`${LABEL} text-scriba-green`}>Resposta</span>
            <p className="text-pretty text-[15px] font-light leading-relaxed text-scriba-ink">
              <RichText>{block.response}</RichText>
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
            <RichText>{block.text}</RichText>
          </p>
        </section>
      );

    case "reading":
      return (
        <aside className="flex items-start gap-4 rounded-2xl border border-scriba-hairline-soft px-5 py-4">
          <BookCover title={block.title} author={block.author} coverUrl={block.coverUrl} />
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <span className={`${LABEL} text-scriba-ink-mute`}>Para ler depois</span>
            <p className="text-pretty text-[15px] font-medium leading-snug text-scriba-ink-strong">
              {block.title}
            </p>
            <p className="text-xs font-normal text-scriba-ink-mute">{block.author}</p>
            {block.note ? (
              <p className="mt-1 text-pretty text-sm font-light leading-relaxed text-scriba-ink">
                <RichText>{block.note}</RichText>
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
