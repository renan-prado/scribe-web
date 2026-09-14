"use client";

import { Loader2, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollectionSearch, FACET_ALL } from "@/features/session/components/CollectionSearch";
import { SessionCard } from "@/features/session/components/SessionCard";
import { useContentSearch } from "@/features/session/hooks/useContentSearch";
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
import { monthGroupLabel } from "../lib/format";
import { useSearchScope } from "./SearchScope";

/**
 * A lista da Biblioteca do v2, com a mesma busca e os mesmos filtros do
 * `/recordings`.
 *
 * ## O que é reaproveitado, e por quê
 *
 * A barra (`CollectionSearch`) e o motor (`lib/search.ts`) são os MESMOS das
 * listas do app atual. Escrever uma busca nova aqui significaria duas telas
 * procurando as mesmas gravações pelas mesmas chaves com dois comportamentos
 * que divergem no primeiro ajuste: uma passa a ignorar acento, a outra não.
 * O que muda é só o agrupamento, por MÊS (ver `monthGroupLabel`), que é o
 * desenho desta lista.
 *
 * ## A barra só aparece quando pedida
 *
 * No `/recordings` ela é permanente, porque aquela página é a tela de
 * PROCURAR. Aqui a Biblioteca é a primeira tela do app, e quem abre o Scriba
 * quase sempre quer o último sermão, não uma busca: a barra fica atrás da lupa
 * do cabeçalho (ver `SearchScope`) e devolve a primeira dobra para os cartões.
 *
 * **Fechar a busca LIMPA tudo.** Uma barra escondida com filtro ligado é a
 * pior combinação possível: a lista volta menor do que a pessoa deixou, e o
 * motivo está atrás de um toque que ela não sabe que precisa dar.
 *
 * ## Por que o "agora" vem do servidor
 *
 * `monthGroupLabel` e o filtro de período comparam com "agora", e um
 * `new Date()` calculado no cliente pode cair do outro lado da meia-noite em
 * relação ao HTML que o servidor mandou. O React descartaria a marcação por
 * divergência de hidratação, a página inteira, por causa de um rótulo.
 *
 * ## O que a busca alcança
 *
 * Título, resumo curto, autor e local, tudo que o cartão mostra, mais a
 * TRANSCRIÇÃO, que o cartão não mostra e a lista não carrega: essa metade vem
 * de `/api/sessions/search` por `useContentSearch` e entra como união.
 */
type Props = {
  sessions: SessionListItem[];
  /** Sessões que já têm estudo gerado. */
  deepenedIds: string[];
  nowIso: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

/** Toda sessão salva abre no resumo. */
function v2Href(id: string): string {
  return `/v2/summary/${id}`;
}

export function LibraryBrowser({ sessions, deepenedIds, nowIso, deleteAction }: Props) {
  const { open, setOpen } = useSearchScope();
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>(FACET_ALL);
  const [location, setLocation] = useState<string>(FACET_ALL);
  const [range, setRange] = useState<DateRangeKey>("all");

  const { ids: transcriptHits, pending: searching } = useContentSearch(open ? query : "");

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const deepened = useMemo(() => new Set(deepenedIds), [deepenedIds]);

  const speakerOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerName)),
    [sessions]
  );
  const locationOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerLocation)),
    [sessions]
  );

  // O palheiro é montado UMA vez por lista, não uma por tecla: normalizar
  // acento de algumas centenas de cartões a cada caractere digitado é o tipo de
  // trabalho que só aparece no aparelho de quem tem muitas gravações.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      map.set(s.id, buildHaystack([s.title, s.shortSummary, s.speakerName, s.speakerLocation]));
    }
    return map;
  }, [sessions]);

  const tokens = useMemo(() => searchTokens(open ? query : ""), [open, query]);

  const filtered = useMemo(() => {
    // Com a barra fechada não há filtro nenhum para aplicar, e passar a lista
    // inteira pelo funil seria trabalho para devolvê-la igual.
    if (!open) return sessions;
    return sessions.filter((s) => {
      if (speaker !== FACET_ALL && s.speakerName?.trim() !== speaker) return false;
      if (location !== FACET_ALL && s.speakerLocation?.trim() !== location) return false;
      if (!isWithinRange(s.createdAt, range, now)) return false;
      if (tokens.length === 0) return true;
      if (matchesAllTokens(haystacks.get(s.id) ?? "", tokens)) return true;
      return transcriptHits?.has(s.id) ?? false;
    });
  }, [open, sessions, speaker, location, range, now, tokens, haystacks, transcriptHits]);

  const groups = useMemo(() => {
    const out: { label: string; items: SessionListItem[] }[] = [];
    for (const s of filtered) {
      const label = monthGroupLabel(s.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [filtered, now]);

  const filtering =
    query.trim().length > 0 || speaker !== FACET_ALL || location !== FACET_ALL || range !== "all";

  const clearAll = useCallback(() => {
    setQuery("");
    setSpeaker(FACET_ALL);
    setLocation(FACET_ALL);
    setRange("all");
  }, []);

  // Quem fecha a busca é o botão do CABEÇALHO, que não conhece estes filtros
  // (ver `SearchScope`). Então a limpeza é uma reação ao fechamento, e não algo
  // que o botão faz: qualquer outro caminho que feche a barra amanhã já nasce
  // limpando junto.
  //
  // Sem isto, a lista volta certa (com a barra fechada nada é filtrado) mas os
  // seletores guardam a escolha antiga, e a busca REABRE filtrada por um autor
  // que a pessoa escolheu há dois dias.
  useEffect(() => {
    if (!open) clearAll();
  }, [open, clearAll]);

  return (
    <div className="flex flex-col gap-6">
      {open ? (
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
      ) : null}

      {/* Nada na tela E resposta a caminho não é "não encontrei": metade desta
          busca mora no servidor (a transcrição), e afirmar o vazio antes dela
          chegar é uma tela que se desmente sozinha meio segundo depois. */}
      {open && filtered.length === 0 && searching ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-v2-card-hover px-6 py-12 text-center">
          <Loader2 aria-hidden className="size-6 animate-spin text-v2-ink-mute" />
          <p className="text-sm font-medium text-v2-ink">Procurando…</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-v2-ink-soft">
            A busca também procura dentro da transcrição e nos versículos citados em cada sermão, e
            essa parte vem do servidor.
          </p>
        </div>
      ) : open && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-v2-card-hover px-6 py-12 text-center">
          <SearchX aria-hidden className="size-6 text-v2-ink-mute" />
          <p className="text-sm font-medium text-v2-ink">Nenhuma gravação com esse recorte.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-v2-ink-soft">
            A busca também procura dentro da transcrição e nos versículos citados, tente uma palavra
            que o pregador tenha dito, uma referência como “Jonas 1”, ou solte um dos filtros.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 inline-flex items-center rounded-full bg-v2-card px-4 py-2 text-[11px] font-semibold text-v2-ink transition-colors hover:bg-v2-card-hover"
          >
            Limpar busca
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="px-1 text-sm font-light text-v2-ink-mute">
          Nada gravado ainda. O que você gravar aparece aqui.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-3">
            <h2 className="px-1 text-[15px] font-semibold text-v2-ink-soft">{group.label}</h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  now={now}
                  isDeepened={deepened.has(s.id)}
                  deleteAction={deleteAction}
                  header="speaker"
                  buildHref={v2Href}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
