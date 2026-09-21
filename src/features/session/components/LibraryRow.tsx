"use client";

import { Share2, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { NavLink } from "@/components/NavLink";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { useLibraryWriter } from "@/features/session/query";
import type { SessionListItem, SessionMode } from "@/lib/domain/session";
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
 * ## As ações rápidas ficam FORA do link, nunca dentro
 *
 * O post-it já teve um menu de três pontinhos dentro do `<a>` que embrulha o
 * cartão inteiro, e ele saiu: botão dentro de link é HTML inválido, e numa
 * coluna de ~150px ele ainda comia a largura onde o título quebra (ver
 * `LibraryBrowser`). Aqui as duas causas não se aplicam do mesmo jeito — a
 * linha é a largura da página —, mas a estrutura continua certa: o `<a>` e o
 * grupo de ações são IRMÃOS dentro do `<li>`, nunca um dentro do outro, com o
 * `pr-20` do link abrindo o vão para as ações não cobrirem o texto.
 *
 * **Reveladas no HOVER, mas sempre visíveis no toque** (`no-touch:opacity-0
 * no-touch:group-hover:opacity-100`): hover não existe no celular, e duas
 * ações escondidas atrás de um gesto que não existe ali seriam inalcançáveis.
 * Ver `touch`/`no-touch` em `src/shared/AGENTS.md`.
 *
 * **Só Compartilhar e Excluir, não quatro.** Compartilhar é só um link
 * (`navigator.share` com fallback de copiar), e Excluir reusa exatamente o
 * `DELETE /api/sessions/:id` + `library.remove` otimista que a tela do resumo
 * já usa (ver `SavedSessionView.handleDelete`) — nenhuma rota nova. Favoritar
 * e Duplicar exigiriam coluna nova no banco e um endpoint que busca o payload
 * inteiro para clonar, trabalho de FEATURE e não de redesenho de linha; ficam
 * de fora até serem pedidos como o que são.
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const library = useLibraryWriter();

  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
  const excerpt = s.shortSummary?.trim();
  const title = s.title?.trim() || "Sessão sem título";

  async function handleDelete() {
    // Otimista, a MESMA régua de `SavedSessionView.handleDelete`: a linha
    // sai da lista antes da resposta, e volta se o servidor recusar.
    const undo = library.remove(s.id);
    const res = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      undo();
      toast.error("Não foi possível excluir. Tente novamente.");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${buildHref(s.id)}`;
    if (navigator.share) {
      // Cancelar o painel do sistema rejeita a promise; não é falha nossa,
      // não há o que avisar.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não consegui copiar o link");
    }
  }

  return (
    <li className="group relative border-v2-card-hover border-b last:border-b-0">
      <NavLink
        href={buildHref(s.id)}
        prefetchOnPress
        spinner="overlay"
        contentClassName="flex min-w-0 flex-col gap-1"
        className="block rounded-xl py-3.5 pr-20 pl-3 outline-none transition-colors hover:bg-v2-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute active:bg-v2-card-hover"
      >
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
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-light text-v2-ink-mute">
          <SessionModeGlyph mode={s.mode} />
          <span className="rounded-full bg-v2-card-hover px-1.5 py-px text-v2-ink-mute">
            {MODE_BADGE_LABEL[s.mode]}
          </span>
          {s.mode === "audio" && s.durationMs ? <span>{formatMmSs(s.durationMs)}</span> : null}
          <span className="truncate">{shortDate(s.createdAt, includeYear)}</span>
        </span>
      </NavLink>

      {/* Grupo IRMÃO do link, nunca dentro dele. Ver o cabeçalho do arquivo. */}
      <div
        className={
          "pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 opacity-100 " +
          "transition-opacity no-touch:opacity-0 no-touch:group-hover:opacity-100 no-touch:group-focus-within:opacity-100"
        }
      >
        <button
          type="button"
          onClick={handleShare}
          aria-label={`Compartilhar "${title}"`}
          className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          <Share2 aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label={`Excluir "${title}"`}
          className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-scriba-rose hover:text-scriba-rose-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir esta sessão?"
        description="O resumo e a transcrição são apagados para sempre. Não dá para desfazer."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </li>
  );
}

/** `memo`: a lista pode ter centenas de linhas, e a maioria dos re-renders da
 * Biblioteca (busca, filtro) não muda os DADOS de uma sessão que já estava na
 * tela — só a ORDEM/presença dela na lista, que o `<ul>` pai já resolve. */
export const LibraryRow = memo(LibraryRowImpl);
