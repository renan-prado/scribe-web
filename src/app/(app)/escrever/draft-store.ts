/**
 * O rascunho do editor de `/escrever`, no aparelho.
 *
 * **Local-first, e não "cache".** O que a pessoa digitou existe aqui antes de
 * existir em qualquer outro lugar: cada tecla cai no IndexedDB, e só depois de
 * uma pausa o texto sobe para o banco. É o mesmo princípio do gravador (ver
 * `recording/capture-store.ts`), pela mesma razão: o trabalho de quem está do
 * outro lado da tela não pode depender de a rede estar boa naquele segundo.
 *
 * É um banco SEPARADO do `scriba-captures`, e isso é decisão. Acrescentar um
 * object store lá obrigaria a subir o `DB_VERSION` daquele banco, disparando um
 * `onupgradeneeded` no navegador de todo mundo que tem áudio pendente
 * guardado, para adicionar uma tabela que a gravação nunca vai ler. Dois
 * assuntos, dois bancos, duas versões que andam sozinhas.
 *
 * `syncedAt` é o que dá sentido a tudo isto. Guardar o texto sem ele
 * responderia "o que foi digitado", mas não "isto já chegou ao banco?", que é
 * a única pergunta que importa quando a pessoa reabre a página: rascunho com
 * `updatedAt > syncedAt` é trabalho que a rede ainda não levou, e é ELE que
 * vence o que o servidor devolveu, não o contrário.
 *
 * Tudo degrada em silêncio (aba anônima, navegador antigo, cota estourada):
 * as funções devolvem `null`/`false` e o editor segue salvando só no servidor.
 * Sem rede de segurança, mas funcionando.
 */

import type { WrittenSummary } from "@/lib/domain/summary";

const DB_NAME = "scriba-drafts";
const STORE = "written";
const DB_VERSION = 1;

/**
 * A chave de um rascunho: o id da sessão, ou `NEW_DRAFT_KEY` enquanto ela não
 * existe. Um texto novo tem de caber no IndexedDB ANTES do primeiro
 * salvamento, que é justamente quando ele ainda não tem id.
 */
export const NEW_DRAFT_KEY = "novo";

export type WrittenDraft = {
  key: string;
  doc: WrittenSummary;
  /** Quando a última tecla caiu aqui. */
  updatedAt: number;
  /** Quando o servidor confirmou o que estava aqui. 0 = nunca. */
  syncedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

export async function readDraft(key: string): Promise<WrittenDraft | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const found = await wrap(db.transaction(STORE, "readonly").objectStore(STORE).get(key));
    return (found as WrittenDraft | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeDraft(draft: WrittenDraft): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    await wrap(db.transaction(STORE, "readwrite").objectStore(STORE).put(draft));
    return true;
  } catch {
    return false;
  }
}

export async function deleteDraft(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await wrap(db.transaction(STORE, "readwrite").objectStore(STORE).delete(key));
  } catch {
    // Rascunho órfão no aparelho não estraga nada; falhar aqui em voz alta,
    // sim, o usuário veria um erro por causa de uma faxina.
  }
}

/**
 * O rascunho sem dono ganha o id que o servidor acabou de dar.
 *
 * Move em vez de copiar, e essa é a parte que importa: um `NEW_DRAFT_KEY`
 * deixado para trás seria carregado na próxima vez que alguém abrisse
 * `/escrever` para começar um texto novo, e a tela nasceria com o texto
 * anterior dentro.
 */
export async function adoptDraft(id: string): Promise<void> {
  const orphan = await readDraft(NEW_DRAFT_KEY);
  if (!orphan) return;
  await writeDraft({ ...orphan, key: id });
  await deleteDraft(NEW_DRAFT_KEY);
}
