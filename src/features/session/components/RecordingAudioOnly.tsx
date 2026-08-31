"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { PausedOverlay } from "@/features/session/components/PausedOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import {
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
  TRANSCRIBE_ESCALATION_BAD_COUNT,
  TRANSCRIBE_ESCALATION_WINDOW,
} from "@/features/session/config";
import { useBackgroundKeepalive } from "@/features/session/hooks/useBackgroundKeepalive";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import {
  requestDeleteSession,
  requestFinalSummary,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
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
type RecordingAudioOnlyProps = {
  sessionId: string;
  initialSpeakerName: string;
  initialSpeakerLocation: string;
  autoStart?: boolean;
};

export function RecordingAudioOnly({
  sessionId,
  initialSpeakerName,
  initialSpeakerLocation,
  autoStart = false,
}: RecordingAudioOnlyProps) {
  const router = useRouter();
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef<number>(0);
  /** Active-recording elapsed ms captured the instant we entered pause; used
   * to re-anchor `startedAtRef` on resume so the timer picks up where it
   * stopped (paused time is not counted). */
  const pausedElapsedRef = useRef<number>(0);
  /** Next chunk index to hand to the recorder created on resume. */
  const nextChunkIndexRef = useRef<number>(0);
  const chunksRef = useRef<Map<number, { text: string; suspect: boolean; escalated: boolean }>>(
    new Map()
  );
  /** Tier de transcrição da sessão. Promovido (pegajoso) quando uma sequência
   * de chunks sai ruim — mesmo critério do modo live, mas em ref local porque
   * este modo não usa o session store. */
  const tierRef = useRef<"standard" | "escalated">("standard");
  const autoStartFiredRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [qualityPoor, setQualityPoor] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const activelyRecording = running && !paused;
  const elapsedMs = useElapsedTimer(activelyRecording, startedAtRef);
  useWakeLock({ enabled: activelyRecording });

  const assembleTranscript = useCallback((opts?: { excludeSuspect?: boolean }) => {
    const indices = Array.from(chunksRef.current.keys()).sort((a, b) => a - b);
    return indices
      .map((i) => chunksRef.current.get(i))
      .filter(
        (c): c is { text: string; suspect: boolean; escalated: boolean } =>
          Boolean(c) && !(opts?.excludeSuspect && c?.suspect)
      )
      .map((c) => c.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      if (await isSilentBlob(ev.blob)) return;
      // Chunks suspeitos (assinatura de alucinação detectada no servidor) não
      // entram no hint — realimentá-los tende a repetir a alucinação.
      const previousText = assembleTranscript({ excludeSuspect: true });
      const prevHint = tailSentences(previousText, 2);
      const result = await uploadChunkWithRetry(ev, prevHint, sessionId, tierRef.current);
      if (result.ok) {
        chunksRef.current.set(ev.index, {
          text: result.text,
          suspect: result.suspect,
          escalated: result.escalated,
        });
        if (tierRef.current === "standard") {
          const recent = Array.from(chunksRef.current.keys())
            .sort((a, b) => a - b)
            .slice(-TRANSCRIBE_ESCALATION_WINDOW)
            .map((i) => chunksRef.current.get(i));
          const bad = recent.filter((c) => c && (c.suspect || c.escalated)).length;
          if (bad >= TRANSCRIBE_ESCALATION_BAD_COUNT) {
            tierRef.current = "escalated";
            setQualityPoor(true);
            devLog("[session:audio] transcribe escalated", { index: ev.index });
            toast.warning("Áudio com qualidade baixa detectada.", {
              description:
                "Ativamos um modelo de transcrição mais preciso para os próximos trechos.",
            });
          }
        }
      }
    },
    [assembleTranscript, sessionId]
  );

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    chunksRef.current = new Map();
    tierRef.current = "standard";
    nextChunkIndexRef.current = 0;
    pausedElapsedRef.current = 0;
    setStartupError("");
    setQualityPoor(false);
    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
      startingIndex: 0,
    });
    rec.onChunk(handleChunk);
    try {
      await rec.start();
      recorderRef.current = rec;
      // startedAtRef MUST be seeded before setRunning(true) so useElapsedTimer
      // observes a valid origin on first render — see AGENTS.md guardrails.
      startedAtRef.current = performance.now();
      setRunning(true);
      setPaused(false);
      devLog("[session:audio] start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId]);

  const pause = useCallback(async () => {
    if (!recorderRef.current || paused) return;
    pausedElapsedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    const indices = Array.from(chunksRef.current.keys());
    nextChunkIndexRef.current = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    setPaused(true);
    await recorderRef.current.stop();
    recorderRef.current = null;
    devLog("[session:audio] pause", {
      sessionId,
      elapsedMs: pausedElapsedRef.current,
      nextChunkIndex: nextChunkIndexRef.current,
    });
  }, [paused, sessionId]);

  const resume = useCallback(async () => {
    if (recorderRef.current || !paused) return;
    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
      startingIndex: nextChunkIndexRef.current,
    });
    rec.onChunk(handleChunk);
    try {
      await rec.start();
      recorderRef.current = rec;
      startedAtRef.current = performance.now() - pausedElapsedRef.current;
      setPaused(false);
      devLog("[session:audio] resume", {
        sessionId,
        elapsedMs: pausedElapsedRef.current,
        nextChunkIndex: nextChunkIndexRef.current,
      });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to resume");
    }
  }, [handleChunk, paused, sessionId]);

  const stop = useCallback(async () => {
    if (!recorderRef.current && !paused) return;
    const durationMs = paused
      ? pausedElapsedRef.current
      : Math.round(performance.now() - startedAtRef.current);
    setRunning(false);
    setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    const transcript = assembleTranscript();
    if (!transcript) {
      // Nothing intelligible was captured — skip the final-summary LLM call
      // and delete the empty session row so the user doesn't see it in their
      // history.
      toast.warning("Nenhuma fala foi capturada.", {
        description: "A gravação foi descartada sem gerar resumo.",
      });
      void requestDeleteSession(sessionId);
      router.replace("/list");
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
  }, [assembleTranscript, paused, sessionId, initialSpeakerName, initialSpeakerLocation, router]);

  // Coin billing: 2 moedas/min (per started minute). While paused billing is
  // frozen; `useCoinTick` preserves the current minute so resuming does not
  // trigger an extra debit.
  useCoinTick({
    enabled: activelyRecording,
    reason: "audio_only_minute",
    sessionId,
    onDepleted: () => {
      toast.warning("Saldo de moedas esgotado.", {
        description: "Gravação finalizada automaticamente.",
      });
      void stop();
    },
  });

  // Background-recording defenses (silent audio + Media Session + RN bridge)
  // and browser close-confirmation. See hook docs for full rationale.
  useBackgroundKeepalive({
    enabled: activelyRecording,
    sessionId,
    label: initialSpeakerName || "Gravando áudio",
    onExternalStop: () => void stop(),
  });
  useUnloadGuard(running);

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
    <main className="relative flex flex-1 flex-col items-center justify-center px-6">
      {running ? (
        <div className="absolute right-4 top-4">
          <SessionMenu
            hasTranscript={false}
            hasLiveFeed={false}
            onOpenTranscript={() => undefined}
            onOpenLiveFeed={() => undefined}
            onReportHallucination={() => setReportOpen(true)}
          />
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-10">
        <RecordButton
          running={running}
          elapsedMs={elapsedMs}
          onStart={start}
          onStop={stop}
          onPause={running && !paused ? pause : undefined}
          pulseWhileRunning
          autoStarting={autoStart && !running && !startupError}
        />
        {running && !paused ? (
          <p className="font-mono text-sm font-medium tabular-nums tracking-wider text-scriba-ink">
            {formatMmSs(elapsedMs)}
          </p>
        ) : null}
        {startupError ? (
          <p className="max-w-xs text-center text-sm text-destructive" role="alert">
            {startupError}
          </p>
        ) : null}
        {running && qualityPoor ? (
          <div
            role="status"
            className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
          >
            <p className="font-semibold">Áudio com qualidade baixa</p>
            <p className="mt-1">
              A transcrição pode conter erros. Ativamos um modelo mais preciso — se possível,
              aproxime o aparelho do som. Você pode continuar ou encerrar a gravação.
            </p>
          </div>
        ) : null}
      </div>

      <HallucinationReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={sessionId}
        scope="live"
        // Modo áudio: não há feed para corrigir, então a auditoria julga só a
        // qualidade da transcrição — o desfecho útil aqui é encerrar ou seguir.
        getLiveContext={() => ({ text: assembleTranscript(), feedItems: [] })}
        onStopRecording={() => void stop()}
      />

      {running && paused ? (
        <PausedOverlay elapsedMs={elapsedMs} onResume={() => void resume()} onStop={stop} />
      ) : null}
      {finalizing ? <FinalizingOverlay /> : null}
    </main>
  );
}
