"use client";

import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePendingCount } from "@/features/session/capture-queue";
import { FolderGrid } from "@/features/session/components/FolderGrid";
import { LibraryNote } from "@/features/session/components/LibraryNote";
import { PendingCaptures } from "@/features/session/components/PendingCaptures";
import { SessionsEmptyState } from "@/features/session/components/SessionsEmptyState";
import { useFolders } from "@/features/session/folders-query";
import { useLibrary } from "@/features/session/query";
import { FOLDER_ICON_INK, folderCountLabel, folderPath } from "@/lib/domain/folder";
import type { SessionListItem } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { monthGroupLabel } from "../lib/format";

/**
 * A lista da Biblioteca do v2, com a MESMA organização por mês e por pasta do
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
 * ## A busca SAIU daqui — ela é a `GlobalSearchDialog`
 *
 * Esta lista já teve uma barra atrás de uma lupa, com filtro de autor, local e
 * período (`CollectionSearch` + `SearchScope`). Ela foi substituída pela busca
 * GLOBAL (Ctrl+K, e o botão de busca da `MobileActionBar`/`SearchTrigger`),
 * que abre por cima de qualquer tela em vez de exigir estar na Biblioteca
 * primeiro. Este componente voltou a mostrar SEMPRE o acervo inteiro — pastas,
 * pendentes e os meses —, sem estado de "busca aberta" nenhum. Ver
 * `(shell)/components/GlobalSearchDialog.tsx`.
 *
 * ## Por que o "agora" vem do servidor
 *
 * `monthGroupLabel` compara com "agora", e um `new Date()` calculado no
 * cliente pode cair do outro lado da meia-noite em relação ao HTML que o
 * servidor mandou. O React descartaria a marcação por divergência de
 * hidratação, a página inteira, por causa de um rótulo.
 *
 * ## Uma vista só: o mural de post-its
 *
 * Já existiram mais duas — a LISTA (varredura: uma linha por sermão, com o
 * trecho) e a GRADE (cartões iguais, cinza, na ordem cronológica linha a
 * linha) —, escolhidas por um seletor que ficava acima dos meses
 * (`LibraryViewToggle`, guardado por aparelho em `localStorage`). Elas saíram:
 * o mural é o desenho do produto, e as outras duas eram a resposta a "quem tem
 * duzentos sermões e está procurando um" — problema que a busca global já
 * resolve sem pedir que a pessoa escolha entre três layouts antes de ver o
 * próprio acervo. `LibraryCard`, `LibraryRow` e `library-view.ts` foram junto;
 * `LibraryNote` é o único cartão de sessão que resta.
 *
 * **O agrupamento por mês continua contendo a bagunça de ordem do masonry.**
 * Sem ele o mural inteiro seria uma coluna-a-coluna só, e a pessoa perderia a
 * âncora temporal de um acervo longo.
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

  // A PASTA aberta, lida da URL (`?folder=<id>`).
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedFolderId = searchParams.get("folder");
  const { data: folders } = useFolders();
  const selectedFolder = folders?.find((f) => f.id === selectedFolderId) ?? null;
  // O caminho da raiz até a pasta aberta ("2026 › Romanos"), que é a migalha
  // de pão. Ela é a ÚNICA navegação da árvore: com o teto de três níveis o
  // caminho inteiro cabe numa linha, e por isso não existe painel de árvore
  // recolhível em lugar nenhum — ver o cabeçalho de `FolderGrid`.
  const folderTrail = useMemo(
    () => folderPath(folders ?? [], selectedFolderId),
    [folders, selectedFolderId]
  );
  const hasSubfolders = (folders ?? []).some((f) => f.parentId === selectedFolderId);
  const selectFolder = useCallback(
    (id: string | null) => {
      router.push(id ? `/home?folder=${id}` : "/home");
    },
    [router]
  );

  // O acervo dentro da pasta aberta, ou tudo — é sobre ISTO que o agrupamento
  // por mês roda a seguir.
  const sessionsInFolder = useMemo(
    () => (selectedFolderId ? sessions.filter((s) => s.folderId === selectedFolderId) : sessions),
    [sessions, selectedFolderId]
  );

  // As gravações guardadas no aparelho que ainda não viraram resumo. Elas não
  // vêm da lista do servidor (não existem lá), e é por isso que a conta delas
  // é lida à parte: sem ela, a Biblioteca de quem só tem uma gravação
  // pendente anunciaria "grave a primeira" com a gravação bem ali em cima.
  const pendingCount = usePendingCount();

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const groups = useMemo(() => {
    const out: { label: string; items: SessionListItem[] }[] = [];
    for (const s of sessionsInFolder) {
      const label = monthGroupLabel(s.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [sessionsInFolder, now]);

  return (
    <div className="flex flex-col gap-6">
      {/* O TÍTULO da pasta aberta, com a migalha de pão acima dele. Ele existe
          porque o nome da tela mora na barra do topo, e lá ele é "Biblioteca"
          em toda navegação — entrar numa pasta mudava o conteúdo inteiro da
          página e nada além de uma linha de 13px dizia onde a pessoa estava.
          A barra não pode dizer isso: ela é do LAYOUT do segmento e sobrevive
          à navegação, e a pasta aberta vem de um `searchParams` que só a
          página lê (ver `src/app/AGENTS.md`).

          A migalha NAVEGA e o título INFORMA, e é essa divisão que impede os
          dois de serem a mesma coisa duas vezes: o último degrau da migalha
          não é botão justamente porque ele é o título logo abaixo.

          Na raiz não há título nenhum — "Biblioteca" já está na barra, e
          repeti-lo aqui empurraria os cartões para baixo da dobra para dizer o
          que já estava dito. */}
      {folderTrail.length === 0 ? null : (
        <header className="flex flex-col gap-1.5">
          <nav
            aria-label="Você está em"
            className="flex flex-wrap items-center gap-1 px-1 text-[13px]"
          >
            <button
              type="button"
              onClick={() => selectFolder(null)}
              className="rounded-md font-light text-v2-ink-mute outline-none transition-colors hover:text-v2-ink focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Biblioteca
            </button>
            {folderTrail.map((folder, index) => (
              <Fragment key={folder.id}>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-v2-ink-mute" />
                {index === folderTrail.length - 1 ? (
                  <span className="font-medium text-v2-ink">{folder.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectFolder(folder.id)}
                    className="rounded-md font-light text-v2-ink-mute outline-none transition-colors hover:text-v2-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {folder.name}
                  </button>
                )}
              </Fragment>
            ))}
          </nav>
          <h1 className="flex min-w-0 items-center gap-2 px-1">
            <FolderIcon
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "size-5 shrink-0",
                FOLDER_ICON_INK[folderTrail[folderTrail.length - 1].color ?? "mist"]
              )}
            />
            <span className="truncate font-heading text-xl font-semibold leading-tight tracking-tight text-v2-ink sm:text-2xl">
              {folderTrail[folderTrail.length - 1].name}
            </span>
            <span className="shrink-0 text-[12px] font-light text-v2-ink-mute">
              {folderCountLabel(
                (folders ?? []).filter((f) => f.parentId === selectedFolderId).length,
                sessionsInFolder.length
              )}
            </span>
          </h1>
        </header>
      )}

      {/* O que está guardado no aparelho e ainda não subiu, antes dos meses. */}
      <PendingCaptures now={now} />

      {/* As pastas DESTE nível: as de raiz na Biblioteca, as filhas dentro de
          uma pasta aberta.

          Estiveram ACIMA do mural por uma versão, quando ainda existia um
          seletor de vista que precisava de uma seção fora do alcance dele
          (uma pasta não tem post-it). O seletor saiu, e a pergunta que
          continua valendo é a mesma de antes dele existir: a primeira coisa da
          primeira tela do app é o ACERVO, não a organização dele — daí as
          pastas ficarem abaixo do bloco de pendentes e acima dos meses, nunca
          no topo da página. */}
      <FolderGrid
        parentId={selectedFolderId}
        selectedFolderId={selectedFolderId}
        onSelect={selectFolder}
        sessions={sessions}
      />

      {loading ? (
        /* Cache vazio e resposta a caminho: a primeira visita num aparelho
           novo, e o único momento em que esta tela não tem o que desenhar.
           (É também o quadro que antecede a hidratação, ver `hydrated`.)
           Nunca o `SessionsEmptyState` aqui — ele diz "grave a primeira", e
           dizer isso a quem tem trinta sermões guardados é a tela mentindo
           por meio segundo. Ver `useLibrary`. */
        <LibrarySkeleton />
      ) : groups.length === 0 && selectedFolder && !hasSubfolders ? (
        /* Uma pasta vazia não é a Biblioteca vazia: a pessoa já tem acervo,
           só não pôs nada AQUI ainda. "Grave a primeira gravação" seria a
           tela ignorando as sessões que existem fora desta pasta.

           E uma pasta COM subpastas não está vazia: o `!hasSubfolders` é o que
           impede este bloco de aparecer embaixo da grade de filhas, dizendo
           que não há nada num lugar onde acabou de haver. */
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-v2-card-hover px-6 py-12 text-center">
          <p className="text-sm font-medium text-v2-ink">Esta pasta está vazia.</p>
          <p className="max-w-sm text-[13px] font-light leading-relaxed text-v2-ink-soft">
            Crie uma subpasta acima, arraste um cartão da Biblioteca até “{selectedFolder.name}”, ou
            abra um resumo e use “Mover para pasta”.
          </p>
        </div>
      ) : groups.length === 0 && !selectedFolder && pendingCount === 0 ? (
        /* Biblioteca vazia é a primeira tela de quem acabou de entrar. Ver
           `SessionsEmptyState`.

           `pendingCount` é a segunda situação, e ela some se não for dita:
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
            <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4">
              {group.items.map((s) => (
                <LibraryNote key={s.id} session={s} now={now} buildHref={v2Href} />
              ))}
            </ul>
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
