/**
 * IndexedDB da gravação do v2, enquanto ela ainda não virou transcrição.
 *
 * O gravador emite um FRAGMENTO a cada 2 minutos (`MediaRecorder.start(timeslice)`)
 * e cada um cai aqui na hora. No stop, os fragmentos de uma parte são
 * concatenados de volta num arquivo só — o primeiro traz o cabeçalho, os
 * seguintes são continuação, e juntos formam um webm/mp4 válido (verificado:
 * concatenado decodifica inteiro, fragmento do meio sozinho não decodifica).
 *
 * Daí os dois papéis não se confundirem: o fragmento existe para NÃO PERDER o
 * áudio, e a parte existe para caber no POST. Um sermão de 40 minutos é uma
 * parte só, uma chamada só de transcrição, com 20 fragmentos guardados no
 * caminho.
 *
 * Tudo degrada em silêncio (navegador antigo, aba anônima, cota estourada):
 * `putFragment` devolve `false` e quem chama precisa saber que está sem rede de
 * segurança.
 */

const DB_NAME = "scriba-captures";
const FRAGMENTS = "fragments";
const CAPTURES = "captures";
const DB_VERSION = 1;

/** Metadados da gravação. Os bytes estão nos fragmentos. */
export type CaptureMeta = {
  id: string;
  /** Preenchido quando a sessão é criada, para uma retentativa não criar outra. */
  sessionId: string | null;
  mimeType: string;
  extension: string;
  durationMs: number;
  /** Quantas partes existem (1 na esmagadora maioria das gravações). */
  parts: number;
  createdAt: number;
  attempts: number;
};

type Fragment = {
  captureId: string;
  part: number;
  seq: number;
  blob: Blob;
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
      if (!db.objectStoreNames.contains(FRAGMENTS)) {
        // Chave composta: ordena sozinha por parte e por sequência, que é
        // exatamente a ordem em que os bytes precisam ser remontados.
        db.createObjectStore(FRAGMENTS, { keyPath: ["captureId", "part", "seq"] });
      }
      if (!db.objectStoreNames.contains(CAPTURES)) {
        db.createObjectStore(CAPTURES, { keyPath: "id" });
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

export async function putFragment(f: Fragment): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    await wrap(db.transaction(FRAGMENTS, "readwrite").objectStore(FRAGMENTS).put(f));
    return true;
  } catch {
    return false;
  }
}

export async function putCaptureMeta(meta: CaptureMeta): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    await wrap(db.transaction(CAPTURES, "readwrite").objectStore(CAPTURES).put(meta));
    return true;
  } catch {
    return false;
  }
}

export async function patchCaptureMeta(
  id: string,
  patch: Partial<Pick<CaptureMeta, "sessionId" | "attempts" | "durationMs" | "parts">>
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(CAPTURES, "readwrite");
    const store = tx.objectStore(CAPTURES);
    const existing = (await wrap(store.get(id))) as CaptureMeta | undefined;
    if (!existing) return;
    await wrap(store.put({ ...existing, ...patch }));
  } catch {
    // best-effort
  }
}

/** As gravações pendentes, da mais recente para a mais antiga. */
export async function listCaptures(): Promise<CaptureMeta[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const rows = await wrap(db.transaction(CAPTURES, "readonly").objectStore(CAPTURES).getAll());
    return (rows as CaptureMeta[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * Remonta as partes: um `Blob` por parte, na ordem dos fragmentos.
 *
 * O `getAll` sobre a chave composta já vem ordenado por `[captureId, part, seq]`,
 * então basta agrupar. Blob de blobs não copia bytes, o navegador só referencia.
 */
export async function loadParts(captureId: string, mimeType: string): Promise<Blob[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const range = IDBKeyRange.bound(
      [captureId, 0, 0],
      [captureId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
    );
    const rows = (await wrap(
      db.transaction(FRAGMENTS, "readonly").objectStore(FRAGMENTS).getAll(range)
    )) as Fragment[];
    const byPart = new Map<number, Blob[]>();
    for (const r of rows) {
      const list = byPart.get(r.part) ?? [];
      list.push(r.blob);
      byPart.set(r.part, list);
    }
    return [...byPart.keys()]
      .sort((a, b) => a - b)
      .map((p) => new Blob(byPart.get(p) ?? [], { type: mimeType }));
  } catch {
    return [];
  }
}

export async function deleteCapture(captureId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction([FRAGMENTS, CAPTURES], "readwrite");
    const range = IDBKeyRange.bound(
      [captureId, 0, 0],
      [captureId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
    );
    await wrap(tx.objectStore(FRAGMENTS).delete(range));
    await wrap(tx.objectStore(CAPTURES).delete(captureId));
  } catch {
    // best-effort
  }
}

/** Apaga gravações mais velhas que `maxAgeMs`. Prazo largo: é a pregação
 * inteira de alguém, e quem não conseguiu enviar no domingo pode só reabrir o
 * app no domingo seguinte. */
export async function deleteExpiredCaptures(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const all = await listCaptures();
  const old = all.filter((c) => c.createdAt < cutoff);
  for (const c of old) await deleteCapture(c.id);
  return old.length;
}
