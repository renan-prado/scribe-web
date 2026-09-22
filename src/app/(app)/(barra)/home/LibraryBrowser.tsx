"use client";

import { ChevronRight, Loader2, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePendingCount } from "@/features/session/capture-queue";
import { CollectionSearch, FACET_ALL } from "@/features/session/components/CollectionSearch";
import { FolderChips } from "@/features/session/components/FolderChips";
import { LibraryCard } from "@/features/session/components/LibraryCard";
import { LibraryNote } from "@/features/session/components/LibraryNote";
import { LibraryRow } from "@/features/session/components/LibraryRow";
import { LibraryViewToggle } from "@/features/session/components/LibraryViewToggle";
import { PendingCaptures } from "@/features/session/components/PendingCaptures";
import { SessionsEmptyState } from "@/features/session/components/SessionsEmptyState";
import { useFolders } from "@/features/session/folders-query";
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
import { useLibraryView } from "@/features/session/library-view";
import { useLibrary } from "@/features/session/query";
import type { SessionListItem } from "@/lib/domain/session";
import { useSearchScope } from "../components/SearchScope";
import { monthGroupLabel } from "../lib/format";

/**
 * A lista da Biblioteca do v2, com a mesma busca e os mesmos filtros do
 * `/recordings`.
 *
 * ## De onde vêm as sessões, e por que mudou
 *
 * Do CACHE DO APARELHO (`useLibrary`), não mais de uma prop do servidor. A
 * lista era buscada no render de `/home`, o que significava refazer a consulta
 * a cada abertura do app e a cada volta para cá, com a tela em esqueleto até a
 * resposta chegar — e num WebView, que o sistema mata a toda hora, "a cada
 * abertura" é o tempo todo. Agora ela é lida do IndexedDB no primeiro quadro e
 * revalidada atrás (ver `features/session/query.ts`).
 *
 * **O que se paga por isso:** a PRIMEIRA visita de todas, num aparelho sem
 * cache, ganhou uma ida à rede — antes o HTML já vinha com a lista dentro. É a
 * troca que define local-first, e ela compensa porque a primeira visita
 * acontece uma vez e as outras acontecem todos os dias.
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
 * ## A busca alcança MAIS do que o cartão mostra
 *
 * Ela procura em título, resumo curto, autor e local, e ainda na TRANSCRIÇÃO —
 * essa última metade vem de `/api/sessions/search` por `useContentSearch` e
 * entra como união. O post-it (ver `LibraryNote`) mostra três dessas coisas:
 * autor, título e data.
 *
 * ## Três vistas, e a escolha é do APARELHO
 *
 * O mural de post-its continua o padrão e continua sendo o desenho do produto.
 * Ao lado dele há a LISTA (varredura: uma linha por sermão, com o trecho) e a
 * GRADE (cartões iguais, cinza, na ordem cronológica linha a linha). O mural
 * ganha de quem tem vinte sermões e olha a parede inteira; as outras duas
 * ganham de quem tem duzentos e está procurando um. A escolha fica no
 * `localStorage`, ver `features/session/library-view.ts`.
 *
 * **O agrupamento por mês vale para as três.** Ele é o que contém a bagunça de
 * ordem do masonry, e nas outras duas ele continua sendo a única âncora
 * temporal de uma lista longa.
 *
 * **Isso é desalinhamento de propósito, e não um descuido a corrigir.** Uma
 * busca limitada ao que cabe num post-it de 150px seria uma busca inútil; um
 * cartão que exibisse tudo que a busca alcança seria o cartão antigo de volta.
 * O preço é um resultado que aparece sem dizer por quê — as pastilhas de "casou
 * pelo versículo" e "trecho na transcrição", que o `SessionCard` tinha, saíram
 * com ele. Se a pergunta "por que este cartão está aqui?" voltar a incomodar,
 * a resposta é uma pastilha no cartão do RESULTADO, não o resumo de volta em
 * todos eles.
 */
type Props = {
  nowIso: string;
};

/** Toda sessão salva abre no resumo. */
function v2Href(id: string): string {
  return `/summary/${id}`;
}

/** As alturas dos ossos do mural. Todas DIFERENTES, e não por acaso: o mural é
 *  masonry, e seis blocos de mesma altura anunciariam uma grade que não vai
 *  aparecer. Serem únicas também as torna chave. */
const BONE_HEIGHTS = [28, 36, 24, 32, 26, 34];

