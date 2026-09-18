"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportLexiconEntry } from "@/features/session/lib/api";
import { LEXICON_REPORT_MAX_CHARS } from "@/lib/domain/lexicon";
import { cn } from "@/lib/utils";

/**
 * "Algo está errado" num cartão do léxico.
 *
 * ## Ele PARECE o alerta de alucinação e não é
 *
 * O `HallucinationReportDialog` manda a nota para um modelo, que cruza o que
 * foi escrito com a TRANSCRIÇÃO e responde na própria janela — removendo o que
 * não tem apoio, sugerindo reprocessar, ou explicando o limite. Ali há o que
 * auditar: o texto foi escrito por uma IA a partir de um áudio que existe.
 *
 * Aqui não há nada disso. O conteúdo do léxico foi escrito à mão no painel, e a
 * única resposta possível é uma pessoa ler e corrigir. Então esta janela não
 * promete análise nenhuma: ela recebe o recado, agradece e fecha. **Fingir que
 * há uma apuração em curso seria pior que não ter o botão** — a pessoa esperaria
 * uma resposta que nunca vem.
 *
 * ## O que ela diz depois de enviar
 *
 * "Recebi, vou conferir" — e não "obrigado pelo feedback". Quem parou de ler
 * para escrever que a data está errada quer saber que aquilo chegou a alguém,
 * não ser agradecido por uma caixa de diálogo.
 *
 * ## Por que o estado não vira uma máquina
 *
 * Três estados (escrevendo, enviando, enviado) e só. Não há tratamento de erro
 * com nova tentativa: se a rede falhar, a janela avisa e o texto continua lá
 * para um segundo toque. Uma fila de reenvio para um recado de uma linha seria
 * mais mecanismo que conteúdo.
 */
export function LexiconReportDialog({
  slug,
  term,
  open,
  onOpenChange,
}: {
  slug: string;
  /** O nome como ele aparece no cartão, para a janela dizer sobre o que é. */
  term: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  // Cada abertura começa limpa. Sem isto, reabrir depois de um envio mostraria o
  // agradecimento de antes, como se o alerta novo já tivesse sido mandado.
  useEffect(() => {
    if (!open) return;
    setNote("");
    setSending(false);
    setSent(false);
    setFailed(false);
  }, [open]);

  const trimmed = note.trim();

  async function handleSubmit() {
    if (trimmed.length < 3 || sending) return;
    setSending(true);
    setFailed(false);
    const ok = await reportLexiconEntry({ slug, note: trimmed });
    setSending(false);
    if (ok) setSent(true);
    else setFailed(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-600" />
            Algo está errado
          </DialogTitle>
          <DialogDescription>
            {sent
              ? "Recebi o alerta."
              : `O que está errado em "${term}"? Isto vai direto para quem escreveu.`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <p className="text-sm leading-relaxed text-scriba-ink">
            Obrigado por avisar. Vou conferir e corrigir o texto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, LEXICON_REPORT_MAX_CHARS))}
              disabled={sending}
              rows={4}
              autoFocus
              placeholder="A data está errada, esse não é o Timóteo certo, falta dizer que…"
              className={cn(
                "w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none",
                "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            />
            {failed ? (
              <p className="text-[12px] text-destructive">
                Não consegui enviar. O texto continua aqui, tente de novo.
              </p>
            ) : (
              <p className="text-right text-[11px] text-scriba-ink-mute">
                {note.length}/{LEXICON_REPORT_MAX_CHARS}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {sent ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <Button
              type="button"
              disabled={trimmed.length < 3 || sending}
              onClick={() => void handleSubmit()}
            >
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
