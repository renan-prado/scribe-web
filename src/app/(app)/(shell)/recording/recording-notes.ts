"use client";

import { create } from "zustand";

/**
 * As anotações que quem grava escreve DURANTE a pregação.
 *
 * ## Por que elas moram num store, e não num `useState` do `AudioStudio`
 *
 * Porque a regra desta tela é que nada do bloco de notas, da conversa ou da
 * Bíblia pode repintar o gravador. O `MediaRecorder` mora em refs dentro do
 * `useAudioCapture`, então um render a mais não o interrompe — mas ele arrasta
 * junto a fileira de barras da onda, os controles e o relógio, a cada TECLA
 * digitada numa pregação de uma hora. Com o estado aqui, quem assina é só o
 * painel de notas; o `AudioStudio` lê o valor uma vez, na hora de guardar, por
 * `getState()`, que não cria assinatura nenhuma.
 *
 * ## O que elas viram
 *
 * Contexto ADICIONAL do resumo, e nada mais. Elas não são um segundo resumo nem
 * entram no documento: vão junto da transcrição para o prompt do
 * `/api/final-summary`, marcadas como notas de quem estava lá. É o que permite
 * ao modelo acertar o nome que o áudio não entregou ("o preletor é o Pr. João
 * Marcos") e não perder a ideia que a pessoa achou ser a mais importante.
 *
 * Elas viajam na LINHA da gravação (`CaptureMeta.notes`), e não numa variável
 * da tela: a gravação pode falhar no envio e ser retentada pela fila dois dias
 * depois, de outra tela, e as notas precisam estar lá quando isso acontecer.
 */
type NotesState = {
  notes: string;
  setNotes: (notes: string) => void;
  /** Recomeça do zero. Uma gravação nova não herda as notas da anterior. */
  reset: () => void;
};

export const useRecordingNotes = create<NotesState>((set) => ({
  notes: "",
  setNotes: (notes) => set({ notes }),
  reset: () => set({ notes: "" }),
}));

/** O teto que o schema da rota também declara. Ver `/api/final-summary`. */
export const RECORDING_NOTES_MAX_CHARS = 4000;
