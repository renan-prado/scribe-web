/**
 * IndexedDB para a gravação INTEIRA do v2, enquanto ela ainda não virou sessão.
 *
 * ## Por que ele existe
 *
 * O gravador do v2 (`app/v2/recording`) produz um arquivo só e o entrega no
 * stop, e daí saem três chamadas de rede em sequência: criar a sessão,
 * transcrever, resumir. Enquanto elas não terminam, o áudio existia em UM lugar
 * apenas, uma variável local dentro do `finish()`. Qualquer tropeço no caminho
 * (413 por tamanho, celular sem rede, a rota fora do ar) caía no `catch`, a
 * função retornava, a variável saía de escopo e o coletor comia a única cópia
 * do que foi dito. Foi assim que uma palestra de quase uma hora se perdeu
 * inteira, com a tela mostrando um aviso educado sobre limite de tamanho.
 *
 * Este módulo é a cópia que sobrevive a isso. O blob é gravado aqui ANTES da
 * primeira chamada de rede, e só é apagado quando a sessão está encerrada com
 * resumo no banco. No meio disso, falhar é só falhar: dá para tentar de novo,
 * dá para baixar o arquivo, e fechar a aba não destrói nada.
 *
 * ## Por que um banco separado do `scribe-chunks`
 *
 * `lib/chunk-store.ts` guarda os PEDAÇOS de 15-20s do gravador do app atual,
 * indexados por `[sessionId, index]`, e é o que sustenta a fila de upload com
 * retentativa de lá. Este store guarda outra coisa: um arquivo inteiro que
 * ainda não tem `sessionId` nenhum, porque no v2 a sessão nasce depois dele.
 *
 * Acrescentar um object store ao banco existente exigiria subir o `DB_VERSION`
 * dele, e duas páginas abertas em versões diferentes do mesmo banco travam uma
 * à outra (`onblocked`). Um banco próprio custa uma conexão a mais e não
 * encosta no pipeline do v1, que roda em produção.
 *
 * Quando o v2 passar a fatiar o áudio (o teto de ~44 MB por POST some junto),
 * o caminho natural é ele usar o `chunk-store` como o v1 usa, e este módulo
 * passa a guardar só o que ainda não virou pedaço, ou desaparece.
 *
 * ## Degradação
 *
 * Tudo aqui falha em silêncio e devolve `false`/`[]`/`null`: navegador antigo,
 * aba anônima em alguns motores, armazenamento desligado, cota estourada. O
 * gravador continua funcionando sem a rede de segurança, e é por isso que
 * `putCapture` devolve um booleano em vez de lançar, quem chama precisa saber
 * que está sem rede de segurança para poder avisar na tela.
 */

const DB_NAME = "scriba-captures";
const STORE = "pending_captures";
const DB_VERSION = 1;

export type PendingCapture = {
  /** `crypto.randomUUID()`, gerado no cliente: a gravação precisa de identidade
   * antes de existir sessão para pendurá-la. */
  id: string;
  blob: Blob;
  extension: string;
  /** Duração REAL gravada, sem o tempo pausado (ver `useAudioCapture`). */
  durationMs: number;
  /** `Date.now()` na hora de gravar aqui. Usado por `deleteExpiredCaptures` e
   * para dizer na tela "uma gravação de terça". */
  createdAt: number;
  /** Preenchido assim que `POST /api/sessions` responde. Uma retentativa que
   * encontre isto preenchido NÃO cria outra sessão, ela continua de onde parou,
   * senão cada tentativa deixaria mais uma linha vazia em "Em aberto". */
  sessionId: string | null;
  /** Quantas vezes o envio já foi tentado. Não limita nada, é o que permite à
   * tela parar de prometer "tente de novo" a quem já tentou seis vezes. */
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
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function wrapReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

/**
 * Grava (ou regrava) uma captura. `false` quando o armazenamento não está
 * disponível ou a cota estourou, e aí a gravação corre SEM cópia de segurança:
 * quem chama precisa tratar isso, não ignorar.
 */
export async function putCapture(capture: PendingCapture): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    await wrapReq(tx.objectStore(STORE).put(capture));
    return true;
  } catch {
    return false;
  }
}

/**
 * Atualiza campos de uma captura já gravada sem reescrever o blob a partir da
 * memória. Usado para carimbar o `sessionId` recém-criado e contar tentativas.
 *
 * Lê e regrava o registro inteiro dentro da MESMA transação: o blob volta do
 * disco e vai para o disco sem passar pelo heap da aba como cópia nova, que é
 * o que um `put` montado do zero faria com dezenas de megabytes.
 */
export async function patchCapture(
  id: string,
  patch: Partial<Pick<PendingCapture, "sessionId" | "attempts">>
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = (await wrapReq(store.get(id))) as PendingCapture | undefined;
    if (!existing) return;
    await wrapReq(store.put({ ...existing, ...patch }));
  } catch {
    // best-effort: perder o carimbo custa uma sessão vazia a mais, não o áudio.
  }
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    await wrapReq(tx.objectStore(STORE).delete(id));
  } catch {
    // best-effort
  }
}

/** As capturas pendentes, da mais recente para a mais antiga. */
export async function listCaptures(): Promise<PendingCapture[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, "readonly");
    const rows = await wrapReq(tx.objectStore(STORE).getAll());
    return (rows as PendingCapture[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * Apaga capturas mais velhas que `maxAgeMs`. Chamado na montagem da tela de
 * gravação.
 *
 * O prazo é LARGO de propósito, e bem maior que as 24h do `chunk-store`. Lá o
 * que expira é um pedaço de 20 segundos, cuja perda é um buraco na transcrição;
 * aqui é a gravação inteira de alguém, e o dono dela pode muito bem só reabrir
 * o app no domingo seguinte. Enquanto ela estiver aqui, ainda dá para enviar ou
 * baixar o arquivo; depois disso, não existe mais em lugar nenhum.
 */
export async function deleteExpiredCaptures(maxAgeMs: number): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const idx = tx.objectStore(STORE).index("byCreatedAt");
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
