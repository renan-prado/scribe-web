/**
 * IndexedDB-backed store for audio chunks awaiting transcription.
 *
 * Rationale: when the tab backgrounds or dies before a chunk has been
 * uploaded to /api/transcribe, we lose the audio and leave a hole in the
 * transcript. Persisting every emitted chunk here lets the upload queue
 * retry it later — including after a full reload of the same session URL
 * ("silent" orphan recovery, capped at 24h to avoid stale accumulation).
 *
 * All operations degrade gracefully when IndexedDB is unavailable (older
 * browsers, private mode on some engines, storage disabled). Callers should
 * check {@link isChunkStoreAvailable} once and skip persistence if false —
 * the in-memory pipeline still works, just without crash recovery.
 */

const DB_NAME = "scribe-chunks";
const STORE = "pending_chunks";
const DB_VERSION = 1;

export type StoredChunk = {
  sessionId: string;
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  /** performance.now() at chunk start — used to reconstruct sermonAtMs on recovery. */
  startedAt: number;
  durationMs: number;
  /** Snapshot of the tail-hint sent to /api/transcribe. Preserved so orphan
   * uploads reproduce the same context prompt they would have had originally. */
  prevText: string;
  /** Date.now() at persistence, used by deleteExpired to prune stale entries. */
  createdAt: number;
  /** Bumped on every upload attempt so the queue can surface failing chunks. */
  attempts: number;
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
        // Composite key = [sessionId, index] so we can range-scan a session
        // and never collide across sessions.
        const store = db.createObjectStore(STORE, { keyPath: ["sessionId", "index"] });
        store.createIndex("bySession", "sessionId", { unique: false });
        store.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function isChunkStoreAvailable(): Promise<boolean> {
  const db = await openDb();
  return db !== null;
}

function wrapReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

export async function putChunk(chunk: StoredChunk): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await wrapReq(store.put(chunk));
    return true;
  } catch {
    // QuotaExceededError, TransactionInactiveError, etc.
    return false;
  }
}

export async function deleteChunk(sessionId: string, index: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await wrapReq(store.delete([sessionId, index]));
  } catch {
    // best-effort
  }
}

/**
 * Delete every persisted chunk for one session. Used when a live recording is
 * discarded — the session row is gone, so its pending audio must not linger in
 * IDB where orphan recovery would keep retrying uploads for a dead session.
 */
export async function deleteChunksForSession(sessionId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const idx = store.index("bySession");
    await new Promise<void>((resolve) => {
      const cursorReq = idx.openCursor(IDBKeyRange.only(sessionId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    });
  } catch {
    // best-effort
  }
}

export async function listChunksForSession(sessionId: string): Promise<StoredChunk[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const idx = store.index("bySession");
    const rows = await wrapReq(idx.getAll(IDBKeyRange.only(sessionId)));
    return (rows as StoredChunk[]).sort((a, b) => a.index - b.index);
  } catch {
    return [];
  }
}

export async function bumpChunkAttempts(sessionId: string, index: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = (await wrapReq(store.get([sessionId, index]))) as StoredChunk | undefined;
    if (!existing) return;
    existing.attempts += 1;
    await wrapReq(store.put(existing));
  } catch {
    // best-effort
  }
}

/**
 * Delete chunks older than maxAgeMs across ALL sessions. Called on mount to
 * keep the store from accumulating orphans from long-abandoned sessions.
 */
export async function deleteExpiredChunks(maxAgeMs: number): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const idx = store.index("byCreatedAt");
    const cutoff = Date.now() - maxAgeMs;
    return await new Promise<number>((resolve) => {
      let removed = 0;
      const cursorReq = idx.openCursor(IDBKeyRange.upperBound(cutoff));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(removed);
          return;
        }
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      cursorReq.onerror = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}
