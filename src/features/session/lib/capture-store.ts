/**
 * IndexedDB da gravação, enquanto ela ainda não virou transcrição e resumo.
 *
 * O gravador emite um FRAGMENTO a cada 2 minutos (`MediaRecorder.start(timeslice)`)
 * e cada um cai aqui na hora. No stop, os fragmentos de uma parte são
 * concatenados de volta num arquivo só: o primeiro traz o cabeçalho, os
 * seguintes são continuação, e juntos formam um webm/mp4 válido (verificado —
 * concatenado decodifica inteiro, fragmento do meio sozinho não decodifica).
 *
 * Daí os dois papéis não se confundirem: o fragmento existe para NÃO PERDER o
 * áudio, e a parte existe para caber no POST. Um sermão de 40 minutos é uma
 * parte só, uma chamada só de transcrição, com 20 fragmentos guardados no
 * caminho.
 *
 * **Ele mora em `features/session/` e não mais na pasta da tela de gravação.**
 * Enquanto o resgate era um botão dentro do `/recording`, o arquivo podia viver
 * ao lado dela; agora a Biblioteca mostra o cartão da gravação pendente e o
 * `CaptureQueue` a reenvia de qualquer tela, e um módulo lido por três lugares
 * não é detalhe de uma rota.
 *
 * ## Por que a linha nasce no START, e não no stop
 *
 * Ela nascia no stop, e isso deixava um buraco pelo qual uma pregação inteira
 * cabia: a aba morta no minuto 40 deixava 20 fragmentos no banco e NENHUMA
 * linha em `captures` apontando para eles. `listCaptures` não os via, o resgate
 * não os via, e a faxina por idade também não: eram bytes órfãos, invisíveis,
 * ocupando a cota até alguém limpar o navegador. Agora a linha existe desde o
 * primeiro segundo e `durationMs` sobe a cada fragmento, então o pior caso de
 * uma aba morta deixou de ser "perdi tudo" e passou a ser "perdi os últimos
 * dois minutos".
 *
 * `closed` diz se o `stop()` chegou ao fim. `heartbeatAt` é a hora do último
 * fragmento, e serve a UMA pergunta: esta gravação aberta está viva em ALGUMA
 * aba agora? Sem ela, uma segunda aba do Scriba veria a gravação da primeira
 * como abandonada e a subiria no meio do sermão.
 *
 * Tudo degrada em silêncio (navegador antigo, aba anônima, cota estourada):
 * `putFragment` devolve `false` e quem chama precisa saber que está sem rede de
 * segurança.
 */

const DB_NAME = "scriba-captures";
const FRAGMENTS = "fragments";
const CAPTURES = "captures";
const DB_VERSION = 1;

/**
 * Por que a última tentativa falhou. É o que decide se vale tentar de novo
 * sozinho, e é o que a Biblioteca escreve no cartão.
 *
 * - `offline`: não saiu do aparelho. Volta a tentar assim que a rede voltar.
 * - `server`: saiu e voltou errado (5xx, 429, rota fora do ar). Retenta com
 *   espera crescente.
 * - `balance`: as moedas acabaram no meio do caminho. Retentar sozinho dá o
 *   mesmo resultado, depende de a pessoa recarregar; o áudio fica guardado.
 * - `fatal`: retentar dá o mesmo resultado para sempre (arquivo grande demais,
 *   áudio sem fala nenhuma). A única saída honesta é baixar o arquivo.
 */
export type CaptureFailure = "offline" | "server" | "balance" | "fatal";

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
  /** `false` enquanto a gravação corre, `true` depois que o `stop()` terminou. */
  closed: boolean;
  /** Hora do último fragmento gravado. Ver o cabeçalho. */
  heartbeatAt: number;
  /** Por que a última tentativa falhou, e a frase que a tela mostra. */
  failure: CaptureFailure | null;
  failureMessage: string | null;
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

/**
 * Os campos que entraram depois não existem nas linhas gravadas pela versão
 * anterior, e uma gravação de ontem que voltasse com `closed: undefined` seria
 * lida como ABERTA e pulada pelo resgate para sempre. Toda leitura passa por
 * aqui, e o que veio do disco antigo é uma gravação fechada: naquele tempo só o
 * stop escrevia linha.
 */
function normalize(row: CaptureMeta): CaptureMeta {
  return {
    ...row,
    closed: row.closed !== false,
    heartbeatAt: typeof row.heartbeatAt === "number" ? row.heartbeatAt : row.createdAt,
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    failure: row.failure ?? null,
    failureMessage: row.failureMessage ?? null,
  };
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

type CapturePatch = Partial<Omit<CaptureMeta, "id">>;

/**
 * Aplica a mudança e devolve a linha resultante, para quem chama não precisar
 * reler o banco só para saber em que estado ela ficou.
 *
 * `null` quer dizer que a linha não existe mais, e é um caso REAL, não um erro:
 * a fila pode estar terminando uma tentativa de uma gravação que a pessoa
 * apagou no meio dela.
 */
export async function patchCaptureMeta(
  id: string,
  patch: CapturePatch
): Promise<CaptureMeta | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(CAPTURES, "readwrite");
    const store = tx.objectStore(CAPTURES);
    const existing = (await wrap(store.get(id))) as CaptureMeta | undefined;
    if (!existing) return null;
    const next = normalize({ ...existing, ...patch });
    await wrap(store.put(next));
    return next;
  } catch {
    return null;
  }
}

/** As gravações guardadas, da mais recente para a mais antiga. */
export async function listCaptures(): Promise<CaptureMeta[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const rows = await wrap(db.transaction(CAPTURES, "readonly").objectStore(CAPTURES).getAll());
    return (rows as CaptureMeta[]).map(normalize).sort((a, b) => b.createdAt - a.createdAt);
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

/**
 * Apaga gravações mais velhas que `maxAgeMs`. Prazo largo: é a pregação inteira
 * de alguém, e quem não conseguiu enviar no domingo pode só reabrir o app no
 * domingo seguinte.
 */
export async function deleteExpiredCaptures(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const all = await listCaptures();
  const old = all.filter((c) => c.createdAt < cutoff);
  for (const c of old) await deleteCapture(c.id);
  return old.length;
}

/**
 * Entrega o arquivo a quem gravou, uma parte por vez.
 *
 * Não depende de rede, de saldo nem de a rota aceitar o tamanho, e por isso é a
 * garantia de último recurso: o que foi dito sai do aparelho de um jeito que o
 * resto do sistema não pode estragar. Mora aqui, e não na tela, porque as duas
 * telas que oferecem o resgate precisam dele.
 */
export async function downloadCapture(meta: CaptureMeta): Promise<void> {
  const parts = await loadParts(meta.id, meta.mimeType);
  const stamp = new Date(meta.createdAt).toLocaleString("sv-SE").replace(/[: ]/g, "-").slice(0, 16);
  parts.forEach((blob, i) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      parts.length > 1
        ? `scriba-${stamp}-parte${i + 1}.${meta.extension}`
        : `scriba-${stamp}.${meta.extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revogar no mesmo quadro cancela o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}