/** Uma referência estável para o caso "ainda não sei": um `[]` novo a cada
 *  render invalidaria todos os `useMemo` abaixo a cada quadro. */
const EMPTY: SessionListItem[] = [];

export function LibraryBrowser({ nowIso }: Props) {
  const { data, isPending } = useLibrary();
  /**
   * O primeiro render do cliente desenha o que o SERVIDOR mandou, e só o
   * seguinte olha o cache do aparelho.
   *
   * O HTML do servidor nunca tem a lista — o acervo é do aparelho, ele não
   * chega lá. E esta árvore hidrata TARDE: o `loading.tsx` a põe dentro de um
   * `<Suspense>`, e o React hidrata boundary por boundary, então a restauração
   * do IndexedDB (que roda num efeito do provider, lá em cima) pode terminar
   * ANTES. Quando termina, o primeiro render daqui já tem os cartões, onde o
   * servidor tinha posto o esqueleto: mismatch de hidratação, a árvore inteira
   * descartada e refeita, com um erro recuperável no console.
   *
   * O booleano custa UM QUADRO e nenhuma ida à rede — o efeito roda logo após
   * a hidratação, e o mural pinta do disco em seguida, que é a promessa do
   * local-first. Era esse mesmo render que o React já estava fazendo, só que
   * por cima de um erro.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // `undefined` é "ainda não sei" (cache vazio, primeira visita); a lista vazia
  // é um fato. Os dois desenham coisas diferentes lá embaixo, e confundi-los
  // faria a tela anunciar "Biblioteca vazia" a quem tem trinta sermões.
  const sessions = hydrated ? (data ?? EMPTY) : EMPTY;
  const loading = !hydrated || isPending;

  // A PASTA aberta, lida da URL (`?pasta=<id>`) como o `?busca=1` da própria
  // busca — mesmo desenho de `LibrarySearchScope`. `useSearchParams` num
  // client component não força nada a dinâmico, a lupa já faz isto aqui do
  // lado de dentro.
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedFolderId = searchParams.get("pasta");
  const { data: folders } = useFolders();
  const selectedFolder = folders?.find((f) => f.id === selectedFolderId) ?? null;
  const selectFolder = useCallback(
    (id: string | null) => {
      router.push(id ? `/home?pasta=${id}` : "/home");
    },
    [router]
  );

  // O acervo dentro da pasta aberta, ou tudo — é sobre ISTO que a busca, as
  // opções de autor/local e o agrupamento por mês rodam a seguir. Filtrar
  // ANTES faz a busca dentro de uma pasta procurar só ali dentro, do mesmo
  // jeito que a busca da Biblioteca inteira já procura só no que está
  // carregado.
  const sessionsInFolder = useMemo(
    () => (selectedFolderId ? sessions.filter((s) => s.folderId === selectedFolderId) : sessions),
    [sessions, selectedFolderId]
  );

  const [view, setView] = useLibraryView();
  const { open, setOpen } = useSearchScope();
  // As gravações guardadas no aparelho que ainda não viraram resumo. Elas não
  // vêm da lista do servidor (não existem lá), e é por isso que a conta delas
  // é lida à parte: sem ela, a Biblioteca de quem só tem uma gravação
  // pendente anunciaria "grave a primeira" com a gravação bem ali em cima.
  const pendingCount = usePendingCount();
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string>(FACET_ALL);
  const [location, setLocation] = useState<string>(FACET_ALL);
  const [range, setRange] = useState<DateRangeKey>("all");

  const { ids: transcriptHits, pending: searching } = useContentSearch(open ? query : "");

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const speakerOptions = useMemo(
    () => facetOptions(sessionsInFolder.map((s) => s.speakerName)),
    [sessionsInFolder]
  );
  const locationOptions = useMemo(
    () => facetOptions(sessionsInFolder.map((s) => s.speakerLocation)),
    [sessionsInFolder]
  );

  // O palheiro é montado UMA vez por lista, não uma por tecla: normalizar
  // acento de algumas centenas de cartões a cada caractere digitado é o tipo de
  // trabalho que só aparece no aparelho de quem tem muitas gravações.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessionsInFolder) {
      map.set(s.id, buildHaystack([s.title, s.shortSummary, s.speakerName, s.speakerLocation]));
    }
    return map;
  }, [sessionsInFolder]);

  const tokens = useMemo(() => searchTokens(open ? query : ""), [open, query]);

  const filtered = useMemo(() => {
    // Com a barra fechada não há filtro nenhum para aplicar, e passar a lista
    // inteira pelo funil seria trabalho para devolvê-la igual.
    if (!open) return sessionsInFolder;
    return sessionsInFolder.filter((s) => {
      if (speaker !== FACET_ALL && s.speakerName?.trim() !== speaker) return false;
      if (location !== FACET_ALL && s.speakerLocation?.trim() !== location) return false;
      if (!isWithinRange(s.createdAt, range, now)) return false;
      if (tokens.length === 0) return true;
      if (matchesAllTokens(haystacks.get(s.id) ?? "", tokens)) return true;
      return transcriptHits?.has(s.id) ?? false;
    });
  }, [open, sessionsInFolder, speaker, location, range, now, tokens, haystacks, transcriptHits]);

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
      {/* As pastas, e o "Biblioteca > <pasta>" de quem está dentro de uma.
          Fora da busca, pelo mesmo motivo de `PendingCaptures` logo abaixo:
          a barra de busca já é um funil sobre o acervo, e pastas são outro —
          dois funis abertos ao mesmo tempo confundem mais do que ajudam. Quem
          quer procurar DENTRO de uma pasta entra nela primeiro. */}
      {open ? null : (
        <div className="flex flex-col gap-3">
          {selectedFolder ? (
            <nav aria-label="Você está em" className="flex items-center gap-1 px-1 text-[13px]">
              <button
                type="button"
                onClick={() => selectFolder(null)}
                className="rounded-md font-light text-v2-ink-mute outline-none transition-colors hover:text-v2-ink focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Biblioteca
              </button>
              <ChevronRight aria-hidden className="size-3.5 text-v2-ink-mute" />
              <span className="font-medium text-v2-ink">{selectedFolder.name}</span>
            </nav>
          ) : null}
          <FolderChips
            selectedFolderId={selectedFolderId}
            onSelect={selectFolder}
            sessions={sessions}
          />
        </div>
      )}

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
              : resultLabel(filtered.length, sessionsInFolder.length, ["gravação", "gravações"])
          }
          filtering={filtering}
          onClear={clearAll}
        />
      ) : null}

      {/* O que está guardado no aparelho e ainda não subiu, antes dos meses.
          Fora da busca: ver `PendingCaptures`. */}
      {open ? null : <PendingCaptures now={now} />}

      {/* O seletor de vista, alinhado à direita e acima do primeiro mês.

          Ele só aparece quando há acervo desenhado: sobre o estado vazio ele
          ofereceria três maneiras de olhar para nada, e sobre o esqueleto
          seria um controle vivo em cima de uma tela que ainda não existe. E
          ele fica FORA das seções de mês — a escolha vale para a Biblioteca
          inteira, e repeti-lo em cada mês sugeriria o contrário. */}
      {!loading && groups.length > 0 ? (
        <div className="-mb-2 flex justify-end px-1">
          <LibraryViewToggle value={view} onChange={setView} />
        </div>
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
      ) : loading ? (
        /* Cache vazio e resposta a caminho: a primeira visita num aparelho
           novo, e o único momento em que esta tela não tem o que desenhar.
           (É também o quadro que antecede a hidratação, ver `hydrated`.)
           Nunca o `SessionsEmptyState` aqui — ele diz "grave a primeira", e
           dizer isso a quem tem trinta sermões guardados é a tela mentindo
           por meio segundo. Ver `useLibrary`. */
        <LibrarySkeleton />
      ) : groups.length === 0 && selectedFolder ? (
        /* Uma pasta vazia não é a Biblioteca vazia: a pessoa já tem acervo,
           só não pôs nada AQUI ainda. "Grave a primeira gravação" seria a
           tela ignorando as sessões que existem fora desta pasta. */
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-v2-card-hover px-6 py-12 text-center">
          <p className="text-sm font-medium text-v2-ink">Esta pasta está vazia.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-v2-ink-soft">
            Arraste um cartão até “{selectedFolder.name}” na fileira acima, ou mova uma sessão pelo
            menu dela.
          </p>
        </div>
      ) : groups.length === 0 && pendingCount === 0 ? (
        /* Biblioteca vazia é a primeira tela de quem acabou de entrar, e é
           diferente de busca sem resultado (acima): ali a saída é limpar o
           filtro, aqui é gravar. Ver `SessionsEmptyState`.

           `pendingCount` é a terceira situação, e ela some se não for dita:
           acervo vazio COM uma gravação esperando na fila logo acima. "Grave a
           primeira" ali é a tela ignorando o sermão que a pessoa acabou de
           gravar e está vendo na mesma dobra. */
        <SessionsEmptyState />
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-3">
            {/* `font-medium` e não `font-semibold`: o título dos post-its é
                regular (ver `LibraryNote`), e um cabeçalho de mês em negrito
                pesaria mais que os próprios cartões que ele anuncia. */}
            <h2 className="px-1 text-[15px] font-medium text-v2-ink-soft">{group.label}</h2>
            {/* MASONRY por colunas de CSS: altura livre por cartão, que é o
                escalonamento de mural que a pele pede. O
                espaço vertical sai do `mb-4` de cada `<li>`, porque `gap` em
                contexto de colunas só vale ENTRE as colunas — e os dois números
                andam juntos, senão o mural tem vão maior num eixo que no outro.

                **A ordem de leitura é coluna-a-coluna**, e isso é consciente:
                o segundo sermão mais recente cai ABAIXO do primeiro, não ao
                lado. Trocar por um grid preservaria a cronologia e perderia o
                escalonamento, e o escalonamento é o desenho. O agrupamento por
                mês contém o estrago: a bagunça de ordem nunca atravessa a
                fronteira de um bloco.

                **O NÚMERO de colunas cresce com a tela**, e é o que segura o
                teto de 1024px da página (ver `home/page.tsx`): duas colunas
                numa coluna de 992px dariam post-its de meia tela, que é o mesmo
                cartão esticado de sempre num tamanho menor. Nos três degraus o
                post-it fica na mesma faixa de largura — ~230 a ~300px —, que é
                o tamanho em que autor, título e data cabem em poucas linhas.
                Ele acompanha os degraus do CONTEÚDO, não os do container: em
                `lg` a coluna já bateu o teto e é a única largura em que quatro
                cabem. */}
            {view === "list" ? (
              /* A LISTA: uma linha por sermão, do mesmo tamanho, na ordem
                 exata. Sem `columns`, sem `grid` — a pilha é o desenho. */
              <ul className="flex flex-col">
                {group.items.map((s) => (
                  <LibraryRow key={s.id} session={s} now={now} buildHref={v2Href} />
                ))}
              </ul>
            ) : view === "card" ? (
              /* A GRADE: `items-stretch` (o padrão do grid) mais `h-full` no
                 cartão é o que dá a TODOS a altura da fileira, e é isso que
                 separa esta vista do mural. `auto-rows-fr` para que fileiras
                 diferentes também tenham a mesma altura entre si. */
              <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((s) => (
                  <LibraryCard key={s.id} session={s} now={now} buildHref={v2Href} />
                ))}
              </ul>
            ) : (
              <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4">
                {group.items.map((s) => (
                  <LibraryNote key={s.id} session={s} now={now} buildHref={v2Href} />
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}

/**
 * O esqueleto do mural, para o único momento em que ele não tem o que desenhar:
 * a primeira visita num aparelho sem cache.
 *
 * Ele repete a anatomia do post-it — moldura do autor, título, rodapé — e não
 * um retângulo qualquer: um esqueleto sem a forma do que vem produz um pulo de
 * layout na troca. Alturas diferentes por cartão porque o mural é masonry (ver
 * `BONE_HEIGHTS`).
 *
 * **É o MESMO desenho do `home/loading.tsx`**, que importa esta função. As duas
 * esperas são diferentes — lá o servidor monta a página, aqui a rede traz a
 * lista — mas acontecem uma atrás da outra, e dois esqueletos de anatomias
 * diferentes em sequência leem como a tela se refazendo duas vezes.
 */
export function LibrarySkeleton() {
  return (
    <section aria-hidden className="flex flex-col gap-3">
      <div className="ml-1 h-4 w-24 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft" />
      <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {BONE_HEIGHTS.map((height) => (
          <li
            key={height}
            className="mb-4 break-inside-avoid rounded-2xl bg-scriba-hairline-soft/40 p-4"
          >
            <div className="h-3 w-20 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft" />
            <div
              className="mt-3 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft"
              style={{ height: `${height}px` }}
            />
            <div className="mt-4 h-3 w-16 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft" />
          </li>
        ))}
      </ul>
    </section>
  );
}
