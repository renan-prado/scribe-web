"use client";

import { create } from "zustand";
import { createLogger } from "@/lib/log";
import {
  type CaptureMeta,
  deleteCapture,
  deleteExpiredCaptures,
  listCaptures,
  patchCaptureMeta,
} from "./lib/capture-store";
import { type UploadPhase, uploadCapture } from "./lib/capture-upload";
import { useRecordingStore } from "./recording-store";

const log = createLogger("capture-queue");

/**
 * A fila das gravações que ainda não viraram resumo, e quem insiste por elas.
 *
 * ## O defeito que ela conserta
 *
 * O áudio SEMPRE foi guardado no aparelho (ver `lib/capture-store.ts`), e mesmo
 * assim uma pregação se perdeu. O motivo é que a gravação guardada só existia
 * DENTRO da tela de gravação: era lá que a falha aparecia, era lá que ficava o
 * botão de tentar de novo, e sair daquela tela era o gesto que fazia o áudio
 * desaparecer do app inteiro. Ele continuava no IndexedDB, intacto, e nenhuma
 * tela voltava a mencioná-lo. Guardar sem devolver é a mesma coisa que perder,
 * com o agravante de não parecer um defeito.
 *
 * Agora quem cuida é esta fila, que não mora em tela nenhuma: ela é montada uma
 * vez pelo layout do app (`PendingCaptureRunner`), varre o disco na abertura,
 * insiste sozinha enquanto houver o que enviar, e publica a lista para a
 * Biblioteca desenhar o cartão do que está pendente.
 *
 * ## Quando ela tenta
 *
 * A rede volta sem avisar, então esperar por um só sinal é escolher o dia em
 * que nada acontece. São quatro:
 *
 * - **na abertura do app**, depois de varrer o disco;
 * - **no evento `online`**, que é o instante exato em que o wifi da igreja
 *   pegou;
 * - **ao voltar para o app** (`visibilitychange`), que é quando quem saiu para
 *   comprar moedas ou trocar de rede volta;
 * - **num relógio de 20s**, que é o desempate: os três de cima mentem em
 *   WebView, e `online` costuma disparar antes de a rota estar de pé.
 *
 * O relógio não é uma tentativa a cada 20s: ele só ACORDA e pergunta se já
 * passou a espera daquela gravação, que cresce a cada falha (ver `BACKOFF_MS`).
 *
 * ## O que ela nunca faz
 *
 * **Não envia a gravação que está sendo gravada.** Duas guardas, porque uma
 * não cobre o caso das duas abas: `capturing` é o id vivo NESTA aba, e o
 * `heartbeatAt` cobre a aba vizinha, que esta não enxerga.
 *
 * **Não trabalha durante uma gravação.** Subir 7 MB e rodar um resumo enquanto
 * alguém está com o microfone aberto disputa rede e CPU com a única coisa da
 * tela que não pode falhar.
 *
 * **Não apaga o áudio antes do resumo existir.** O `deleteCapture` acontece
 * numa linha só de todo o arquivo, depois de `ok: true`.
 */
type QueueState = {
  /** Tudo que está guardado no aparelho e ainda não virou resumo. */
  captures: CaptureMeta[];
  /** A gravação sendo enviada agora, e em que passo ela está. */
  uploading: string | null;
  phase: UploadPhase | null;
  /** A gravação que o microfone está escrevendo NESTA aba. Nunca é enviada. */
  capturing: string | null;
  /** A última que chegou ao fim. É por aqui que a tela de gravação sabe para
   *  qual resumo navegar, e a Biblioteca sabe que tem lista nova para buscar. */
  done: { captureId: string; sessionId: string; at: number } | null;
  /** O primeiro `scan()` já terminou. Antes dele, "lista vazia" não é um fato. */
  scanned: boolean;
};

type QueueActions = {
  scan: () => Promise<void>;
  /** Põe na fila uma gravação que acabou de nascer, sem ir ao disco de novo. */
  track: (meta: CaptureMeta) => void;
  setCapturing: (id: string | null) => void;
  /** Tenta uma gravação. `force` é o toque da pessoa: ignora a espera. */
  run: (id: string, options?: { force?: boolean }) => Promise<void>;
  /** Acorda: tenta a primeira da fila que já pode ser tentada. */
  kick: () => Promise<void>;
  drop: (id: string) => Promise<void>;
  clearDone: () => void;
};

/**
 * A espera antes da próxima tentativa, por número de falhas.
 *
 * Ela cresce porque as duas falhas que retentam têm ritmos diferentes: a rede
 * de quem está no dado móvel da igreja volta em segundos, e uma rota nossa fora
 * do ar volta em minutos. Começar em 15s atende a primeira; o teto de 10
 * minutos impede que a segunda vire um martelo batendo num servidor que já está
 * apanhando.
 *
 * Nada disso é a garantia. A garantia é o áudio estar no disco e o cartão estar
 * na Biblioteca: a insistência automática é conveniência, e o botão continua
 * lá para quem não quer esperar.
 */
const BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000];

/** Sem saldo, a espera já nasce no teto: tentar de novo em 15s dá exatamente o
 *  mesmo 402, e o que destrava isso é a pessoa comprar moedas, não o relógio. */
const BALANCE_BACKOFF_MS = BACKOFF_MS[BACKOFF_MS.length - 1];

