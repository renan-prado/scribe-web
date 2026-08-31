"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestHallucinationReview } from "@/features/session/lib/api";
import type { FeedItem } from "@/lib/domain/feed";
import {
  type HallucinationReview,
  type HallucinationScope,
  MAX_HALLUCINATION_NOTE_CHARS,
} from "@/lib/domain/hallucination";
import { cn } from "@/lib/utils";

const PRIMARY_BUTTON = cn(
  "inline-flex h-9 items-center justify-center rounded-full bg-scriba-blue px-5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,168,240,0.28)] transition-colors",
  "hover:bg-scriba-blue-hover",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30",
  "disabled:cursor-not-allowed disabled:opacity-70"
);

const GHOST_BUTTON = cn(
  "inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-medium text-scriba-ink-soft transition-colors",
  "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/30",
  "disabled:cursor-not-allowed disabled:opacity-60"
);

const DANGER_BUTTON = cn(
  "inline-flex h-9 items-center justify-center rounded-full bg-destructive px-5 text-[13px] font-semibold text-white transition-opacity",
  "hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/30"
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  scope: HallucinationScope;
  /**
   * Escopo live: contexto lido no momento do envio (a transcrição e o feed
   * crescem enquanto o usuário digita). Lido por callback, não por prop, para
   * que o dialog não re-renderize a cada chunk transcrito.
   */
  getLiveContext?: () => { text: string; feedItems: FeedItem[] };
  /** Escopo live: remove do feed os cards que a auditoria reprovou. */
  onRemoveKeys?: (keys: string[]) => number;
  /** Oferecido quando a auditoria conclui que seguir gravando não compensa. */
  onStopRecording?: () => void;
  /** Oferecido quando a auditoria conclui que o resumo salvo tem conserto. */
  onReprocess?: () => void;
};

/**
 * "Algo está errado" — o usuário percebeu que o Scriba entendeu errado e
 * descreve o problema em uma nota curta. A auditoria cruza a nota com a
 * transcrição e responde na própria janela: remove os cards sem apoio no que
 * foi dito, sugere encerrar a gravação, sugere reprocessar o resumo, ou
 * explica por que não dá para agir sozinha.
 *
 * O usuário ouviu o pregador e nós não — por isso a janela nunca discute com
 * ele: ou age, ou explica o limite. E a decisão de encerrar (que interrompe a
 * cobrança de moedas) fica sempre na mão dele, nunca automática.
 */
export function HallucinationReportDialog({
  open,
  onOpenChange,
  sessionId,
  scope,
  getLiveContext,
  onRemoveKeys,
  onStopRecording,
  onReprocess,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<HallucinationReview | null>(null);
  const [removed, setRemoved] = useState(0);
  const [error, setError] = useState("");

  // Cada abertura começa limpa — um veredito antigo na tela faria o usuário
  // achar que a nota nova já foi analisada.
  useEffect(() => {
    if (!open) return;
    setNote("");
    setReview(null);
    setRemoved(0);
    setError("");
    setSubmitting(false);
  }, [open]);

  const trimmed = note.trim();
  const remaining = MAX_HALLUCINATION_NOTE_CHARS - note.length;

  async function handleSubmit() {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError("");
    const live = scope === "live" ? getLiveContext?.() : undefined;
    const result = await requestHallucinationReview({
      sessionId,
      scope,
      note: trimmed,
      text: live?.text,
      feedItems: live?.feedItems,
    });
    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }
    const count =
      result.review.removeKeys.length > 0 ? (onRemoveKeys?.(result.review.removeKeys) ?? 0) : 0;
    setRemoved(count);
    setReview(result.review);
    setSubmitting(false);
  }

  const showStop = review?.verdict === "suggest_stop" && Boolean(onStopRecording);
  const showReprocess = review?.verdict === "suggest_reprocess" && Boolean(onReprocess);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-600" />
            Algo está errado
          </DialogTitle>
          <DialogDescription>
            {review
              ? "Resultado da análise."
              : "Conte em poucas palavras o que o Scriba entendeu errado. Vou conferir na transcrição."}
          </DialogDescription>
        </DialogHeader>

        {review ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-scriba-ink">{review.message}</p>
            {removed > 0 ? (
              <p className="text-xs font-medium text-scriba-ink-mute">
                {removed === 1 ? "1 card removido do feed." : `${removed} cards removidos do feed.`}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              className={cn(
                "min-h-24 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none",
                "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              value={note}
              maxLength={MAX_HALLUCINATION_NOTE_CHARS}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: ele não citou Tiago, o texto lido foi Efésios 2. E a frase em destaque ele nunca falou."
              disabled={submitting}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  remaining <= 20 ? "text-amber-600" : "text-scriba-ink-mute"
                )}
              >
                {remaining} caracteres restantes
              </span>
              {error ? (
                <span className="text-[11px] text-destructive" role="alert">
                  {error}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter>
          {review ? (
            <>
              <button type="button" onClick={() => onOpenChange(false)} className={GHOST_BUTTON}>
                Fechar
              </button>
              {showStop ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onStopRecording?.();
                  }}
                  className={DANGER_BUTTON}
                >
                  Encerrar gravação
                </button>
              ) : null}
              {showReprocess ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onReprocess?.();
                  }}
                  className={PRIMARY_BUTTON}
                >
                  Reprocessar resumo
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className={GHOST_BUTTON}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!trimmed || submitting}
                className={PRIMARY_BUTTON}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Analisando…
                  </>
                ) : (
                  "Enviar"
                )}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
