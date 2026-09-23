"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FACET_ALL } from "@/features/session/components/CollectionSearch";
import { SessionModeGlyph } from "@/features/session/components/SessionModeGlyph";
import { useContentSearch } from "@/features/session/hooks/useContentSearch";
import { groupLabel, shortDate } from "@/features/session/lib/formatting";
import {
  buildHaystack,
  DATE_RANGES,
  type DateRangeKey,
  facetOptions,
  isWithinRange,
  matchesAllTokens,
  resultLabel,
  searchTokens,
} from "@/features/session/lib/search";
import { useLibrary } from "@/features/session/query";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { SessionListItem } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { useGlobalSearchStore } from "./GlobalSearchStore";

/**
 * A busca GLOBAL do app: Ctrl+K, tela cheia no celular.
 *
 * ## O que ela substituiu
 *
 * Havia DUAS buscas para o mesmo acervo: a barra atrás da lupa da Biblioteca
 * (`CollectionSearch`, aberta por `?busca=1`) e um link que as outras telas
 * usavam para chegar até ela. As duas viraram esta — um diálogo por cima de
 * QUALQUER tela, sem navegar para `/home` primeiro. `SearchScope` e
 * `CollectionSearch` continuam existindo, mas só para os Estudos, que não são
 * assunto deste componente (ver `src/features/session/AGENTS.md`, "o estudo
 * está saindo do produto").
 *
 * ## De onde vem a lista, e por que ela não conhece PASTA
 *
 * `useLibrary()`, o mesmo cache do aparelho que a Biblioteca usa — não há
 * consulta nova. E ela busca no ACERVO INTEIRO, nunca só na pasta aberta: quem
 * dispara Ctrl+K de dentro de "2026 › Romanos" está procurando um sermão, não
 * navegando a árvore de pastas.
 *
 * ## O motor é o mesmo de `LibraryBrowser` e `StudiesBrowser`
 *
 * Token, sem acento, conjuntivo (`lib/search.ts`), mais a metade SERVIDOR
 * (transcrição) por `useContentSearch`. Uma busca nova aqui, com regras
 * próprias, faria a pessoa aprender dois jeitos de procurar a mesma coisa
 * dependendo de onde ela clicou.
 *
 * ## Sem filtro nenhum ela já mostra o acervo RECENTE
 *
 * Abrir com o campo vazio e ver "digite para procurar" é uma busca que não
 * ajuda no primeiro instante, que é justamente quando a pessoa ainda não sabe
 * o termo. Sem `filtering`, a lista é o acervo inteiro, agrupado por
 * `groupLabel` ("Esta semana", "Semana passada", o mês) — o mesmo motor que
 * `StudiesBrowser` usa para o agrupamento dele. Ela vira uma segunda forma de
 * navegar o acervo, não só de procurar nele.
 *
 * ## O layout do CELULAR é outro, de propósito
 *
 * No desktop o campo fica no TOPO, como um cmdk comum. No celular ele desce
 * para uma barra FIXA no rodapé — a mesma altura de polegar da
 * `MobileActionBar`, e não por acaso: abrir a busca de dentro da barra de
 * baixo e receber o campo lá em cima faria o dedo atravessar a tela inteira
 * para digitar. Os filtros (autor, local, período) ficam atrás de um botão na
 * própria barra, num painel que sobe por cima dela — o desktop tem vão de
 * sobra para os três sempre visíveis; o celular não.
 *
 * ## No celular ele fecha SEM animação, e isso é o conserto de um defeito
 *
 * Este diálogo abre com o campo já focado, ou seja, com o teclado virtual
 * subindo. Fechá-lo com um fade de saída punha DUAS animações do sistema uma
 * em cima da outra: o painel esmaecendo por ~100ms enquanto o teclado
 * recolhia e o viewport VISUAL voltava ao lugar (o `--kb-inset` caindo de
 * ~300px a 0 quadro a quadro, e o `offsetTop` do iOS junto). O resultado era
 * uma piscada na hora de tocar o "X". Sem quadro intermediário nenhum não há
 * o que piscar — é a mesma escolha do `BibloDock`, que DESMONTA a gaveta ao
 * fechar em vez de animá-la. O desktop, que não tem teclado virtual nem
 * viewport que se mexa, continua com o fade (`md:data-closed:*`).
 *
 * Pelo mesmo motivo a barra de baixo lê `--kb-inset` (`useKeyboardInset`),
 * como toda superfície colada no rodapé deste app: sem isso o campo ficava
 * ATRÁS do teclado que ele mesmo abre, porque o `viewport` do app é o padrão
 * `resizes-visual` e o viewport de LAYOUT não encolhe.
 *
 * ## Montada UMA vez, sempre — mesmo fechada
 *
 * O atalho Ctrl+K/Cmd+K é escutado AQUI DENTRO, e por isso este componente
 * precisa estar montado o tempo todo (`(barra)/layout.tsx`, dentro do
 * `CacheOwner`, onde `useLibrary()` tem dono). `open` vem da
 * `GlobalSearchStore`, e é o que permite à `MobileActionBar` e ao
 * `SearchTrigger` do desktop abrirem O MESMO diálogo sem subir estado até
 * eles.
 *
 * ## ABRIR limpa tudo, e não fechar
 *
 * Um diálogo escondido com filtro ligado é a mesma armadilha da busca antiga:
 * abrir de novo mostraria menos do que a pessoa esperava, pelo motivo errado.
 * Mas a limpeza acontece no efeito de `open: true`, nunca no de `false` — no
 * desktop o diálogo continua MONTADO durante o fade de saída, com `open` já
 * falso, e limpar ali trocaria a lista de conteúdo no meio dele. Pela mesma
 * razão, `filtered` e `useContentSearch` não têm guarda de `open`: eles
 * recalculam livre, e é o EFEITO que decide quando o filtro volta ao zero.
 */