/**
 * Depois de quanto tempo sem fragmento uma gravação ABERTA é dada por morta.
 *
 * Os fragmentos saem a cada 2 minutos, então 6 é o triplo da cadência: folga
 * para uma aba travada um instante, e curto o bastante para o resgate da
 * gravação que o sistema matou no meio não esperar até amanhã. Abaixo disso a
 * fila arriscaria enviar, de uma segunda aba, o sermão que a primeira ainda
 * está gravando.
 */
const STALE_OPEN_MS = 6 * 60 * 1_000;

/** A gravação fica um mês. É a pregação de alguém, e quem ficou sem sinal no
 *  domingo pode só reabrir o app no domingo seguinte. */
const CAPTURE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

/** A próxima hora em que cada gravação pode ser tentada. Mora fora do store
 *  porque é agenda, não tela: mudá-la não deve repintar nada. */
const nextAttemptAt = new Map<string, number>();

function backoffFor(meta: CaptureMeta): number {
  if (meta.failure === "balance") return BALANCE_BACKOFF_MS;
  return BACKOFF_MS[Math.min(Math.max(meta.attempts - 1, 0), BACKOFF_MS.length - 1)];
}

/**
 * Esta gravação pode ser enviada agora?
 *
 * `fatal` fica de fora para sempre: ela já foi tentada e a resposta não muda com
 * o tempo, então insistir só gastaria bateria para reescrever o mesmo aviso. O
 * cartão dela continua na Biblioteca, com o botão de baixar, que é a saída que
 * sobra.
 */
export function isEligible(meta: CaptureMeta, state: QueueState, now = Date.now()): boolean {
  if (meta.id === state.capturing) return false;
  if (!meta.closed && now - meta.heartbeatAt < STALE_OPEN_MS) return false;
  if (meta.failure === "fatal") return false;
  return now >= (nextAttemptAt.get(meta.id) ?? 0);
}

export const useCaptureQueue = create<QueueState & QueueActions>((set, get) => ({
  captures: [],
  uploading: null,
  phase: null,
  capturing: null,
  done: null,
  scanned: false,

  scan: async () => {
    await deleteExpiredCaptures(CAPTURE_TTL_MS);
    const captures = await listCaptures();
    set({ captures, scanned: true });
  },

  track: (meta) => {
    set((s) => ({ captures: [meta, ...s.captures.filter((c) => c.id !== meta.id)] }));
  },

  setCapturing: (id) => set({ capturing: id }),

  clearDone: () => set({ done: null }),

  drop: async (id) => {
    await deleteCapture(id);
    nextAttemptAt.delete(id);
    set((s) => ({ captures: s.captures.filter((c) => c.id !== id) }));
  },

  run: async (id, options) => {
    const state = get();
    // Uma de cada vez. Duas transcrições simultâneas no dado móvel da igreja
    // fazem as duas demorarem mais do que as duas em fila.
    if (state.uploading) return;
    const meta = state.captures.find((c) => c.id === id);
    if (!meta) return;
    if (!options?.force && !isEligible(meta, state)) return;

    set({ uploading: id, phase: "creating" });
    // Some com o aviso antigo enquanto esta tentativa corre: manter na tela o
    // "sem internet" de dez minutos atrás, com a barra dizendo "transcrevendo",
    // é a tela se contradizendo.
    set((s) => ({
      captures: s.captures.map((c) =>
        c.id === id ? { ...c, failure: null, failureMessage: null } : c
      ),
    }));

    const result = await uploadCapture(meta, {
      onPhase: (phase) => set({ phase }),
      onSession: async (sessionId) => {
        const next = await patchCaptureMeta(id, { sessionId });
        if (next) set((s) => ({ captures: s.captures.map((c) => (c.id === id ? next : c)) }));
      },
    });

    if (result.ok) {
      // A ÚNICA linha do app que apaga o áudio, e ela está depois do resumo
      // existir. Ver o cabeçalho.
      await deleteCapture(id);
      nextAttemptAt.delete(id);
      set((s) => ({
        captures: s.captures.filter((c) => c.id !== id),
        uploading: null,
        phase: null,
        done: { captureId: id, sessionId: result.sessionId, at: Date.now() },
      }));
      return;
    }

    const attempts = meta.attempts + 1;
    const next = await patchCaptureMeta(id, {
      attempts,
      failure: result.failure,
      failureMessage: result.message,
    });
    // `null` quer dizer que a gravação foi apagada durante a tentativa. Não há
    // nada para reagendar, e reinserir a linha traria de volta um cartão que a
    // pessoa acabou de mandar embora.
    if (next) {
      nextAttemptAt.set(id, Date.now() + backoffFor(next));
      set((s) => ({ captures: s.captures.map((c) => (c.id === id ? next : c)) }));
    }
    set({ uploading: null, phase: null });
    log.warn("capture upload failed", { captureId: id, failure: result.failure, attempts });
  },

  kick: async () => {
    const state = get();
    if (state.uploading || !state.scanned) return;
    // Gravando: a rede e a CPU são do microfone. Ver o cabeçalho.
    if (useRecordingStore.getState().running) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const now = Date.now();
    // A mais ANTIGA primeiro: quem esperou mais tempo pela internet é quem tem
    // mais chance de estar prestes a ser apagada pela idade.
    const due = [...state.captures].reverse().find((c) => isEligible(c, state, now));
    if (due) await get().run(due.id);
  },
}));

/** Quantas gravações estão esperando. Seletor, para a Biblioteca não repintar
 *  a cada mudança de fase do envio. */
export function usePendingCount(): number {
  return useCaptureQueue((s) => s.captures.length);
}
