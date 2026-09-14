"use client";

import { create } from "zustand";

/**
 * Existe UMA gravação por aba, e este é o único lugar que sabe se ela está
 * correndo.
 *
 * É o resto de um store de 500 linhas que guardava a fila de chunks, os cards
 * do feed ao vivo, os contadores de cada pipeline e o veredito de áudio. Tudo
 * isso morreu junto com os três modos de captura; sobrou o único fato que
 * alguém de FORA da tela de gravação precisa saber.
 *
 * Quem pergunta é o `BillingDialog`: abrir o checkout na mesma aba destruiria o
 * `MediaRecorder` no meio da pregação, então ele só navega esta aba quando não
 * há gravação viva. Um React context não serviria, o diálogo mora na gaveta da
 * `TopBar`, fora da árvore da tela de gravação.
 */
type RecordingStore = {
  running: boolean;
  setRunning: (running: boolean) => void;
};

export const useRecordingStore = create<RecordingStore>((set) => ({
  running: false,
  setRunning: (running) => set({ running }),
}));
