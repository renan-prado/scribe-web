"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, isServer, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { APP_VERSION } from "@/lib/app-version";
import { idbStorage } from "@/lib/idb-storage";

/**
 * Quanto tempo uma entrada do cache pode ficar sem uso antes de ser recolhida.
 *
 * O padrão do TanStack são 5 minutos, e ele é bom para cache de memória: nada
 * se perde, porque a página seguinte busca de novo. Aqui é o contrário — o que
 * o coletor recolhe não é recolhido só da memória, é o que DEIXA DE SER GRAVADO
 * no disco, e com isso a Biblioteca voltaria a abrir vazia depois de cinco
 * minutos fora do app. Uma semana é o horizonte de quem usa o Scriba de domingo
 * a domingo.
 */
const GC_TIME = 7 * 24 * 60 * 60 * 1000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Bible verses and other refs are effectively immutable per
        // (reference, translation), no need to refetch on window focus.
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        gcTime: GC_TIME,
        // Ver `NETWORK_MODE`.
        networkMode: NETWORK_MODE,
      },
      mutations: {
        networkMode: NETWORK_MODE,
      },
    },
  });
}

/**
 * Sem rede, o cache do disco RESPONDE em vez de a tela ficar esperando.
 *
 * O padrão do TanStack v5 é `"online"`: sem conexão, toda query entra em
 * `paused` e nunca chega a rodar. Isso é o certo para um app que só existe
 * ligado, e é o errado aqui — a Biblioteca, a conversa do Biblo e o texto
 * bíblico moram no IndexedDB justamente para a tela nascer pronta antes de
 * qualquer rede. Em `paused`, o dado do disco continua sendo entregue, mas a
 * query fica marcada como uma espera que não vai terminar, e quem lê `isPending`
 * para desenhar esqueleto desenha um esqueleto eterno.
 *
 * `"offlineFirst"` faz o contrário: ela TENTA uma vez, falha rápido, e o que
 * fica na tela é o que veio do disco. É a mesma escolha que o resto do produto
 * já fazia à mão em três lugares — `navigator.onLine` é dica, nunca decisão
 * (ver `use-network-status.ts`) —, agora dita uma vez para todas as queries.
 *
 * Nas MUTAÇÕES ele vale por outra razão. O padrão pausa a mutação offline e a
 * reenvia sozinho ao reconectar, que é uma fila de escrita de graça; mas este
 * produto não escreve por `useMutation` — o editor tem o próprio salvamento
 * local-first (`useWrittenDraft`) e a gravação tem a própria fila
 * (`features/session/capture-queue.ts`), as duas guardando no IndexedDB antes
 * de tentar a rede. Duas filas com regras diferentes sobre o mesmo trabalho é
 * uma delas estar errada, então aqui a mutação segue o mesmo princípio das
 * queries: tenta, falha depressa, e quem tem trabalho a guardar já o guardou.
 */
const NETWORK_MODE = "offlineFirst" as const;

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/**
 * O persistidor. `undefined` no servidor, onde não há armazenamento nenhum e
 * `createAsyncStoragePersister` não teria o que fazer.
 */
const persister = isServer
  ? undefined
  : createAsyncStoragePersister({
      storage: idbStorage,
      key: "scriba-query-cache",
      // O respiro entre uma mudança do cache e a gravação. O padrão é 1s; aqui
      // a gravação é assíncrona e sai do caminho, mas juntar as rajadas de uma
      // revalidação continua valendo.
      throttleTime: 1000,
    });

/**
 * O cache do TanStack Query, e agora ele SOBREVIVE ao fechamento do app.
 *
 * ## Por que persistir
 *
 * Toda tela do Scriba nascia do zero: abrir o app era esperar o servidor
 * responder antes de ver qualquer coisa, e num WebView que o Android mata a
 * cada troca de app isso acontece o dia inteiro. Com o cache no IndexedDB (ver
 * `lib/idb-storage.ts`), a Biblioteca desenha do disco no primeiro quadro e a
 * rede só confirma atrás.
 *
 * O `PersistQueryClientProvider` é quem sabe a ordem certa: ele restaura o
 * disco ANTES de deixar as queries rodarem, então não existe o instante em que
 * a tela busca do servidor algo que já estava guardado.
 *
 * ## `buster`: por que a versão do app
 *
 * O que está no disco foi serializado pelo código de ONTEM. Uma mudança no
 * formato de `SessionListItem` encontraria, no aparelho de quem não recarregou,
 * objetos com o formato antigo — e o sintoma não seria um erro, seria um cartão
 * sem título. Com a versão no `buster`, todo deploy descarta o que a versão
 * anterior gravou. É o mesmo número que carimba as chamadas de LLM, então ele
 * sobe em todo release (ver `docs/versionamento.md`).
 *
 * ## O que NÃO está resolvido aqui
 *
 * O cache é do APARELHO. Quem escopa por CONTA é a chave de cada query (ver
 * `features/session/query.ts`), e quem apaga o cache do dono anterior quando
 * outro entra é o `CacheOwnerGuard`. Este arquivo não sabe quem está logado, e
 * não deve saber: ele envolve a landing page também, que é estática.
 */
/**
 * O que vai para o DISCO, e o que é só de memória.
 *
 * O padrão do persistidor é guardar toda query bem-sucedida, e é o certo para
 * quase tudo daqui: a Biblioteca, a conversa do Biblo e o texto bíblico existem
 * no disco justamente para a tela nascer pronta antes de qualquer rede.
 *
 * **A exceção é o dado que o SERVIDOR já manda dentro do HTML.** Guardá-lo é um
 * empate na melhor das hipóteses (não há espera a economizar, ele chega junto
 * com a página) e uma inversão na pior: ao restaurar, o valor do disco vence o
 * `initialData` que acabou de vir fresco do servidor, e a tela passa a mostrar
 * a versão de ontem DEPOIS de já ter pintado a de hoje. Foi o que quase
 * aconteceu com o índice do léxico, onde o efeito seria perverso — recarregar a
 * página, que é o gesto de quem quer ver o conteúdo novo, passaria a devolver o
 * antigo.
 *
 * `meta: { persist: false }` é a marca, e ela é um MECANISMO e não um caso
 * especial: qualquer query semeada por `initialData` do servidor pode usá-la.
 */
function shouldPersist(query: Parameters<typeof defaultShouldDehydrateQuery>[0]): boolean {
  if (query.meta?.persist === false) return false;
  return defaultShouldDehydrateQuery(query);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        // `persister` só é `undefined` no servidor, onde este provider nem
        // chega a restaurar nada.
        persister: persister as NonNullable<typeof persister>,
        maxAge: GC_TIME,
        buster: APP_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </PersistQueryClientProvider>
  );
}
