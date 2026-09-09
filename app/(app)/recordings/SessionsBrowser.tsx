"use client";

import { BookOpen, Captions, FileText, Loader2, MapPin, Mic, SearchX } from "lucide-react";
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
import type { SessionListItem } from "@/lib/db/sessions";
import { savedRouteFor } from "@/lib/domain/session";
import { SessionCardMenu } from "./SessionCardMenu";

/**
 * A lista de gravações salvas do `/recordings`, com busca e filtros.
 *
 * ## Por que é um componente cliente, e o que ficou no servidor
 *
 * A página continua sendo quem BUSCA — sessões, quais têm estudo, quais têm
 * resumo. O que desceu para cá é só o desenho da lista, porque filtrar exige
 * estado e responder a cada tecla exige que o estado seja local. O agrupamento
 * por período veio junto: agrupar no servidor e filtrar aqui deixaria seções
 * vazias na tela toda vez que o filtro esvaziasse um mês.
 *
 * `nowIso` vem do servidor de propósito. `groupLabel` compara com "agora", e
 * um `new Date()` calculado no cliente pode cair do outro lado da meia-noite em
 * relação ao HTML que o servidor mandou — o React descartaria a marcação por
 * divergência de hidratação, numa página inteira, por causa de um rótulo.
 *
 * ## O que a busca alcança
 *
 * Título, resumo curto, autor, local — tudo que o cartão mostra — mais a
 * TRANSCRIÇÃO, que o cartão não mostra e a lista não carrega: essa metade vem
 * de `/api/sessions/search` por `useContentSearch` e entra como união. O
 * cartão que casou só pela transcrição ganha a pastilha "trecho na
 * transcrição", senão ele apareceria sem nenhuma explicação visível para
 * estar ali.
 */
