"use client";

import { Download, Loader2, RotateCw, Trash2, TriangleAlert, WifiOff } from "lucide-react";
import { useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { useCaptureQueue } from "../capture-queue";
import { type CaptureMeta, downloadCapture } from "../lib/capture-store";
import { formatDurationLong, shortDate } from "../lib/formatting";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * O post-it de uma gravação que ainda NÃO virou resumo.
 *
 * ## Por que ele existe
 *
 * Porque guardar o áudio nunca bastou. Ele sempre foi guardado, e mesmo assim
 * uma pregação de quase uma hora foi dada por perdida: a gravação existia só
 * dentro da tela de gravação, e quem saiu de lá depois da falha de rede não
 * tinha, em nenhum lugar do app, uma frase dizendo que o áudio continuava ali.
 * Este cartão é essa frase, no lugar onde a pessoa volta todo dia.
 *
 * ## Por que ele é um post-it, e não um alerta
 *
 * Porque é isso que ele é: uma gravação, na lista das gravações. Uma faixa
 * vermelha no topo da Biblioteca seria um erro para ser dispensado; um cartão
 * é uma coisa que ainda existe, e que vai ficar existindo até virar resumo. Ele
 * usa a face LIMÃO, a mais quente das quatro, e ganha um fio na borda que os
 * post-its claros não têm: na varredura da tela ele lê como post-it, e no
 * segundo olhar como um post-it que ainda não está pronto.
 *
 * **Ele não é um link, e essa é a diferença de anatomia que impede o reuso do
 * `PostItNote`.** Aquele cartão é um `<a>` em volta de tudo, deliberadamente,
 * porque não tem botão nenhum dentro; este é três botões e nenhum destino, e
 * botão dentro de link é HTML inválido e armadilha de teclado. Foi exatamente
 * por isso que o menu de três pontinhos saiu do post-it no seu dia.
 *
 * ## As três ações, e por que BAIXAR fica junto das outras duas
 *
 * Baixar é a única que não depende de nada dar certo: a rede pode continuar
 * fora, o saldo pode estar zerado, a rota pode recusar o tamanho, e o arquivo
 * sai do aparelho assim mesmo. É a garantia de último recurso, e ela vale
 * pouco escondida atrás de um menu na tela em que ninguém olha.
 */
type Props = {
  capture: CaptureMeta;
  now: Date;
};

/**
 * O que a pessoa precisa saber, em uma linha, por estado.
 *
 * A frase de falha vem GRAVADA na linha da gravação (`failureMessage`), e não é
 * montada aqui: quem sabe distinguir "sua internet caiu" de "nosso servidor
 * caiu" de "acabaram suas moedas" é o `capture-upload`, que viu a resposta.
 * Reclassificar aqui seria adivinhar duas vezes a mesma coisa, e num dia a
 * tela e a fila discordariam sobre o que aconteceu.
 */
const PHASE_LABEL = {
  creating: "Guardando a gravação…",
  transcribing: "Transcrevendo o áudio…",
  summarizing: "Montando o resumo…",
} as const;

export function PendingCaptureNote({ capture, now }: Props) {
  const uploading = useCaptureQueue((s) => s.uploading === capture.id);
  const phase = useCaptureQueue((s) => s.phase);
  const run = useCaptureQueue((s) => s.run);
  const drop = useCaptureQueue((s) => s.drop);
  const busyElsewhere = useCaptureQueue((s) => s.uploading !== null && s.uploading !== capture.id);
  const [confirmDrop, setConfirmDrop] = useState(false);

  const duration = formatDurationLong(capture.durationMs);
  const includeYear = new Date(capture.createdAt).getFullYear() !== now.getFullYear();
  const working = uploading && phase !== null;

  return (
    <li className="mb-4 break-inside-avoid rounded-2xl bg-v2-note-lemon ring-1 ring-inset ring-v2-note-lemon-ink/25">
      <div className="flex flex-col rounded-2xl p-4 text-v2-note-lemon-ink">
        {/* A moldura do post-it comum é o AUTOR; aqui é o estado, porque é a
            única informação que este cartão tem e o outro não. Ela vem com o
            glifo do próprio botão de gravar: o cartão fala da mesma coisa que o
            microfone do rodapé produziu. */}
        <span className="mb-3 flex items-center gap-1.5 text-[11px] font-light leading-none text-v2-note-lemon-mute">
          <MicGlyph className="size-3 shrink-0" />
          Ainda não processada
        </span>

        <span className="text-pretty text-[17px] font-normal leading-normal tracking-tight">
          {duration ? `Gravação de ${duration}` : "Gravação guardada neste aparelho"}
        </span>

        {/* A linha que diz o que está acontecendo AGORA. Ela é a razão do
            cartão existir, então fica no corpo e não no rodapé apagado. */}
        <span className="mt-3 flex items-start gap-1.5 text-[12px] font-light leading-snug">
          {working ? (
            <>
              <Loader2 aria-hidden className="mt-px size-3.5 shrink-0 animate-spin" />
              {PHASE_LABEL[phase]}
            </>
          ) : capture.failure === "offline" ? (
            <>
              <WifiOff aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              {capture.failureMessage}
            </>
          ) : capture.failureMessage ? (
            <>
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              {capture.failureMessage}
            </>
          ) : (
            <>
              <Loader2 aria-hidden className="mt-px size-3.5 shrink-0 animate-spin" />
              {busyElsewhere
                ? "Na fila, logo depois da gravação que está subindo."
                : "Na fila para ser transcrita e resumida."}
            </>
          )}
        </span>

        {/* Os três botões, no tom do papel. Eles são pequenos porque o cartão é
            estreito (~230px na coluna mais larga do mural) e porque o caminho
            normal desta gravação é o Scriba resolvê-la sozinho: quem toca aqui
            é quem não quer esperar, ou quem quer o arquivo na mão.

            **Duas linhas, e não uma.** Os três lado a lado cabiam na coluna
            larga do mural e não cabiam no celular: o rótulo "Tentar agora"
            tem um comprimento fixo, e espremido entre dois botões redondos
            ele estourava a largura do cartão e empurrava os ícones para fora.
            Empilhar resolve pela ANATOMIA em vez de por um ponto de quebra —
            a ação principal ocupa a linha inteira em qualquer largura, e as
            duas de ícone dividem a linha de baixo em partes iguais. */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => void run(capture.id, { force: true })}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-v2-note-lemon-ink/10 px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-v2-note-lemon-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-40"
          >
            <RotateCw aria-hidden className="size-3.5" strokeWidth={2} />
            Tentar agora
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadCapture(capture)}
              aria-label="Baixar o áudio desta gravação"
              title="Baixar o áudio"
              className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-v2-note-lemon-ink/10 transition-colors hover:bg-v2-note-lemon-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              <Download aria-hidden className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setConfirmDrop(true)}
              aria-label="Apagar esta gravação"
              title="Apagar"
              className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-v2-note-lemon-ink/10 text-v2-note-lemon-mute transition-colors hover:bg-v2-note-lemon-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-40"
            >
              <Trash2 aria-hidden className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-light text-v2-note-lemon-mute">
          {shortDate(new Date(capture.createdAt).toISOString(), includeYear)}
        </span>
      </div>

      <ConfirmDialog
        open={confirmDrop}
        onOpenChange={setConfirmDrop}
        title="Apagar a gravação que não foi transcrita?"
        description="Este é o único arquivo desta gravação. Apagando, ele some do aparelho e não volta. Se ainda não baixou o áudio, baixe antes."
        confirmLabel="Apagar"
        onConfirm={() => drop(capture.id)}
      />
    </li>
  );
}
