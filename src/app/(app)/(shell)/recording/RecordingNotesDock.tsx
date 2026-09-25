"use client";

import { NotebookPen, X } from "lucide-react";
import { memo, useState } from "react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { RECORDING_NOTES_MAX_CHARS, useRecordingNotes } from "./recording-notes";

/**
 * As anotações da pregação, um widget flutuante no canto de baixo à
 * ESQUERDA — o mesmo material de vidro do Biblo e da Bíblia, só que sem
 * equivalente em outra tela do produto, porque só aqui existe algo para
 * anotar enquanto se grava.
 *
 * ## Por que ESQUERDA
 *
 * O canto de baixo à direita já tem dono, o `BibloDock`, e a borda direita já
 * tem a aba da `BibleDock`. Um terceiro disco ali empilharia sobre quem já
 * mora lá; a esquerda está vazia.
 *
 * ## Fechado é um disco, aberto ele VIRA o painel
 *
 * Mesma gramática do `BibloHomeTrigger` e do `CreateDock`: o botão sai da tela
 * quando o painel abre, e o painel tem o próprio fechar — nunca os dois ao
 * mesmo tempo competindo pelo canto.
 *
 * ## Por que um store, e não `useState` aqui dentro
 *
 * O texto mora em `useRecordingNotes` (ver o cabeçalho de lá): é o que
 * garante que abrir, escrever, fechar e reabrir este widget nunca perde uma
 * palavra, e que o `AudioStudio` — que lê as notas por `getState()` a cada
 * pulso de gravação — nunca precisa saber que este componente existe.
 */
function NotesDock() {
  const [open, setOpen] = useState(false);
  const notes = useRecordingNotes((s) => s.notes);
  const setNotes = useRecordingNotes((s) => s.setNotes);
  useKeyboardInset();

  return (
    <>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-start px-4 pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir as notas"
            aria-expanded={false}
            className="pointer-events-auto relative inline-flex size-14 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
          >
            <NotebookPen aria-hidden className="size-5" strokeWidth={1.75} />
            {/* Um ponto discreto avisa que já há algo escrito, sem exigir abrir
                o painel para descobrir — a mesma economia do `hinting` da
                onda em repouso. */}
            {notes.trim() ? (
              <span
                aria-hidden
                className="-top-0.5 -right-0.5 absolute size-2.5 rounded-full bg-v2-accent ring-2 ring-v2-bg"
              />
            ) : null}
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))] z-30 mx-auto flex max-w-sm flex-col gap-2 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] p-4 shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl sm:inset-x-auto sm:left-4 sm:w-80">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-v2-ink">
              <NotebookPen aria-hidden className="size-3.5" strokeWidth={1.75} />
              Notas
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar as notas"
              className="inline-flex size-7 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-glass-edge hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, RECORDING_NOTES_MAX_CHARS))}
            maxLength={RECORDING_NOTES_MAX_CHARS}
            placeholder="Nomes, referências, a frase que você não quer perder…"
            aria-label="Anotações desta gravação"
            className="h-40 resize-none rounded-2xl bg-v2-card p-3 text-[14px] leading-relaxed text-v2-ink placeholder:text-v2-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
          />
          <p className="px-1 text-[11px] font-light leading-snug text-v2-ink-mute">
            O Scriba lê estas notas junto com a transcrição ao escrever o resumo.
          </p>
        </div>
      )}
    </>
  );
}

export const RecordingNotesDock = memo(NotesDock);
