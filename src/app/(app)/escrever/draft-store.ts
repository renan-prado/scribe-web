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
 * **A chave é o id da sessão, e ele nasce AQUI**, não no servidor: ver
 * `newDraftId`. Enquanto o id vinha do primeiro salvamento, um rascunho que
 * nunca subiu ficava guardado sob uma chave fixa e voltava à tela na próxima
 * folha em branco, no lugar de nada.
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
 * O id de um texto novo, sorteado no APARELHO quando a folha em branco abre.
 *
 * Isto já foi uma chave fixa, `"novo"`, porque a sessão só ganhava id no
 * primeiro salvamento. A chave fixa tem um defeito que só aparece quando o
 * salvamento FALHA: o rascunho fica guardado sob ela, e o próximo "Escrever"
 * — que é a pessoa querendo uma folha em branco — abre com o texto anterior
 * dentro. Foi exatamente o que aconteceu em produção, e do lado de cá da tela
 * é indistinguível de "o app perdeu o meu texto e me devolveu outro".
 *
 * Com um id por folha, cada "Escrever" é um documento, o rascunho local e a
 * linha do banco compartilham a MESMA chave desde o primeiro caractere, e a
 * URL (`/escrever/<id>`) passa a existir antes de qualquer rede — é a mesma
 * decisão do gravador, que cria a linha antes do primeiro segundo de áudio.
 *
 * `randomUUID` só existe em contexto seguro (https e localhost). O reserva não
 * é preciosismo: sem ele, um navegador servindo por http devolveria
 * `undefined` e a chave do rascunho viraria a string "undefined" para todo
 * mundo. Ele monta um UUID v4 de verdade, que é o que o Zod da rota exige.
 */
export function newDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Os dois carimbos que fazem dele um v4: versão no 6º byte, variante no 8º.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type WrittenDraft = {
  /** O id da sessão — o mesmo no aparelho e no banco, desde o primeiro toque. */
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
