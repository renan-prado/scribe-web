"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WrittenSummary } from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";
import { isOnline } from "@/shared/hooks/use-network-status";
import { deleteDraft, newDraftId, readDraft, writeDraft } from "./draft-store";

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
  /**
   * O último envio falhou com o navegador OFFLINE.
   *
   * A tela precisa disto porque as duas falhas pedem frases diferentes: sem
   * rede, "sem internet, está guardado aqui" é a verdade e não há o que fazer;
   * COM rede, o problema é nosso, e dizer "sem conexão" manda a pessoa
   * conferir o wi-fi por causa de um erro do servidor. Foi o que aconteceu em
   * produção, e a frase errada escondeu a causa real por uma sessão inteira.
   */
  offline: boolean;
  /** `null` enquanto a sessão não existe no banco. */
  /**
   * O id do documento, conhecido desde o primeiro quadro — ele é sorteado no
   * aparelho, não no banco. Serve a quem só precisa de um ENDEREÇO (a URL, a
   * conversa do Biblo); quem precisa saber se a linha EXISTE usa `sessionId`.
   */
  draftId: string;
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
 * **O ID nasce no APARELHO, a LINHA nasce no primeiro envio.** São duas coisas
 * separadas, e separá-las é o que conserta um defeito que apareceu em
 * produção. A linha continua nascendo só quando há texto — criar ao abrir
 * encheria a Biblioteca de folhas em branco de quem clicou e desistiu —, mas o
 * id não espera por ela: ele é sorteado aqui (`newDraftId`), vira a chave do
 * rascunho local, vai no POST e é com ele que a rota cria a linha.
 *
 * O desenho anterior deixava o id para o servidor, e o rascunho de um texto
 * novo morava sob uma chave FIXA até o primeiro salvamento. Quando esse
 * salvamento falhava — e ele falhou, o banco de produção estava sem a migração
 * do modo `manual` —, o texto ficava guardado sob aquela chave e o próximo
 * "Escrever" abria com ele dentro, no lugar da folha em branco. Um id por
 * folha faz de cada "Escrever" um documento.
 *
 * **A URL passa a ser `/escrever/<id>` assim que a folha abre**, por
 * `history.replaceState` (que o App Router entende — ver "Native History API"
 * no guia de navegação) e nunca por `router.replace`: navegar remonta o editor
 * do zero com o que o servidor devolveu, e as teclas digitadas no meio do
 * caminho somem sem deixar rastro. Trocar a URL no lugar não desmonta nada.
 *
 * **O que está sendo digitado vence o que veio do disco.** A consulta ao
 * IndexedDB é assíncrona, e os poucos milissegundos dela são tempo de sobra
 * para a primeira letra de quem abre a tela e começa a escrever na hora —
 * letra que a resposta da consulta apagava ao chegar. Uma vez que uma tecla
 * foi digitada, o rascunho guardado não entra mais.
 *
 * **Nada pendente morre com a tela.** No desmontar, o que ainda não subiu é
 * gravado no aparelho na hora, sem esperar a pausa — sair da página no meio dos
 * 300ms cancelaria o temporizador e o trabalho existiria só na memória de um
 * componente que acabou de deixar de existir. E ao voltar, um rascunho mais
 * novo que o último envio não só vence o servidor: ele agenda o envio que
 * ficou faltando, senão ficaria para sempre guardado só neste aparelho.
 *
 * **Envio nenhum roda em paralelo com outro.** Um `inFlight` segura a vez: com
 * dois POSTs no ar, o que saiu primeiro pode chegar por último e gravar o
 * texto VELHO por cima do novo. Quem chega durante um envio marca que há mais
 * a mandar, e o envio seguinte sai quando o atual terminar.
 */
