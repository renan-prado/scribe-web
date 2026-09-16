"use client";

import { Loader2, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollectionSearch, FACET_ALL } from "@/features/session/components/CollectionSearch";
import { StudyNote } from "@/features/session/components/StudyNote";
import { useContentSearch } from "@/features/session/hooks/useContentSearch";
import { groupLabel } from "@/features/session/lib/formatting";
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
import { useSearchScope } from "../components/SearchScope";

/**
 * A lista de estudos do `/studies`, com a mesma busca do `/recordings`.
 *
 * ## O que a busca alcança aqui
 *
 * Título e abertura do ESTUDO, mais o título, o autor e a data do SERMÃO que o
 * originou. **A busca alcança MAIS do que o cartão mostra**, e é de propósito:
 * o post-it ficou com autor, título e data (ver `StudyNote`), mas quem procura
 * lembra da abertura do estudo ou do nome do sermão tanto quanto do título. O
 * corpo do estudo é que fica de fora: ele é um jsonb de quatro mil palavras por
 * linha, e trazê-lo para a lista custaria mais do que a busca vale.
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
  // A barra vive atrás da LUPA do cabeçalho, como na Biblioteca: quem abre os
  // Estudos quase sempre quer o último estudo, não uma busca. Ver `SearchScope`.
  const { open, setOpen } = useSearchScope();
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

  const clearAll = useCallback(() => {
    setQuery("");
    setSpeaker(FACET_ALL);
    setRange("all");
  }, []);

  // Fechar a busca LIMPA os filtros, e a limpeza é reação ao fechamento, não
  // algo que o botão faz: quem fecha é a lupa do cabeçalho, que não conhece
  // estes filtros. Sem isto a lista volta certa e os seletores guardam a
  // escolha antiga, então a busca REABRE recortada por um autor escolhido há
  // dois dias. Mesma decisão do `LibraryBrowser`.
  useEffect(() => {
    if (!open) clearAll();
  }, [open, clearAll]);

  return (
    <div className="flex flex-col gap-6">
      {open ? (
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
      ) : null}

      {/* Mesma regra do `/recordings`: enquanto a metade servidor da busca
        não responde, a tela não afirma que não há nada. Ver o comentário lá. */}
      {open && filtered.length === 0 && searching ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <Loader2 aria-hidden className="size-6 animate-spin text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Procurando…</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura na transcrição e nos versículos citados no sermão que originou
            cada estudo, e essa parte vem do servidor.
          </p>
        </div>
      ) : open && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-scriba-hairline px-6 py-12 text-center">
          <SearchX aria-hidden className="size-6 text-scriba-ink-mute" />
          <p className="text-sm font-medium text-scriba-ink">Nenhum estudo com esse recorte.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            A busca também procura na transcrição e nos versículos do sermão que originou cada
            estudo, tente uma palavra que o pregador tenha dito, uma referência como “Jonas 1”, ou
            solte um dos filtros.
          </p>
          {/* FECHA a barra, e o fechamento é que limpa (ver o efeito acima):
              com a lista vazia por causa do recorte, o que a pessoa quer é o
              acervo de volta, não o formulário zerado à espera de outra
              tentativa. Mesma decisão do `LibraryBrowser`. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 inline-flex items-center rounded-full bg-scriba-green-soft px-4 py-2 text-[11px] font-semibold text-scriba-mint-dark transition-colors hover:bg-scriba-green-soft/70"
          >
            Limpar busca
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-3">
            {/* O MESMO cabeçalho de bloco da Biblioteca: `font-medium`, porque
                o título dos post-its é regular e um cabeçalho em negrito
                pesaria mais que os próprios cartões que ele anuncia. O fio e a
                contagem que ficavam aqui saíram com ele — a contagem já é dita
                pela barra de busca, duas linhas acima. */}
            <h2 className="px-1 text-[15px] font-medium text-v2-ink-soft">{group.label}</h2>
            {/* MASONRY por colunas de CSS, o mesmo mural da Biblioteca: duas
                colunas, altura livre por cartão. O espaço vertical sai do
                `mb-4` de cada `<li>` (ver `PostItNote`), porque `gap` em
                contexto de colunas só vale ENTRE as colunas.

                A ordem de leitura vira coluna-a-coluna, e isso é consciente: o
                segundo estudo mais recente cai ABAIXO do primeiro, não ao lado.
                O agrupamento por período contém o estrago, a bagunça nunca
                atravessa a fronteira de um bloco. */}
            <ul className="columns-2 gap-4">
              {group.items.map((s) => {
                const verseHit = tokens.length > 0 ? (verseRefs.get(s.sessionId) ?? null) : null;
                const transcriptOnlyHit =
                  !verseHit &&
                  tokens.length > 0 &&
                  !matchesAllTokens(haystacks.get(s.sessionId) ?? "", tokens) &&
                  (transcriptHits?.has(s.sessionId) ?? false);
                return (
                  <StudyNote
                    key={s.sessionId}
                    study={s}
                    now={now}
                    verseHit={verseHit}
                    transcriptHit={transcriptOnlyHit}
                  />
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
