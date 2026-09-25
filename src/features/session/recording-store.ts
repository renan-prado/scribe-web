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
 * ## Quem pergunta, e o que quebra quando a resposta é sempre "não"
 *
 * Duas coisas, e as duas ficaram um tempo sem proteção nenhuma porque
 * **ninguém escrevia neste store**: o `AudioStudio` tinha um `setRunning` no
 * escopo, mas era o do `ClockScope` (o relógio da barra), e o nome sombreado
 * escondeu a ausência. As duas proteções abaixo estavam mortas, sem erro em
 * lugar nenhum, e as duas terminam em gravação perdida:
 *
 * - **A FILA** (`capture-queue.ts`, no `kick()`): ela não pode subir 7 MB e
 *   rodar transcrição e resumo enquanto o microfone está aberto, porque isso
 *   disputa rede e CPU com a única coisa da tela que não pode falhar. Sem o
 *   booleano, uma gravação pendente de domingo passado começava a subir no meio
 *   da pregação de hoje.
 * - **O `BillingDialog`**: abrir o checkout na mesma aba destrói o
 *   `MediaRecorder`. Com a resposta sempre "não há gravação", ele passava
 *   `allowSameTab: true` para o `navigateCheckoutWindow`, e um pop-up bloqueado
 *   (o padrão no PWA do Android) levava a aba da gravação para o Stripe. O pior
 *   dos dois, porque é exatamente o que a tela oferece quando as moedas acabam
 *   no meio da gravação.
 *
 * Um React context não serviria a nenhum dos dois: a fila não mora em tela
 * nenhuma, e o diálogo mora na gaveta da `TopBar`, fora da árvore da tela de
 * gravação.
 *
 * **`running` é mais que "o microfone está aberto".** Ele é "esta aba tem
 * trabalho de gravação vivo", e por isso cobre também a gravação INTERROMPIDA
 * (que espera uma decisão e pode ser retomada) e o ENVIO logo depois do stop.
 * Quem o escreve é o `AudioStudio`, num efeito só.
 */
type RecordingStore = {
  running: boolean;
  setRunning: (running: boolean) => void;
};

export const useRecordingStore = create<RecordingStore>((set) => ({
  running: false,
  setRunning: (running) => set({ running }),
}));
