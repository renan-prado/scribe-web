import { NavLink } from "@/components/NavLink";
import type { SessionListItem } from "@/lib/domain/session";
import { shortDate } from "../lib/formatting";
import { SessionModeGlyph } from "./SessionModeGlyph";

/**
 * Uma sessão como LINHA, a vista de varredura da Biblioteca.
 *
 * ## Quando ela ganha do mural
 *
 * Quando o acervo passa de algumas dezenas e a pessoa está PROCURANDO. O mural
 * de post-its é cor por sessão, altura livre e ordem coluna-a-coluna: ótimo
 * para olhar a parede inteira, péssimo para percorrer títulos de cima a baixo.
 * Aqui é o contrário — uma linha por sermão, todas do mesmo tamanho, na ordem
 * cronológica exata.
 *
 * ## O que a linha mostra, e por que o TRECHO entra aqui
 *
 * Título, trecho e data, com o autor por cima quando existe. O trecho
 * (`shortSummary`) foi tirado do post-it de propósito — numa coluna de ~150px
 * cada linha a mais empurrava a data para fora do primeiro olhar —, e aqui a
 * largura é a da página inteira: as duas linhas de resumo cabem sem custar
 * nada e são justamente o que diferencia dois sermões de título parecido.
 *
 * **Sem cor de post-it.** A cor sorteada é memória visual de um mural; numa
 * pilha de linhas ela viraria uma lista listrada de quatro tons. O que separa
 * uma linha da outra aqui é um fio, e o toque acende a superfície inteira.
 *
 * É o `<li>` inteiro, como o post-it: quem usa põe o `<ul>`.
 */
export function LibraryRow({
  session: s,
  now,
  buildHref = (id) => `/summary/${id}`,
}: {
  session: SessionListItem;
  /** "Agora" vem do servidor, ver `LibraryNote`. */
  now: Date;
  buildHref?: (id: string) => string;
}) {
  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
  const excerpt = s.shortSummary?.trim();

  return (
    <li className="border-v2-card-hover border-b last:border-b-0">
      <NavLink
        href={buildHref(s.id)}
        prefetchOnPress
        spinner="overlay"
        contentClassName="flex min-w-0 flex-col gap-1"
        className="block rounded-xl px-3 py-3.5 outline-none transition-colors hover:bg-v2-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute active:bg-v2-card-hover"
      >
        {s.speakerName?.trim() ? (
          <span className="truncate text-[11px] font-light leading-none text-v2-ink-mute">
            {s.speakerName.trim()}
          </span>
        ) : null}
        <span className="truncate text-[15px] font-normal leading-snug text-v2-ink">
          {s.title?.trim() || "Sessão sem título"}
        </span>
        {excerpt ? (
          /* Duas linhas e o resto reticenciado. Uma linha só corta o trecho
             antes de ele dizer alguma coisa; três fazem a lista perder a
             cadência que a torna varrível. */
          <span className="line-clamp-2 text-[12.5px] font-light leading-relaxed text-v2-ink-soft">
            {excerpt}
          </span>
        ) : null}
        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-light text-v2-ink-mute">
          <SessionModeGlyph mode={s.mode} />
          {shortDate(s.createdAt, includeYear)}
        </span>
      </NavLink>
    </li>
  );
}
