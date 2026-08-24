"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HiddenTabOverlay } from "@/features/session/components/HiddenTabOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import {
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
} from "@/features/session/config";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useVisibilityWarning } from "@/features/session/hooks/useVisibilityWarning";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import { requestFinalSummary, uploadChunkWithRetry } from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { formatMmSs, tailSentences } from "@/features/session/lib/text";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { devLog } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";

/**
 * Audio-only capture. Same chunk-upload/transcribe backbone as the live view
 * but with no live enrichment pipelines (bible/insights/echo), no feed, no
 * header — just the pulsing record button centered on the page. On stop, the
 * final summary runs once and the user lands on /summary.
 *
 * Kept intentionally simple: no session store, no dedup — chunks accumulate
 * locally into `transcriptRef` because the only consumer of the transcript
 * is the single final-summary call.
 */
export function RecordingAudioOnly({
  sessionId,
  initialSpeakerName,
  initialSpeakerLocation,
  autoStart = false,
}: {
  sessionId: string;
  initialSpeakerName: string;
  initialSpeakerLocation: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef<number>(0);
  const chunksRef = useRef<Map<number, string>>(new Map());
  const autoStartFiredRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [startupError, setStartupError] = useState("");

  const elapsedMs = useElapsedTimer(running, startedAtRef);
  useWakeLock({ enabled: running });
  const { warning: hiddenWarning, dismiss: dismissHiddenWarning } = useVisibilityWarning({
    enabled: running,
  });

  const assembleTranscript = useCallback(() => {
    const indices = Array.from(chunksRef.current.keys()).sort((a, b) => a - b);
    return indices
      .map((i) => chunksRef.current.get(i)?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      if (await isSilentBlob(ev.blob)) return;
      const previousText = assembleTranscript();
      const prevHint = tailSentences(previousText, 2);
      const result = await uploadChunkWithRetry(ev, prevHint, sessionId);
      if (result.ok) {
        chunksRef.current.set(ev.index, result.text);
      }
    },
    [assembleTranscript, sessionId]
  );

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    chunksRef.current = new Map();
    setStartupError("");
    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
    });
    rec.onChunk(handleChunk);
    try {
      await rec.start();
      recorderRef.current = rec;
      // startedAtRef MUST be seeded before setRunning(true) so useElapsedTimer
      // observes a valid origin on first render — see AGENTS.md guardrails.
      startedAtRef.current = performance.now();
      setRunning(true);
      devLog("[session:audio] start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId]);

  const stop = useCallback(async () => {
    if (!recorderRef.current) return;
    const durationMs = Math.round(performance.now() - startedAtRef.current);
    setRunning(false);
    await recorderRef.current.stop();
    recorderRef.current = null;

    const transcript = assembleTranscript();
    if (!transcript) {
      toast.error("Nada foi capturado.", {
        description: "Nenhuma fala foi transcrita durante a gravação.",
      });
      return;
    }

    setFinalizing(true);
    try {
      const result = await requestFinalSummary({
        sessionId,
        text: transcript,
        feedItems: [],
        durationMs,
        speakerName: initialSpeakerName,
        speakerLocation: initialSpeakerLocation,
      });
      if (result?.saved) {
        toast.success("Sessão salva", {
          description: result.payload.title || "Resumo disponível no histórico.",
        });
        router.replace(`/recording/${sessionId}/summary`);
      } else if (result) {
        toast.error("Resumo pronto, mas o salvamento falhou.", {
          description: "Verifique o log do servidor.",
        });
      } else {
        toast.error("Não foi possível gerar o resumo.");
      }
    } finally {
      setFinalizing(false);
    }
  }, [assembleTranscript, sessionId, initialSpeakerName, initialSpeakerLocation, router]);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    void start();
  }, [autoStart, start]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />
        {running ? (
          <p className="font-mono text-sm font-medium tabular-nums tracking-wider text-[color:var(--scriba-ink)]">
            {formatMmSs(elapsedMs)}
          </p>
        ) : null}
        {startupError ? (
          <p className="max-w-xs text-center text-sm text-destructive" role="alert">
            {startupError}
          </p>
        ) : null}
      </div>

      {hiddenWarning && running ? <HiddenTabOverlay onDismiss={dismissHiddenWarning} /> : null}
      {finalizing ? <FinalizingOverlay /> : null}
    </main>
  );
}
