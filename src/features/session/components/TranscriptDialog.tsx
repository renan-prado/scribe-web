"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";

/**
 * O dialog da transcrição, e quem vai BUSCÁ-LA quando ele abre.
 *
 * ## Por que ela não vem junto com a página
 *
 * A transcrição viajava como prop do `SavedSessionView`, ou seja, dentro do
 * payload de toda abertura de `/summary/:id`: um sermão de quarenta minutos são
 * dezenas de KB de texto descendo pelo fio, no meio da igreja, num 3G, para
 * preencher uma gaveta que só abre pelo menu de três pontinhos. Dos três usos
 * que a tela fazia dela, dois perguntavam apenas se ela EXISTE.
 *
 * Agora a página manda `hasTranscript` (uma coluna gerada, ver a migração 0061)
 * e o texto vem por `GET /api/sessions/:id/transcript` no instante em que
 * alguém pede para vê-lo. Quem abre este dialog escolheu abri-lo e aceita
 * esperar; quem não abre — quase todo mundo — deixou de pagar por ele.
 *
 * É também o que torna o resumo leve o bastante para ser adiantado no toque e
 * guardado no cliente. Ver `features/session/query`.
 *
 * ## A busca acontece uma vez por montagem
 *
 * Fechar e reabrir o dialog não busca de novo: o texto fica no estado enquanto
 * a tela viver. Uma transcrição não muda sozinha — só um reprocessamento a
 * reescreveria, e ele recarrega a página inteira.
 */
export function TranscriptDialog({
  sessionId,
  durationMs,
  open,
  onOpenChange,
}: {
  sessionId: string;
  durationMs: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || transcript !== null) return;
    let alive = true;
    setFailed(false);
    fetch(`/api/sessions/${sessionId}/transcript`)
      .then((r) => (r.ok ? (r.json() as Promise<{ transcript: string }>) : Promise.reject()))
      .then((data) => {
        if (alive) setTranscript(data.transcript);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, sessionId, transcript]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transcrição</DialogTitle>
          <DialogDescription className="sr-only">
            Texto bruto capturado pelo microfone.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-2">
          {transcript !== null ? (
            <SavedTranscriptView transcript={transcript} durationMs={durationMs} />
          ) : failed ? (
            <p className="py-8 text-center text-[14px] text-scriba-ink-soft">
              Não consegui carregar a transcrição. Feche e tente de novo.
            </p>
          ) : (
            // A altura é a mesma do estado cheio no primeiro parágrafo, para o
            // dialog não crescer de tamanho debaixo da mão de quem o abriu.
            <div className="flex items-center justify-center gap-2 py-16 text-scriba-ink-soft">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              <span className="text-[14px]">Carregando a transcrição…</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
