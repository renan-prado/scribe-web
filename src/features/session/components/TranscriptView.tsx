"use client";

import { useMemo } from "react";
import { ListeningDots, TranscriptSkeleton } from "@/features/session/components/skeletons";
import { groupChunksByMinute } from "@/features/session/lib/chunks";
import { formatMmSs } from "@/features/session/lib/text";
import type { ChunkRow, TranscriptState } from "@/features/session/types";

export function TranscriptView({ rows, state }: { rows: ChunkRow[]; state: TranscriptState }) {
  const groups = useMemo(() => groupChunksByMinute(rows), [rows]);

  return (
    <div className="flex flex-col gap-7">
      {groups.length > 0 ? (
        <ol className="flex flex-col gap-7">
          {groups.map((g) => (
            <li key={g.startedAtMs} className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                {formatMmSs(g.startedAtMs)}
              </span>
              <p className="text-pretty text-sm leading-relaxed text-foreground">{g.text}</p>
            </li>
          ))}
        </ol>
      ) : state === "idle" ? (
        <p className="text-sm text-muted-foreground">Sem transcrição.</p>
      ) : null}
      {state === "transcribing" ? <TranscriptSkeleton /> : null}
      {state === "listening" && groups.length === 0 ? <ListeningDots /> : null}
    </div>
  );
}