type Props = {
  sessions: SessionListItem[];
  /** Sessões que já têm estudo gerado. */
  deepenedIds: string[];
  /** Sessões do modo transcrição que ganharam resumo sob demanda. */
  summarizedIds: string[];
  nowIso: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function SessionsBrowser({
  sessions,
  deepenedIds,
  summarizedIds,
  nowIso,
  deleteAction,
}: Props) {
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>(FACET_ALL);
  const [location, setLocation] = useState<string>(FACET_ALL);
  const [range, setRange] = useState<DateRangeKey>("all");

  const { ids: transcriptHits, verses: verseRefs, pending: searching } = useContentSearch(query);

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const deepened = useMemo(() => new Set(deepenedIds), [deepenedIds]);
  const summarized = useMemo(() => new Set(summarizedIds), [summarizedIds]);

  const speakerOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerName)),
    [sessions]
  );
  const locationOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerLocation)),
    [sessions]
  );

  // O palheiro é montado UMA vez por lista, não uma por tecla: normalizar
  // acento de algumas centenas de cartões a cada caractere digitado é o tipo
  // de trabalho que só aparece no aparelho de quem tem muitas gravações.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      map.set(s.id, buildHaystack([s.title, s.shortSummary, s.speakerName, s.speakerLocation]));
    }
    return map;
  }, [sessions]);

  const tokens = useMemo(() => searchTokens(query), [query]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (speaker !== FACET_ALL && s.speakerName?.trim() !== speaker) return false;
      if (location !== FACET_ALL && s.speakerLocation?.trim() !== location) return false;
      if (!isWithinRange(s.createdAt, range, now)) return false;
      if (tokens.length === 0) return true;
      if (matchesAllTokens(haystacks.get(s.id) ?? "", tokens)) return true;
      return transcriptHits?.has(s.id) ?? false;
    });
  }, [sessions, speaker, location, range, now, tokens, haystacks, transcriptHits]);

  const groups = useMemo(() => {
    const out: { label: string; items: SessionListItem[] }[] = [];
    for (const s of filtered) {
      const label = groupLabel(s.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [filtered, now]);

  const filtering =
    query.trim().length > 0 || speaker !== FACET_ALL || location !== FACET_ALL || range !== "all";

  function clearAll() {
    setQuery("");
    setSpeaker(FACET_ALL);
    setLocation(FACET_ALL);
    setRange("all");
  }

  return (
    <div className="flex flex-col gap-6">
      <CollectionSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Buscar por título, autor, local, versículo ou algo dito na pregação"
        facets={[
          {
            label: "Autor",
            allLabel: "Todos os autores",
            value: speaker,
            options: speakerOptions,
            onChange: setSpeaker,
          },
          {
            label: "Local",
            allLabel: "Todos os locais",
            value: location,
            options: locationOptions,
            onChange: setLocation,
          },
        ]}
        range={range}
        onRangeChange={setRange}
        countLabel={
          searching
            ? "Procurando…"
            : resultLabel(filtered.length, sessions.length, ["gravação", "gravações"])
        }
        filtering={filtering}
        onClear={clearAll}
      />

      {/* Nada na tela E resposta a caminho não é "não encontrei": metade desta
        busca mora no servidor (a transcrição), e afirmar o vazio antes dela
        chegar é uma tela que se desmente sozinha meio segundo depois. Só o
        caso VAZIO espera — com resultados locais na tela a lista continua
        desenhada, e os cartões por transcrição somam quando chegam. */}
      {filtered.length === 0 && searching ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <Loader2 aria-hidden className="size-6 animate-spin text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Procurando…</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura dentro da transcrição e nos versículos citados em cada sermão, e
            essa parte vem do servidor.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <SearchX aria-hidden className="size-6 text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Nenhuma gravação com esse recorte.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura dentro da transcrição e nos versículos citados — tente uma
            palavra que o pregador tenha dito, uma referência como “Jonas 1”, ou solte um dos
            filtros.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-1 inline-flex items-center rounded-full bg-scriba-blue-soft px-4 py-2 text-[11px] font-semibold text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/70"
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
                const isDeepened = deepened.has(s.id);
                // Sessões do modo transcrição não têm resumo — a menos que
                // tenham ganhado um sob demanda, e então elas abrem no resumo
                // como qualquer outra.
                const isTranscriptOnly = s.mode === "transcript_only";
                const hasSummary = summarized.has(s.id);
                const href = `/recording/${s.id}/${savedRouteFor(s.mode, hasSummary)}`;
                // A referência que casou. Aparece mesmo quando o cartão já
                // casaria pelo título: ela não é justificativa, é informação —
                // dizer QUAL versículo daquele capítulo o pregador citou é
                // metade do que se quer saber ao procurar por "Jonas 1".
                const verseHit = tokens.length > 0 ? (verseRefs.get(s.id) ?? null) : null;
                // Casou pela transcrição e por mais nada visível no cartão.
                const transcriptOnlyHit =
                  !verseHit &&
                  tokens.length > 0 &&
                  !matchesAllTokens(haystacks.get(s.id) ?? "", tokens) &&
                  (transcriptHits?.has(s.id) ?? false);
                return (
                  <li
                    key={s.id}
                    className="group flex flex-col rounded-3xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.08)] transition-shadow hover:shadow-[0_8px_20px_rgba(79,168,240,0.18)] sm:p-6"
                  >
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <NavLink
                          href={href}
                          spinner="overlay"
                          contentClassName="flex min-w-0 items-center gap-2.5"
                          className="flex min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {/* O mesmo par do botão primário: gradiente
                              azul-escuro com tinta branca no claro,
                              pastilha clara com tinta navy no escuro. Era
                              `bg-scriba-blue` + `text-white`, o par que o
                              `src/shared/AGENTS.md` proíbe — `--scriba-blue`
                              é azul de SUPERFÍCIE, e branco sobre ele dá
                              2,56:1 no claro e 2,33:1 no escuro.

                              Sem a classe `.scriba-cta`: isto é uma
                              pastilha decorativa dentro do link, não um
                              botão, e o hover de lá acende um `box-shadow`
                              que não faz sentido num ícone. */}
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[image:var(--scriba-cta)] text-scriba-cta-ink">
                            {isTranscriptOnly && !hasSummary ? (
                              <Captions className="size-4" />
                            ) : (
                              <Mic className="size-4" />
                            )}
                          </div>
                          <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-base">
                            {s.title?.trim() || "Sessão sem título"}
                          </span>
                        </NavLink>
                        <SessionCardMenu sessionId={s.id} href={href} deleteAction={deleteAction} />
                      </div>
                      {s.shortSummary?.trim() ? (
                        <p className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft">
                          {s.shortSummary}
                        </p>
                      ) : null}
                      {verseHit ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink">
                          <BookOpen className="size-3" />
                          {verseHit}
                        </span>
                      ) : null}
                      {transcriptOnlyHit ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-scriba-mint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-ink">
                          <FileText className="size-3" />
                          Trecho na transcrição
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      {s.speakerName?.trim() || s.speakerLocation?.trim() ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {s.speakerName?.trim() ? (
                            <span className="text-[12px] font-medium text-scriba-ink">
                              {s.speakerName}
                            </span>
                          ) : null}
                          {s.speakerLocation?.trim() ? (
                            <>
                              <span className="text-scriba-ink-mute">·</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-light text-scriba-ink-mute">
                                <MapPin className="size-3" />
                                {s.speakerLocation}
                              </span>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                      <div className="flex flex-col gap-3 border-t border-scriba-hairline pt-3 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11px] font-light text-scriba-ink-mute">
                            {shortDate(s.createdAt, includeYear)}
                          </span>
                          {formatDurationShort(s.durationMs) ? (
                            <>
                              <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                              <span className="text-[11px] font-light text-scriba-ink-mute">
                                {formatDurationShort(s.durationMs)}
                              </span>
                            </>
                          ) : null}
                          {isTranscriptOnly ? (
                            <>
                              <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                              <span
                                title="Gravada no modo transcrição"
                                className="inline-flex items-center gap-1 rounded-full bg-scriba-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-cream-accent"
                              >
                                <Captions className="size-3" />
                                Transcrição
                              </span>
                            </>
                          ) : null}
                          {isDeepened ? (
                            <>
                              <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                              <span
                                title="Você já gerou o estudo deste sermão"
                                className="inline-flex items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink"
                              >
                                <BookOpen className="size-3" />
                                Estudo
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div className="sm:ml-auto">
                          <NavLink
                            href={href}
                            className="inline-flex w-full items-center justify-center rounded-full bg-scriba-blue-soft px-4 py-2 text-[11px] font-semibold text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/70 sm:w-auto"
                          >
                            {isTranscriptOnly && !hasSummary ? "Ver transcrição →" : "Ver resumo →"}
                          </NavLink>
                        </div>
                      </div>
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