const RANGE_OPTIONS: SelectOption<DateRangeKey>[] = DATE_RANGES.map((r) => ({
  value: r.value,
  label: r.label,
}));

const EMPTY: SessionListItem[] = [];

export function GlobalSearchDialog() {
  const open = useGlobalSearchStore((s) => s.open);
  const setOpen = useGlobalSearchStore((s) => s.setOpen);
  const router = useRouter();
  const inputId = useId();

  const { data } = useLibrary();
  const sessions = data ?? EMPTY;

  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>(FACET_ALL);
  const [location, setLocation] = useState<string>(FACET_ALL);
  const [range, setRange] = useState<DateRangeKey>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  // Só existe no CELULAR: no desktop os três seletores já ficam sempre
  // visíveis, não há painel para abrir. Ver o cabeçalho.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // O teclado virtual, como em toda superfície colada no rodapé deste app
  // (`MobileActionBar`, `BibloDock`, `RecordingNotesDock`…). Sem isto a barra
  // de baixo daqui ficava ATRÁS do teclado — o `viewport` do app é o padrão
  // `resizes-visual`, então o viewport de LAYOUT não encolhe e um
  // `fixed bottom-0` continua colado no fundo da página. Ver
  // `hooks/use-keyboard-inset.ts`.
  useKeyboardInset();

  // Ctrl+K / Cmd+K, em toda tela logada, o tempo todo — este componente nunca
  // desmonta. `toggle`, não só "abrir": apertar de novo com o diálogo já
  // aberto é o mesmo gesto de fechar que a maioria dos apps de comando usa.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!useGlobalSearchStore.getState().open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  // Abrir LIMPA o filtro (ver o cabeçalho) e foca o campo.
  //
  // **A limpeza é no ABRIR, não no fechar.** Era no fechar, e o "X" piscava:
  // `setOpen(false)` já deixa `open` falso no MESMO tique em que o diálogo
  // começa a animação de saída (`data-closed:animate-out`) — ele continua
  // MONTADO enquanto ela roda. Limpando ali, a lista trocava de conteúdo (de
  // "filtrada" para "todo o acervo recente") bem no meio do fade, um quadro
  // visível de conteúdo errado antes de sumir. Limpando só ao ABRIR, o que
  // está na tela nunca muda durante o fechar — ele só desaparece com o que já
  // tinha.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSpeaker(FACET_ALL);
    setLocation(FACET_ALL);
    setRange("all");
    setActiveIndex(0);
    setMobileFiltersOpen(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Sem `open ?` aqui: `query` já só muda ao ABRIR (ver o efeito acima), então
  // passá-lo direto não dispara buscas novas enquanto fechado — e não faz o
  // resultado de conteúdo (`transcriptHits`) sumir no meio do fade de saída.
  const { ids: transcriptHits, pending: searching } = useContentSearch(query);

  // Sem `useMemo`: um `new Date()` por render é barato, e memoizá-lo por
  // `open` deixava o hook de dependências acusando uma dependência "sem uso"
  // (o corpo não LÊ `open`, só precisa recalcular quando ele muda).
  const now = new Date();

  const speakerOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerName)),
    [sessions]
  );
  const locationOptions = useMemo(
    () => facetOptions(sessions.map((s) => s.speakerLocation)),
    [sessions]
  );

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      map.set(s.id, buildHaystack([s.title, s.shortSummary, s.speakerName, s.speakerLocation]));
    }
    return map;
  }, [sessions]);

  const tokens = useMemo(() => searchTokens(query), [query]);

  const filtering =
    query.trim().length > 0 || speaker !== FACET_ALL || location !== FACET_ALL || range !== "all";

  // Sem `open` na guarda: o diálogo fica MONTADO durante a animação de saída
  // (`data-closed:animate-out`), com `open` já falso — filtrar por `open`
  // aqui trocava a lista para vazia no MEIO do fade, o mesmo piscar do reset
  // no fechar (ver o efeito acima). Recalcular é barato, é um filtro sobre o
  // que já está em memória.
  const filtered = useMemo(() => {
    if (!filtering) return EMPTY;
    return sessions.filter((s) => {
      if (speaker !== FACET_ALL && s.speakerName?.trim() !== speaker) return false;
      if (location !== FACET_ALL && s.speakerLocation?.trim() !== location) return false;
      if (!isWithinRange(s.createdAt, range, now)) return false;
      if (tokens.length === 0) return true;
      if (matchesAllTokens(haystacks.get(s.id) ?? "", tokens)) return true;
      return transcriptHits?.has(s.id) ?? false;
    });
  }, [filtering, sessions, speaker, location, range, now, tokens, haystacks, transcriptHits]);

  // Sem filtro nenhum, a lista É o acervo — recente primeiro, agrupado como o
  // `StudiesBrowser` já agrupa a dele. Ver "Sem filtro nenhum..." acima.
  const recentGroups = useMemo(() => {
    if (filtering) return null;
    const out: { label: string; items: SessionListItem[] }[] = [];
    for (const s of sessions) {
      const label = groupLabel(s.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [filtering, sessions, now]);

  // A lista visível NA ORDEM DA TELA, independente de estar agrupada ou não —
  // é sobre ela que o teclado (seta/Enter) navega.
  const visibleItems = filtering ? filtered : sessions;

  function select(id: string) {
    inputRef.current?.blur();
    setOpen(false);
    router.push(`/summary/${id}`);
  }

  // Tirar o FOCO do campo antes de fechar, e não deixar o `DialogPrimitive.Close`
  // fazer isso sozinho. No celular o campo está com o teclado aberto o tempo
  // todo (ver o efeito de abrir), e fechar o diálogo SEM tirar o foco primeiro
  // faz duas animações correrem juntas — o teclado recolhendo (o navegador
  // redimensiona a viewport) e o diálogo desaparecendo — e a corrida entre as
  // duas é a piscada que se via ao tocar o "X". `blur()` primeiro, síncrono,
  // dá ao teclado uma cabeça de saída antes do fade começar.
  function closeSearch() {
    inputRef.current?.blur();
    setOpen(false);
  }

  // O índice ativo acompanha a lista: ela encolhe a cada tecla, e um índice
  // solto apontaria para um cartão que já saiu da vista. Reseta junto de
  // QUALQUER coisa que refaça a lista, direto em quem muda o filtro — e não
  // num `useEffect` à parte, que rodaria um quadro depois.
  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }
  function updateSpeaker(value: string) {
    setSpeaker(value);
    setActiveIndex(0);
  }
  function updateLocation(value: string) {
    setLocation(value);
    setActiveIndex(0);
  }
  function updateRange(value: DateRangeKey) {
    setRange(value);
    setActiveIndex(0);
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(visibleItems.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = visibleItems[activeIndex];
      if (target) select(target.id);
    }
  }

  const visibleFacets = [
    {
      label: "Autor",
      allLabel: "Todos os autores",
      value: speaker,
      options: speakerOptions,
      onChange: updateSpeaker,
    },
    {
      label: "Local",
      allLabel: "Todos os locais",
      value: location,
      options: locationOptions,
      onChange: updateLocation,
    },
  ].filter((f) => f.options.length > 0);

  const activeFilterCount =
    (speaker !== FACET_ALL ? 1 : 0) + (location !== FACET_ALL ? 1 : 0) + (range !== "all" ? 1 : 0);

  const facetSelects = (
    <>
      {visibleFacets.map((facet) => {
        const options: SelectOption[] = [
          { value: FACET_ALL, label: facet.allLabel },
          ...facet.options.map((o) => ({ value: o, label: o })),
        ];
        return (
          <Select
            key={facet.label}
            items={options}
            value={facet.value}
            onValueChange={(v) => facet.onChange(String(v))}
          >
            <SelectTrigger
              size="sm"
              aria-label={facet.label}
              className={cn(
                "w-fit",
                facet.value !== FACET_ALL &&
                  "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      <Select
        items={RANGE_OPTIONS}
        value={range}
        onValueChange={(v) => updateRange(v as DateRangeKey)}
      >
        <SelectTrigger
          size="sm"
          aria-label="Período"
          className={cn(
            "w-fit",
            range !== "all" && "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  // As três telas do vazio/erro/carregando são as mesmas para as duas formas
  // de lista (recente ou filtrada); só o TEXTO muda.
  const emptyBody = searching ? (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Loader2 aria-hidden className="size-6 animate-spin text-v2-ink-mute" />
      <p className="text-[13px] font-medium text-v2-ink">Procurando…</p>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <SearchX aria-hidden className="size-6 text-v2-ink-mute" />
      <p className="text-[13px] font-medium text-v2-ink">
        {filtering ? "Nenhuma gravação com esse recorte." : "Sua Biblioteca ainda está vazia."}
      </p>
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* **O FECHAR do celular não tem animação, e é isso que mata a
            piscada.** Enquanto havia `data-closed:animate-out` aqui, o Base UI
            mantinha o diálogo MONTADO pelos ~100ms do fade — e é exatamente
            nessa janela que o teclado virtual está recolhendo: o viewport
            VISUAL volta ao lugar (o `--kb-inset` cai de ~300px a 0 quadro a
            quadro, e o `offsetTop` do iOS com ele), tudo isso visto ATRAVÉS de
            um painel meio transparente. Duas animações do sistema correndo uma
            por cima da outra é o que se via piscar; sem quadro intermediário
            nenhum, não há o que piscar. É a mesma escolha do `BibloDock`, que
            desmonta a gaveta inteira ao fechar em vez de animá-la.

            No desktop não há teclado virtual nem viewport que se mexa, então
            lá o fade continua — `md:` em cada classe de saída. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 md:data-closed:animate-out md:data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          data-slot="global-search"
          className={cn(
            // `duration-100`, o mesmo de `shared/ui/dialog.tsx` e do backdrop
            // acima: com 150 aqui e 100 lá, o véu sumia 50ms antes do painel e
            // a página aparecia por baixo de um painel ainda meio visível.
            "fixed inset-0 z-50 flex flex-col bg-v2-bg outline-none duration-100",
            "data-open:animate-in data-open:fade-in-0",
            "md:data-closed:animate-out md:data-closed:fade-out-0",
            "md:inset-x-0 md:top-[8vh] md:bottom-auto md:mx-auto md:max-h-[80vh] md:w-full md:max-w-xl md:overflow-hidden md:rounded-2xl md:bg-v2-glass-panel md:bg-[image:var(--v2-glass-sheen)] md:ring-1 md:ring-v2-glass-edge md:backdrop-blur-xl md:data-open:zoom-in-95 md:data-closed:zoom-out-95"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Buscar na biblioteca</DialogPrimitive.Title>

          {/* O TÍTULO, só no celular — a página tem nome próprio, como
              qualquer tela do app; no desktop quem diz isso é o campo, que já
              fica visível assim que o diálogo abre. */}
          <div className="px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 md:hidden">
            <h1 className="font-heading text-[32px] font-bold leading-none text-v2-ink">Buscar</h1>
          </div>

          {/* O campo, no TOPO — só no desktop. No celular ele mora na barra
              fixa do rodapé, ver mais abaixo. */}
          <div className="hidden items-center gap-2 border-v2-card-hover border-b px-4 py-3 md:flex">
            <Search aria-hidden className="size-5 shrink-0 text-v2-ink-mute" strokeWidth={1.75} />
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar por título, autor, local, versículo ou algo dito na pregação"
              aria-label="Buscar na biblioteca"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-v2-ink outline-none placeholder:text-v2-ink-mute"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fechar busca"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink"
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Os filtros, SEMPRE visíveis — só no desktop, que tem vão de
              sobra. No celular eles moram atrás do botão da barra do rodapé. */}
          <div className="hidden flex-wrap items-center gap-2 border-v2-card-hover border-b px-4 py-2.5 md:flex">
            {facetSelects}
            <span className="ml-auto shrink-0 text-[11px] text-v2-ink-mute tabular-nums">
              {searching
                ? "Procurando…"
                : filtering
                  ? resultLabel(filtered.length, sessions.length, ["gravação", "gravações"])
                  : resultLabel(sessions.length, sessions.length, ["gravação", "gravações"])}
            </span>
          </div>

          {/* Os resultados, a única parte que rola. `pb` de baixo sobra para a
              barra fixa do rodapé no celular, e some no desktop, que não tem
              barra nenhuma flutuando por cima da lista. */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(5.5rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))] md:pb-2">
            {visibleItems.length === 0 ? (
              emptyBody
            ) : filtering ? (
              <ul>
                {filtered.map((s, index) => (
                  <ResultRow
                    key={s.id}
                    session={s}
                    now={now}
                    active={index === activeIndex}
                    onSelect={select}
                    onHover={() => setActiveIndex(index)}
                  />
                ))}
              </ul>
            ) : (
              (() => {
                let index = -1;
                return recentGroups?.map((group) => (
                  <section key={group.label} className="flex flex-col gap-1 pb-3">
                    <h2 className="px-3 pt-3 pb-1 text-[12px] font-medium text-v2-ink-mute">
                      {group.label}
                    </h2>
                    <ul>
                      {group.items.map((s) => {
                        index += 1;
                        const itemIndex = index;
                        return (
                          <ResultRow
                            key={s.id}
                            session={s}
                            now={now}
                            active={itemIndex === activeIndex}
                            onSelect={select}
                            onHover={() => setActiveIndex(itemIndex)}
                          />
                        );
                      })}
                    </ul>
                  </section>
                ));
              })()
            )}
          </div>

          {/* A barra FIXA do rodapé — só no celular. Um pill comprido (busca +
              campo + filtros) e um botão redondo separado para fechar, o MESMO
              par-de-formas da `MobileActionBar`. Ver o cabeçalho. */}
          <div
            className={cn(
              // `grid-cols-[minmax(0,1fr)_auto]`, não `flex`: um item de FLEX
              // com `flex-1` ainda usa `min-width: auto` por baixo (o
              // min-content dos FILHOS dele, aqui um `<input>`), e um telefone
              // estreito o suficiente empurrava o botão de fechar para fora da
              // tela. `minmax(0, …)` zera esse mínimo automático de propósito.
              "fixed inset-x-0 bottom-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-4 md:hidden",
              // O MESMO cálculo da `MobileActionBar`: `max()` entre a faixa do
              // gesto do iPhone e a altura do teclado. Com `env()` sozinho o
              // campo ficava atrás do teclado que ele mesmo abre.
              "pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]"
            )}
          >
            {mobileFiltersOpen ? (
              <div className="absolute inset-x-4 bottom-full mb-3 flex flex-col gap-2 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] p-3 ring-1 ring-v2-glass-edge backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-2">{facetSelects}</div>
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] text-v2-ink-mute tabular-nums">
                    {filtering
                      ? resultLabel(filtered.length, sessions.length, ["gravação", "gravações"])
                      : resultLabel(sessions.length, sessions.length, ["gravação", "gravações"])}
                  </span>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateSpeaker(FACET_ALL);
                        updateLocation(FACET_ALL);
                        updateRange("all");
                      }}
                      className="text-[11px] font-semibold text-v2-ink-mute underline-offset-2 hover:text-v2-ink hover:underline"
                    >
                      Limpar filtros
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex h-14 min-w-0 items-center gap-2 rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] px-4 ring-1 ring-v2-glass-edge backdrop-blur-xl">
              <Search aria-hidden className="size-5 shrink-0 text-v2-ink-mute" strokeWidth={1.75} />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Buscar alguma coisa…"
                aria-label="Buscar na biblioteca"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-v2-ink outline-none placeholder:text-v2-ink-mute"
              />
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((v) => !v)}
                aria-label="Filtros"
                aria-expanded={mobileFiltersOpen}
                className={cn(
                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors",
                  mobileFiltersOpen ? "bg-v2-card-hover text-v2-ink" : "hover:bg-v2-card-hover"
                )}
              >
                <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
                {activeFilterCount > 0 ? (
                  <span
                    aria-hidden
                    className="-top-0.5 -right-0.5 absolute inline-flex size-2 rounded-full bg-v2-accent"
                  />
                ) : null}
              </button>
            </div>
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fechar busca"
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150"
            >
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Uma linha de resultado, recente ou filtrada — o mesmo desenho nas duas. */
function ResultRow({
  session: s,
  now,
  active,
  onSelect,
  onHover,
}: {
  session: SessionListItem;
  now: Date;
  active: boolean;
  onSelect: (id: string) => void;
  onHover: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        onMouseEnter={onHover}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
          active ? "bg-v2-card-hover" : "hover:bg-v2-card-hover/60"
        )}
      >
        <SessionModeGlyph mode={s.mode} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-[14px] text-v2-ink">
            {s.title?.trim() || "Sessão sem título"}
          </span>
          <span className="block truncate text-[12px] text-v2-ink-mute">
            {[s.speakerName?.trim(), s.speakerLocation?.trim()].filter(Boolean).join(" · ") ||
              "Sem autor"}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-v2-ink-mute">
          {shortDate(s.createdAt, new Date(s.createdAt).getFullYear() !== now.getFullYear())}
        </span>
      </button>
    </li>
  );
}
