"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WrittenSummary } from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";
import { adoptDraft, deleteDraft, NEW_DRAFT_KEY, readDraft, writeDraft } from "./draft-store";

const log = createLogger("escrever");

/** Pausa na digitação que dispara o envio. */
const SYNC_DEBOUNCE_MS = 1800;
/** Pausa (bem menor) que dispara a gravação no aparelho. */
const LOCAL_DEBOUNCE_MS = 300;

export type SaveStatus =
  /** Nada mudou desde o último envio confirmado. */
  | "synced"
  /** Está no aparelho, ainda não no banco. */
  | "local"
  | "saving"
  /** O envio falhou. O texto está no aparelho, e vai tentar de novo. */
  | "error";

export type WrittenDraftState = {
  doc: WrittenSummary;
  /** Substitui o documento inteiro. O editor sempre entrega o estado novo. */
  setDoc: (next: WrittenSummary | ((prev: WrittenSummary) => WrittenSummary)) => void;
  status: SaveStatus;
  /** `null` enquanto a sessão não existe no banco. */
  sessionId: string | null;
  /** Envia agora, sem esperar a pausa. Devolve o id, ou `null` se falhou. */
  flush: () => Promise<string | null>;
  /** `false` até o rascunho do aparelho ter sido consultado. */
  ready: boolean;
};

/**
 * O estado do editor de `/escrever`: uma cópia no aparelho, sempre, e o banco
 * atrás dela.
 *
 * **A ordem é local, depois rede, e nunca o contrário.** Toda mudança cai no
 * IndexedDB em 300ms e no banco em 1,8s. Os dois números são diferentes de
 * propósito: gravar no aparelho é instantâneo e não pode ser sentido, então o
 * atraso ali existe só para não escrever a cada tecla; o envio é uma
 * requisição, e mandar uma por palavra digitada seria uma rajada contra a
 * própria rota (ver o bucket `sessions-write`, 60/min).
 *
 * **O rascunho do aparelho VENCE o que o servidor devolveu**, quando ele é
 * mais novo que o último envio confirmado. É o caso que justifica a coisa
 * toda: a pessoa escreveu três parágrafos no metrô, o envio falhou, ela fechou
 * a aba e reabriu. Se o servidor vencesse, os três parágrafos sumiriam sem
 * nada na tela dizendo que sumiram.
 *
 * **A sessão nasce no PRIMEIRO envio, não ao abrir a tela.** O gravador cria a
 * linha antes de gravar porque precisa de uma URL estável desde o primeiro
 * segundo; aqui, criar ao abrir encheria a Biblioteca de textos vazios de quem
 * clicou em "Escrever" e desistiu. Enquanto não houver id, o rascunho mora sob
 * `NEW_DRAFT_KEY` e a URL não muda.
 *
 * **Envio nenhum roda em paralelo com outro.** Um `inFlight` segura a vez: com
 * dois POSTs no ar, o que saiu primeiro pode chegar por último e gravar o
 * texto VELHO por cima do novo. Quem chega durante um envio marca que há mais
 * a mandar, e o envio seguinte sai quando o atual terminar.
 */
export function useWrittenDraft(input: {
  /** O id, quando se está editando um texto que já existe. */
  id: string | null;
  /** O que o servidor entregou, ou o documento vazio de um texto novo. */
  initial: WrittenSummary;
}): WrittenDraftState {
  const router = useRouter();
  const [doc, setDocState] = useState<WrittenSummary>(input.initial);
  const [status, setStatus] = useState<SaveStatus>("synced");
  const [sessionId, setSessionId] = useState<string | null>(input.id);
  const [ready, setReady] = useState(false);

  // O documento vive também numa ref porque os temporizadores abaixo leem "o
  // que está na tela AGORA", e não o que estava quando o timer foi armado.
  const docRef = useRef(doc);
  docRef.current = doc;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const statusRef = useRef(status);
  statusRef.current = status;

  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);

  // Abertura: o rascunho do aparelho decide.
  useEffect(() => {
    let alive = true;
    const key = input.id ?? NEW_DRAFT_KEY;
    void readDraft(key).then((draft) => {
      if (!alive) return;
      if (draft && draft.updatedAt > draft.syncedAt) {
        setDocState(draft.doc);
        docRef.current = draft.doc;
        setStatus("local");
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [input.id]);

  const persistLocal = useCallback((next: WrittenSummary) => {
    const key = sessionIdRef.current ?? NEW_DRAFT_KEY;
    void writeDraft({ key, doc: next, updatedAt: Date.now(), syncedAt: 0 });
  }, []);

  const send = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) {
      pending.current = true;
      return null;
    }
    inFlight.current = true;
    setStatus("saving");
    const snapshot = docRef.current;
    try {
      const res = await fetch("/api/sessions/written", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionIdRef.current ?? undefined, summary: snapshot }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const body = (await res.json()) as { id: string };

      if (!sessionIdRef.current) {
        sessionIdRef.current = body.id;
        setSessionId(body.id);
        await adoptDraft(body.id);
        // `replace`, não `push`: o voltar do navegador tem de sair do editor,
        // não desfazer a criação da sessão e devolver uma tela em branco que
        // escreveria o mesmo texto numa segunda linha.
        router.replace(`/escrever/${body.id}`);
      }

      // Só o que FOI enviado conta como sincronizado. Se a pessoa digitou
      // durante o envio, `snapshot` já é passado, e carimbar o documento atual
      // como sincronizado esconderia a diferença até a próxima tecla.
      const upToDate = snapshot === docRef.current;
      await writeDraft({
        key: body.id,
        doc: docRef.current,
        updatedAt: Date.now(),
        syncedAt: upToDate ? Date.now() : 0,
      });
      setStatus(upToDate ? "synced" : "local");
      return body.id;
    } catch (err) {
      log.warn("envio falhou", { error: (err as Error).message });
      setStatus("error");
      return null;
    } finally {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        void send();
      }
    }
  }, [router]);

  const setDoc = useCallback(
    (next: WrittenSummary | ((prev: WrittenSummary) => WrittenSummary)) => {
      setDocState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        docRef.current = value;
        if (localTimer.current) clearTimeout(localTimer.current);
        localTimer.current = setTimeout(() => persistLocal(value), LOCAL_DEBOUNCE_MS);
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => void send(), SYNC_DEBOUNCE_MS);
        return value;
      });
      setStatus("local");
    },
    [persistLocal, send]
  );

  const flush = useCallback(async () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    return send();
  }, [send]);

  // Uma tentativa a mais quando a rede volta. Sem isto, um envio que falhou no
  // elevador só é refeito na próxima tecla — e a próxima tecla pode ser nunca,
  // se a pessoa terminou de escrever justamente ali.
  useEffect(() => {
    function onOnline() {
      if (statusRef.current === "error") void send();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [send]);

  useEffect(() => {
    return () => {
      if (localTimer.current) clearTimeout(localTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  return { doc, setDoc, status, sessionId, flush, ready };
}

/** Apaga o rascunho local de uma sessão. */
export async function forgetDraft(id: string | null): Promise<void> {
  await deleteDraft(id ?? NEW_DRAFT_KEY);
}
