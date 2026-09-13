"use client";

import { BookOpen, FileText, Loader2, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { CollectionSearch, FACET_ALL } from "@/features/session/components/CollectionSearch";
import { useContentSearch } from "@/features/session/hooks/useContentSearch";
import { formatDurationShort, groupLabel, shortDate } from "@/features/session/lib/formatting";
import {
  buildHaystack,
  type DateRangeKey,
  facetOptions,
  isWithinRange,
  matchesAllTokens,
  resultLabel,
  searchTokens,
} from "@/features/session/lib/search";
import type { DeepeningListItem } from "@/lib/db/deepenings";

/**
 * A lista de estudos do `/studies`, com a mesma busca do `/recordings`.
 *
 * ## O que a busca alcança aqui
 *
 * Título e abertura do ESTUDO, mais o título, o autor e a data do SERMÃO que o
 * originou, os dois blocos que o cartão mostra. O corpo do estudo fica de
 * fora: ele é um jsonb de quatro mil palavras por linha, e trazê-lo para a
 * lista custaria mais do que a busca vale.
 *
 * A transcrição do sermão, essa entra, pela mesma rota do `/recordings`
 * (`/api/sessions/search`), porque estudo e sessão compartilham a chave. E é
 * uma busca que faz sentido justamente aqui: o estudo NÃO repete o sermão (o
 * pipeline foi desenhado para isso, ver `lib/AGENTS.md`), então procurar
 * pelo que o pregador disse é a única forma de reencontrar um estudo pela
 * pregação que o gerou.
 *
 * O agrupamento por data e o `nowIso` seguem a mesma regra do `SessionsBrowser`:
 * agrupar depois de filtrar, e comparar com o "agora" do servidor.
 */
type Props = {
  studies: DeepeningListItem[];
  nowIso: string;
};

export function StudiesBrowser({ studies, nowIso }: Props) {
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>(FACET_ALL);
  const [range, setRange] = useState<DateRangeKey>("all");

  const { ids: transcriptHits, verses: verseRefs, pending: searching } = useContentSearch(query);

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const speakerOptions = useMemo(
    () => facetOptions(studies.map((s) => s.sessionSpeakerName)),
    [studies]
  );

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of studies) {
      map.set(
        s.sessionId,
        buildHaystack([s.studyTitle, s.studyShort, s.sessionTitle, s.sessionSpeakerName])
      );
    }
    return map;
  }, [studies]);

  const tokens = useMemo(() => searchTokens(query), [query]);

  const filtered = useMemo(() => {
    return studies.filter((s) => {
      if (speaker !== FACET_ALL && s.sessionSpeakerName?.trim() !== speaker) return false;
      // O período filtra pela data do ESTUDO, que é a data do cartão e a que
      // ordena a lista. Filtrar pela do sermão faria "últimos 7 dias" esconder
      // um estudo gerado hoje sobre uma pregação do ano passado.
      if (!isWithinRange(s.createdAt, range, now)) return false;
      if (tokens.length === 0) return true;
      if (matchesAllTokens(haystacks.get(s.sessionId) ?? "", tokens)) return true;
      return transcriptHits?.has(s.sessionId) ?? false;
    });
  }, [studies, speaker, range, now, tokens, haystacks, transcriptHits]);

  const groups = useMemo(() => {
    const out: { label: string; items: DeepeningListItem[] }[] = [];
    for (const s of filtered) {
      const label = groupLabel(s.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [filtered, now]);

  const filtering = query.trim().length > 0 || speaker !== FACET_ALL || range !== "all";

  function clearAll() {
    setQuery("");
    setSpeaker(FACET_ALL);
    setRange("all");
  }

  return (
    <div className="flex flex-col gap-6">
      <CollectionSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Buscar por tema, autor, versículo ou algo dito na pregação"
        facets={[
          {
            label: "Autor",
            allLabel: "Todos os autores",
            value: speaker,
            options: speakerOptions,
            onChange: setSpeaker,
          },
        ]}
        range={range}
        onRangeChange={setRange}
        countLabel={
          searching
            ? "Procurando…"
            : resultLabel(filtered.length, studies.length, ["estudo", "estudos"])
        }
        filtering={filtering}
        onClear={clearAll}
      />

      {/* Mesma regra do `/recordings`: enquanto a metade servidor da busca
        não responde, a tela não afirma que não há nada. Ver o comentário lá. */}
      {filtered.length === 0 && searching ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <Loader2 aria-hidden className="size-6 animate-spin text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Procurando…</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura na transcrição e nos versículos citados no sermão que originou
            cada estudo, e essa parte vem do servidor.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <SearchX aria-hidden className="size-6 text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Nenhum estudo com esse recorte.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura na transcrição e nos versículos do sermão que originou cada
            estudo, tente uma palavra que o pregador tenha dito, uma referência como “Jonas 1”, ou
            solte um dos filtros.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-1 inline-flex items-center rounded-full bg-scriba-green-soft px-4 py-2 text-[11px] font-semibold text-scriba-mint-dark transition-colors hover:bg-scriba-green-soft/70"
          >
            Limpar busca
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs font-semibold text-scriba-ink-mute">{group.label}</span>
              <span className="h-px flex-1 bg-scriba-hairline" />
              <span className="text-[11px] font-light text-scriba-ink-mute">
                {group.items.length}
              </span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.items.map((s) => {
                const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
                const sessionIncludeYear =
                  s.sessionCreatedAt &&
                  new Date(s.sessionCreatedAt).getFullYear() !== now.getFullYear();
                const sessionLabel = s.sessionTitle?.trim() || "Sessão sem título";
                const verseHit = tokens.length > 0 ? (verseRefs.get(s.sessionId) ?? null) : null;
                const transcriptOnlyHit =
                  !verseHit &&
                  tokens.length > 0 &&
                  !matchesAllTokens(haystacks.get(s.sessionId) ?? "", tokens) &&
                  (transcriptHits?.has(s.sessionId) ?? false);
                return (
                  <li
                    key={s.sessionId}
                    // CARTÃO INTEIRO CLICÁVEL, por "stretched link": quem
                    // carrega o destino continua sendo o `<a>` do título, e é
                    // o `::after` dele que se estica até as bordas deste
                    // `<li>`. Envolver o cartão num `<a>` seria mais simples e
                    // está errado: o menu de contexto é um `<button>`, e botão
                    // dentro de link é HTML inválido e armadilha de teclado.
                    //
                    // `relative` aqui é o que dá ao `::after` uma caixa para
                    // preencher, e por isso o link precisa deixar de ser
                    // `relative` (ver o `static` lá embaixo).
                    //
                    // O retorno visual mora no próprio `::after`, como um véu
                    // de `--scriba-ink-strong`, que INVERTE por tema: escurece
                    // no claro e clareia no escuro, uma declaração só para os
                    // dois. Tinta chapada não serviria, o fundo do cartão é
                    // `background-image` e uma cor de fundo ficaria por baixo
                    // dele, invisível.
                    //
                    // `:active` alcança os ANCESTRAIS do elemento acionado, é
                    // o que faz `group-active:` funcionar a partir de um <li>
                    // e o que dá retorno ao toque no celular, onde `hover:` é
                    // código morto (ver `src/shared/AGENTS.md`).
                    className="group relative flex flex-col rounded-3xl border border-scriba-hairline-soft bg-[image:var(--feed-card)] bg-[size:200%_100%] p-5 transition-colors hover:border-scriba-ink-strong/20 sm:p-6"
                  >
                    <NavLink
                      href={`/recording/${s.sessionId}/deepening`}
                      spinner="overlay"
                      contentClassName="flex min-w-0 flex-1 flex-col gap-3"
                      // Ver o cartão do /recordings: `static` derruba o
                      // `relative` do `spinner="overlay"` para o `::after`
                      // se medir pelo <li>.
                      className="static flex min-w-0 flex-1 flex-col rounded-md outline-none after:absolute after:inset-0 after:rounded-3xl after:transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 group-hover:after:bg-scriba-ink-strong/[0.035] group-active:after:bg-scriba-ink-strong/[0.07]"
                    >
                      <div className="flex items-start gap-2.5">
                        {/* A MESMA pastilha do /recordings, agora o véu
                            (`.veil-chip`), não a versão verde da família do
                            estudo. O verde continua no resto da página e no
                            `.tone-study` da leitura; só esta pastilha é comum
                            às duas listas. */}
                        <div className="veil-chip flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <BookOpen className="size-4" />
                        </div>
                        <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-base">
                          {s.studyTitle}
                        </span>
                      </div>
                      {s.studyShort ? (
                        <p className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft">
                          {s.studyShort.length > 180
                            ? `${s.studyShort.slice(0, 180).trim()}…`
                            : s.studyShort}
                        </p>
                      ) : null}
                    </NavLink>

                    {verseHit ? (
                      <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink">
                        <BookOpen className="size-3" />
                        {verseHit}
                      </span>
                    ) : null}
                    {transcriptOnlyHit ? (
                      <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-scriba-mint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-ink">
                        <FileText className="size-3" />
                        Trecho na transcrição
                      </span>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 border-t border-scriba-hairline pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
                        Baseado em
                      </span>
                      <NavLink
                        href={`/recording/${s.sessionId}/summary`}
                        spinner="overlay"
                        contentClassName="flex flex-col gap-0.5"
                        className="-mx-1 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-scriba-green-soft/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <span className="text-pretty text-[13px] font-medium leading-snug text-scriba-ink">
                          {sessionLabel}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-light text-scriba-ink-mute">
                          {s.sessionSpeakerName?.trim() ? (
                            <span className="font-medium text-scriba-ink">
                              {s.sessionSpeakerName}
                            </span>
                          ) : null}
                          {s.sessionCreatedAt ? (
                            <>
                              {s.sessionSpeakerName?.trim() ? (
                                <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                              ) : null}
                              <span>{shortDate(s.sessionCreatedAt, !!sessionIncludeYear)}</span>
                            </>
                          ) : null}
                          {formatDurationShort(s.sessionDurationMs) ? (
                            <>
                              <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                              <span>{formatDurationShort(s.sessionDurationMs)}</span>
                            </>
                          ) : null}
                        </span>
                      </NavLink>
                      <span className="mt-1 text-[11px] font-light text-scriba-ink-mute">
                        Estudo gerado em {shortDate(s.createdAt, includeYear)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
