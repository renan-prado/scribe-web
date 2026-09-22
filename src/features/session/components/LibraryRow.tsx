"use client";

import { ChevronRight } from "lucide-react";
import { memo } from "react";
import { NavLink } from "@/components/NavLink";
import type { SessionListItem, SessionMode } from "@/lib/domain/session";
import { sessionDragProps } from "../lib/folder-dnd";
import { shortDate } from "../lib/formatting";
import { formatMmSs } from "../lib/text";
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
 * **No celular ele some** (`hidden sm:block`): a coluna estreita não tem o
 * mesmo sobra, e título, selo do modo e data já dizem o essencial.
 *
 * **Sem cor de post-it.** A cor sorteada é memória visual de um mural; numa
 * pilha de linhas ela viraria uma lista listrada de quatro tons. O que separa
 * uma linha da outra aqui é um fio, e o toque acende a superfície inteira.
 *
 * **Sem ação rápida nenhuma.** A linha já teve Compartilhar e Excluir, um
 * menu revelado no hover — e ele saiu: numa lista de VARREDURA, dois botões ao
 * lado do texto competem com a leitura, e as duas ações já moram na tela do
 * resumo, a um toque de distância. O que sobra do lado direito é uma seta,
 * decoração e nada mais — ela não é um segundo alvo, é parte do mesmo `<a>`
 * que a linha inteira já é.
 *
 * É o `<li>` inteiro, como o post-it: quem usa põe o `<ul>`.
 */

const MODE_BADGE_LABEL: Record<SessionMode, string> = {
  audio: "Gravado",
  youtube: "YouTube",
  manual: "Escrito",
};

function LibraryRowImpl({
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
  const title = s.title?.trim() || "Sessão sem título";

  return (
    <li className="border-v2-card-hover border-b last:border-b-0" {...sessionDragProps(s.id)}>
      <NavLink
        href={buildHref(s.id)}
        prefetchOnPress
        spinner="overlay"
        contentClassName="flex min-w-0 items-center gap-2"
        className="block rounded-xl px-3 py-3.5 outline-none transition-colors hover:bg-v2-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute active:bg-v2-card-hover"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          {s.speakerName?.trim() ? (
            <span className="truncate text-[11px] font-light leading-none text-v2-ink-mute">
              {s.speakerName.trim()}
            </span>
          ) : null}
          <span className="truncate text-[15px] font-normal leading-snug text-v2-ink">{title}</span>
          {excerpt ? (
            /* Duas linhas e o resto reticenciado. Uma linha só corta o trecho
               antes de ele dizer alguma coisa; três fazem a lista perder a
               cadência que a torna varrível. */
            <span className="hidden text-[12.5px] font-light leading-relaxed text-v2-ink-soft sm:line-clamp-2 sm:block">
              {excerpt}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 text-[11px] font-light text-v2-ink-mute">
            <SessionModeGlyph mode={s.mode} />
            <span className="rounded-full bg-v2-card-hover px-1.5 py-px text-v2-ink-mute">
              {MODE_BADGE_LABEL[s.mode]}
            </span>
            {s.mode === "audio" && s.durationMs ? <span>{formatMmSs(s.durationMs)}</span> : null}
            <span className="truncate">{shortDate(s.createdAt, includeYear)}</span>
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-v2-ink-mute" strokeWidth={1.75} />
      </NavLink>
    </li>
  );
}

/** `memo`: a lista pode ter centenas de linhas, e a maioria dos re-renders da
 * Biblioteca (busca, filtro) não muda os DADOS de uma sessão que já estava na
 * tela — só a ORDEM/presença dela na lista, que o `<ul>` pai já resolve. */
export const LibraryRow = memo(LibraryRowImpl);