export function useWrittenDraft(input: {
  /** O id da URL, quando se abre um endereço que já existe. */
  id: string | null;
  /**
   * A linha JÁ existe no banco. Falso numa folha nova E num rascunho que nunca
   * subiu — ali a URL existe e a linha não.
   */
  exists: boolean;
  /** O que o servidor entregou, ou o documento vazio de um texto novo. */
  initial: WrittenSummary;
}): WrittenDraftState {
  const [doc, setDocState] = useState<WrittenSummary>(input.initial);
  const [status, setStatus] = useState<SaveStatus>("synced");
  const [offline, setOffline] = useState(false);
  /**
   * O id deste documento, e ele não muda mais.
   *
   * Sorteado aqui quando a URL não trouxe um (ver `newDraftId`). É o mesmo
   * valor em três lugares — a chave do rascunho no aparelho, o `id` do POST e
   * a linha do banco —, do primeiro caractere ao último salvamento.
   */
  const [draftId] = useState(() => input.id ?? newDraftId());
  /** A linha existe no banco: é o que diz se há algo para ler em `/summary`. */
  const [saved, setSaved] = useState(input.exists);
  const [ready, setReady] = useState(false);

  // O documento vive também numa ref porque os temporizadores abaixo leem "o
  // que está na tela AGORA", e não o que estava quando o timer foi armado.
  const docRef = useRef(doc);
  docRef.current = doc;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const statusRef = useRef(status);
  statusRef.current = status;

  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  /**
   * Alguma tecla já foi digitada nesta montagem.
   *
   * O IndexedDB responde em alguns milissegundos, e alguns milissegundos são
   * tempo de sobra para a primeira letra: quem abre `/escrever` e começa a
   * escrever na hora tinha o que digitou APAGADO pela resposta da consulta,
   * que chegava depois e escrevia o rascunho guardado por cima. O que está
   * na tela, sendo digitado agora, vence qualquer coisa vinda do disco.
   */
  const touched = useRef(false);

  const persistLocal = useCallback(
    (next: WrittenSummary) => {
      void writeDraft({ key: draftId, doc: next, updatedAt: Date.now(), syncedAt: 0 });
    },
    [draftId]
  );

  /**
   * A URL vira `/escrever/<id>` assim que a folha abre, sem navegar.
   *
   * `replaceState` e não `router.replace` pela razão do cabeçalho: navegar
   * remontaria o editor. É `replace` e não `push` porque o voltar tem de sair
   * do editor, não desfazer o endereço do texto que está sendo escrito.
   *
   * O que isto conserta é o recarregar no meio da escrita: com a URL genérica,
   * a página voltava a ser a folha em branco e o rascunho tinha de ser
   * adivinhado a partir de uma chave fixa — que era a mesma para todos os
   * textos novos. Com o id na barra, recarregar reabre ESTE documento.
   */
  useEffect(() => {
    if (input.id) return;
    window.history.replaceState(null, "", `/escrever/${draftId}`);
  }, [input.id, draftId]);

  const send = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) {
      pending.current = true;
      return null;
    }
    inFlight.current = true;
    setStatus("saving");
    const snapshot = docRef.current;
    try {
      // O `id` vai SEMPRE, inclusive no primeiro envio: é a rota que cria a
      // linha com ele. Sem isso o servidor sortearia um id que este aparelho
      // não conhece, e o rascunho local ficaria guardado sob outra chave.
      const res = await fetch("/api/sessions/written", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, summary: snapshot }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const body = (await res.json()) as { id: string };

      if (!savedRef.current) {
        savedRef.current = true;
        setSaved(true);
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
      // A rede é lida AQUI, no instante da falha, e não na hora de desenhar o
      // chip: o que a frase precisa dizer é como a rede estava quando o envio
      // morreu. Por isso é o `isOnline()` de fora do React, e não o hook: este
      // é um `catch`, não um render. Ver `use-network-status.ts`.
      const wasOffline = !isOnline();
      log.warn("envio falhou", { error: (err as Error).message, offline: wasOffline });
      setOffline(wasOffline);
      setStatus("error");
      return null;
    } finally {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        void send();
      }
    }
  }, [draftId]);

  // Abertura: o rascunho do aparelho decide.
  useEffect(() => {
    let alive = true;
    void readDraft(draftId).then((draft) => {
      if (!alive) return;
      if (draft && !touched.current && draft.updatedAt > draft.syncedAt) {
        setDocState(draft.doc);
        docRef.current = draft.doc;
        setStatus("local");
        // O que o aparelho tem é mais novo que o que o banco tem, e ninguém
        // mais vai mandar isso: o `setDoc` só arma o temporizador quando uma
        // tecla é digitada, e pode não haver tecla nenhuma — a pessoa reabriu
        // para LER o que escreveu.
        //
        // Isto agora vale também para um texto que NUNCA subiu, e é o conserto
        // de um buraco real: o rascunho cujo primeiro envio falhou ficava
        // esperando uma tecla que podia não vir nunca. Linha vazia no banco
        // continua impossível — só existe rascunho aqui se alguém digitou.
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => void send(), SYNC_DEBOUNCE_MS);
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [draftId, send]);

  const setDoc = useCallback(
    (next: WrittenSummary | ((prev: WrittenSummary) => WrittenSummary)) => {
      touched.current = true;
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
      // O que estava esperando a pausa não pode morrer junto com a tela. A
      // condição é o `status`: em "synced" não há nada pendente, e gravar assim
      // mesmo carimbaria `syncedAt: 0` num texto que ESTÁ no banco — a próxima
      // abertura anunciaria "salvo neste aparelho" sobre trabalho já salvo.
      if (statusRef.current !== "synced") persistLocal(docRef.current);
    };
  }, [persistLocal]);

  return { doc, setDoc, status, offline, draftId, sessionId: saved ? draftId : null, flush, ready };
}

/** Apaga o rascunho local de uma sessão. */
export async function forgetDraft(id: string): Promise<void> {
  await deleteDraft(id);
}
