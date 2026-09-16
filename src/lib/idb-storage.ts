/**
 * Um `AsyncStorage` de três métodos sobre o IndexedDB, para o persistidor do
 * TanStack Query (ver `shared/components/Providers.tsx`).
 *
 * ## Por que não `localStorage`
 *
 * O persistidor grava o cache inteiro a cada mudança (com um respiro de 1s).
 * Com a Biblioteca e os resumos dentro, isso são algumas centenas de KB de
 * `JSON.stringify` — e `localStorage` é SÍNCRONO: essa serialização aconteceria
 * na thread principal, travando o toque seguinte, justamente no app que a gente
 * está tentando deixar instantâneo. O IndexedDB grava fora do caminho.
 *
 * Também não há o teto de 5MB, que a Biblioteca de quem usa o Scriba há um ano
 * encostaria.
 *
 * ## Por que escrito à mão, e não `idb-keyval`
 *
 * São três métodos e um `objectStore`. A dependência traria transações,
 * cursores e um punhado de coisas que não usamos, para poupar as quarenta
 * linhas abaixo.
 *
 * ## O que ele faz quando o IndexedDB não responde
 *
 * Devolve `null` e engole a escrita. Acontece em aba anônima de alguns
 * navegadores e em WebView com armazenamento bloqueado; o resultado é o app
 * sem cache persistido — mais lento, nunca quebrado. Nenhum caminho aqui
 * rejeita uma promessa, de propósito: o persistidor não tem o que fazer com um
 * erro de armazenamento, e um `unhandledrejection` no boot do app é pior que a
 * lentidão que ele denunciaria.
 */

const DB_NAME = "scriba";
const STORE = "query-cache";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Outra aba pediu uma versão nova do banco e esta segura a antiga. Soltar é
    // melhor que travar as duas: esta aba fica sem cache até recarregar.
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const request = work(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export const idbStorage = {
  getItem: (key: string) => run<string>("readonly", (store) => store.get(key)),
  setItem: (key: string, value: string) =>
    run("readwrite", (store) => store.put(value, key)).then(() => undefined),
  removeItem: (key: string) => run("readwrite", (store) => store.delete(key)).then(() => undefined),
};
