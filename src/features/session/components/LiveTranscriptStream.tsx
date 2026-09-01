"use client";

import { useEffect, useRef } from "react";
import { ListeningDots, TranscriptSkeleton } from "@/features/session/components/skeletons";
import { formatMmSs } from "@/features/session/lib/text";
import type { ChunkRow } from "@/features/session/types";
import { cn } from "@/lib/utils";

/**
 * A transcrição acontecendo. Diferente do TranscriptView (que agrupa por
 * minuto para leitura calma dentro de um dialog), aqui CADA CHUNK é uma linha
 * própria que entra na tela no instante em que o /api/transcribe responde —
 * é o feedback principal do modo transcrição, então a granularidade do chunk
 * é o ponto, não um detalhe.
 *
 * Chunks ainda em voo aparecem como skeleton na posição em que o texto vai
 * cair, de modo que a lista nunca "pula" quando a resposta chega. Chunks de
 * silêncio somem — não têm texto para mostrar e só criariam buracos.
 *
 * Autoscroll: enquanto `follow` estiver ligado, cada linha nova rola a
 * janela até o fim. O chamador desliga isso quando o usuário sobe a página
 * para reler algo.
 */
export function LiveTranscriptStream({
  rows,
  running,
  follow,
}: {
  rows: ChunkRow[];
  running: boolean;
  follow: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const visible = rows.filter(
    (r) => r.status === "uploading" || (r.status === "ok" && r.text.trim().length > 0)
  );
  const lastKey = visible.at(-1)?.index ?? -1;

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastKey é o gatilho — cada chunk novo re-ancora o scroll
  useEffect(() => {
    if (!follow) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [follow, lastKey]);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        {running ? (
          <>
            <ListeningDots />
            <p className="text-pretty text-center text-sm font-light text-scriba-ink-mute">
              Escutando. O texto aparece aqui a cada trecho transcrito.
            </p>
          </>
        ) : (
          <p className="text-sm font-light text-scriba-ink-mute">Sem transcrição.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {visible.map((row) => (
          <li key={row.index} className="flex gap-3 sm:gap-4">
            <span
              className={cn(
                "mt-0.5 inline-flex h-5 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-medium tabular-nums",
                row.status === "ok"
                  ? "bg-scriba-hairline-soft text-scriba-ink-mute"
                  : "bg-scriba-blue-soft text-scriba-blue-ink"
              )}
            >
              {formatMmSs(row.startedAtMs)}
            </span>
            {row.status === "ok" ? (
              <p
                className={cn(
                  "min-w-0 flex-1 animate-content-fade text-pretty text-[15px] font-light leading-relaxed text-scriba-ink",
                  // Trecho que o servidor marcou como provável alucinação: o
                  // texto já veio limpo e continua na transcrição, mas fica
                  // atenuado para o leitor conferir com desconfiança.
                  row.suspect && "text-scriba-ink-mute italic"
                )}
              >
                {row.text.trim()}
              </p>
            ) : (
              <div className="min-w-0 flex-1">
                <TranscriptSkeleton />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div ref={bottomRef} className="h-px scroll-mb-28" />
    </div>
  );
}
