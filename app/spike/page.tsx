"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudioPlayer } from "@/features/session/components/AudioPlayer";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { Greeting } from "@/features/session/components/Greeting";
import { HiddenTabOverlay } from "@/features/session/components/HiddenTabOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { RecordingHeader } from "@/features/session/components/RecordingHeader";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { StatusPhrases } from "@/features/session/components/StatusPhrases";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TranscriptView } from "@/features/session/components/TranscriptView";
import {
  CONSOLIDATE_EVERY_N_CHUNKS,
  CONSOLIDATE_PULSE_MS,
  INSIGHTS_EVERY_N_CHUNKS,
  RECENT_TRANSCRIPT_CHARS,
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
  SUMMARY_EVERY_N_CHUNKS,
  SUMMARY_WARMUP_CHUNKS,
} from "@/features/session/config";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useVisibilityWarning } from "@/features/session/hooks/useVisibilityWarning";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import {
  requestSummary as apiRequestSummary,
  requestConsolidate,
  requestInsights,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import {
  applyProposalsToPayload,
  collectAffectedIndices,
  mergeInsights,
  remapInsightsForProposals,
} from "@/features/session/lib/proposals";
import { tailSentences, tailTranscript } from "@/features/session/lib/text";
import type { ChunkRow, FinalAudio, TranscriptState } from "@/features/session/types";
import type { Insight } from "@/lib/domain/insights";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

export default function SpikePage() {
  const recorderRef = useRef<Recorder | null>(null);
  const chunksRef = useRef<Map<number, ChunkRow>>(new Map());
  const startedAtRef = useRef<number>(0);
  const lastSummaryChunkRef = useRef(0);
  const lastInsightsChunkRef = useRef(0);
  const lastConsolidateChunkRef = useRef(0);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [running, setRunning] = useState(false);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [finalAudio, setFinalAudio] = useState<FinalAudio | null>(null);
  const [startupError, setStartupError] = useState<string>("");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [recordingStartedAt, setRecordingStartedAt] = useState<Date | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insighting, setInsighting] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [pendingIndices, setPendingIndices] = useState<Set<number>>(() => new Set());
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);

  const elapsedMs = useElapsedTimer(running, startedAtRef);
  useWakeLock({ enabled: running });
  const { warning: hiddenWarning, dismiss: dismissHiddenWarning } = useVisibilityWarning({
    enabled: running,
  });

  const publish = useCallback(() => {
    const rows = Array.from(chunksRef.current.values()).sort((a, b) => a.index - b.index);
    setChunkRows(rows);
  }, []);

  const transcript = useMemo(() => {
    return chunkRows
      .filter((r) => r.status === "ok")
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, [chunkRows]);

  const okChunkCount = useMemo(
    () => chunkRows.filter((r) => r.status === "ok").length,
    [chunkRows]
  );

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

  const requestSummaryAndCommit = useCallback(
    async (body: Parameters<typeof apiRequestSummary>[0]): Promise<SummaryPayload | null> => {
      const next = await apiRequestSummary(body);
      if (!next) return null;
      setSummary(next);
      if (next.title) setSummaryTitle(next.title);
      return next;
    },
    []
  );

  useEffect(() => {
    // Only auto-summarize while the recording is live. Once stopped, any
    // late-arriving chunk transcription must not overwrite the finalized
    // summary (with its conclusion block).
    if (!running || !transcript || summarizing || finalizing) return;
    // Don't overwrite blocks while the consolidator is running or pulsing —
    // any in-flight summary response would clobber the pending merge/refine
    // that the user is being warned about.
    if (consolidating || pendingIndices.size > 0) return;
    const withinWarmup = okChunkCount > 0 && okChunkCount <= SUMMARY_WARMUP_CHUNKS;
    const dueForSummary =
      (withinWarmup || (okChunkCount > 0 && okChunkCount % SUMMARY_EVERY_N_CHUNKS === 0)) &&
      lastSummaryChunkRef.current !== okChunkCount;
    if (!dueForSummary) return;
    lastSummaryChunkRef.current = okChunkCount;
    setSummarizing(true);
    const elapsedSec = Math.floor((performance.now() - startedAtRef.current) / 1000);
    const previous = summary ?? undefined;
    const recent = tailTranscript(transcript, RECENT_TRANSCRIPT_CHARS);
    void requestSummaryAndCommit({ text: recent, elapsedSec, previous }).finally(() =>
      setSummarizing(false)
    );
  }, [
    running,
    okChunkCount,
    transcript,
    summarizing,
    finalizing,
    summary,
    requestSummaryAndCommit,
    consolidating,
    pendingIndices,
  ]);

  useEffect(() => {
    if (!running || insighting) return;
    if (consolidating || pendingIndices.size > 0) return;
    const blocks = summary?.blocks ?? [];
    if (blocks.length === 0) return;
    const dueForInsights =
      okChunkCount > 0 &&
      okChunkCount % INSIGHTS_EVERY_N_CHUNKS === 0 &&
      lastInsightsChunkRef.current !== okChunkCount;
    if (!dueForInsights) return;
    lastInsightsChunkRef.current = okChunkCount;
    setInsighting(true);
    const existingInsightIndices = insights.map((i) => i.targetBlockIndex);
    const recent = tailTranscript(transcript, RECENT_TRANSCRIPT_CHARS);
    void requestInsights({ text: recent, blocks, existingInsightIndices })
      .then((incoming) => {
        if (incoming.length > 0) setInsights((prev) => mergeInsights(prev, incoming));
      })
      .finally(() => setInsighting(false));
  }, [
    okChunkCount,
    running,
    transcript,
    summary,
    insighting,
    insights,
    consolidating,
    pendingIndices,
  ]);

  const runConsolidate = useCallback(
    async (opts: { isFinal?: boolean } = {}): Promise<void> => {
      const currentBlocks = summary?.blocks ?? [];
      if (currentBlocks.length < 3) return;
      const paragraphCount = currentBlocks.filter((b) => b.type === "paragraph").length;
      if (paragraphCount < 3) return;
      setConsolidating(true);
      try {
        const proposals = await requestConsolidate({
          blocks: currentBlocks,
          isFinal: !!opts.isFinal,
        });
        if (proposals.length === 0) return;
        const affected = collectAffectedIndices(proposals);
        setPendingIndices(new Set(affected));
        await new Promise<void>((resolve) => {
          pulseTimerRef.current = setTimeout(() => {
            pulseTimerRef.current = null;
            resolve();
          }, CONSOLIDATE_PULSE_MS);
        });
        setSummary((prev) => (prev ? applyProposalsToPayload(prev, proposals) : prev));
        setInsights((prev) => remapInsightsForProposals(prev, proposals));
        setPendingIndices(new Set());
      } catch {
        setPendingIndices(new Set());
      } finally {
        setConsolidating(false);
      }
    },
    [summary]
  );

  useEffect(() => {
    if (!running || consolidating || summarizing || finalizing) return;
    if (pendingIndices.size > 0) return;
    const blocks = summary?.blocks ?? [];
    if (blocks.length < 3) return;
    const dueForConsolidate =
      okChunkCount > 0 &&
      okChunkCount % CONSOLIDATE_EVERY_N_CHUNKS === 0 &&
      lastConsolidateChunkRef.current !== okChunkCount;
    if (!dueForConsolidate) return;
    lastConsolidateChunkRef.current = okChunkCount;
    void runConsolidate();
  }, [
    okChunkCount,
    running,
    summary,
    consolidating,
    summarizing,
    finalizing,
    pendingIndices,
    runConsolidate,
  ]);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      const startedAtMs = Math.max(0, ev.startedAt - startedAtRef.current);
      const row: ChunkRow = {
        index: ev.index,
        status: "uploading",
        text: "",
        startedAtMs,
      };
      chunksRef.current.set(ev.index, row);
      publish();

      if (await isSilentBlob(ev.blob)) {
        chunksRef.current.set(ev.index, { ...row, status: "silence" });
        publish();
        return;
      }

      const previousText = Array.from(chunksRef.current.values())
        .filter((r) => r.index < ev.index && r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text)
        .join(" ");
      const prevHint = tailSentences(previousText, 2);

      const result = await uploadChunkWithRetry(ev, prevHint);
      const current = chunksRef.current.get(ev.index);
      if (!current) return;
      if (result.ok) {
        chunksRef.current.set(ev.index, { ...current, status: "ok", text: result.text });
      } else {
        chunksRef.current.set(ev.index, { ...current, status: "error" });
      }
      publish();
    },
    [publish]
  );

  const start = useCallback(async () => {
    if (running) return;
    setStartupError("");
    setFinalAudio(null);
    setChunkRows([]);
    setSummary(null);
    setSummaryTitle("");
    setRecordingStartedAt(new Date());
    setInsights([]);
    setPendingIndices(new Set());
    setConsolidating(false);
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    lastSummaryChunkRef.current = 0;
    lastInsightsChunkRef.current = 0;
    lastConsolidateChunkRef.current = 0;
    chunksRef.current = new Map();

    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
    });
    rec.onChunk(handleChunk);
    rec.onFinalAudio((ev) => {
      const url = URL.createObjectURL(ev.blob);
      setFinalAudio({ url, extension: ev.extension, sizeBytes: ev.blob.size });
    });

    try {
      await rec.start();
      recorderRef.current = rec;
      startedAtRef.current = performance.now();
      setRunning(true);
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, running]);

  const stop = useCallback(async () => {
    if (!running) return;
    setRunning(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    const finalTranscript = Array.from(chunksRef.current.values())
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!finalTranscript) return;

    const elapsedSec = Math.floor((performance.now() - startedAtRef.current) / 1000);
    const previous = summary ?? undefined;
    setFinalizing(true);
    try {
      let finalPayload = await requestSummaryAndCommit({
        text: finalTranscript,
        isFinal: true,
        elapsedSec,
        previous,
      });
      let localInsights = insights;
      if (finalPayload && finalPayload.blocks.length >= 3) {
        try {
          const proposals = await requestConsolidate({
            blocks: finalPayload.blocks,
            isFinal: true,
          });
          if (proposals.length > 0) {
            setPendingIndices(new Set(collectAffectedIndices(proposals)));
            await new Promise<void>((resolve) => {
              pulseTimerRef.current = setTimeout(() => {
                pulseTimerRef.current = null;
                resolve();
              }, CONSOLIDATE_PULSE_MS);
            });
            const applied = applyProposalsToPayload(finalPayload, proposals);
            setSummary(applied);
            localInsights = remapInsightsForProposals(localInsights, proposals);
            setInsights(localInsights);
            setPendingIndices(new Set());
            finalPayload = applied;
          }
        } catch {
          setPendingIndices(new Set());
        }
      }
      if (finalPayload && finalPayload.blocks.length > 0) {
        const existingInsightIndices = localInsights.map((i) => i.targetBlockIndex);
        const incoming = await requestInsights({
          text: finalTranscript,
          blocks: finalPayload.blocks,
          existingInsightIndices,
        });
        if (incoming.length > 0) setInsights((prev) => mergeInsights(prev, incoming));
      }
    } finally {
      setFinalizing(false);
    }
  }, [requestSummaryAndCommit, running, summary, insights]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      void recorderRef.current?.stop();
    };
  }, []);

  const hasStarted = running || chunkRows.length > 0 || finalAudio !== null;
  const transcriptState: TranscriptState = running
    ? isProcessing
      ? "transcribing"
      : "listening"
    : "idle";

  // Keep the live "thinking" line in view whenever any part of the summary
  // updates while we're still recording.
  useEffect(() => {
    if (!running || !summary) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [summary, running]);

  return (
    <main
      className={cn(
        "mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center gap-10 px-6 py-16",
        !hasStarted && "justify-center"
      )}
    >
      {!hasStarted ? <Greeting /> : null}
      {!hasStarted ? (
        <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />
      ) : null}
      {running ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <RecordButton
            running={running}
            elapsedMs={elapsedMs}
            onStart={start}
            onStop={stop}
            compact
          />
        </div>
      ) : null}

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : null}

      {hasStarted ? (
        <section className="relative flex w-full min-h-[280px] self-stretch flex-col gap-6 p-6">
          <RecordingHeader
            title={summaryTitle}
            startedAt={recordingStartedAt}
            menu={
              <SessionMenu
                hasTranscript={transcript.length > 0}
                hasAudio={finalAudio !== null}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onOpenAudio={() => setAudioOpen(true)}
              />
            }
          />
          <div className="h-px w-full bg-border" />
          <div className="flex-1">
            <SummaryView
              summary={summary}
              insights={insights}
              pendingIndices={pendingIndices}
              hasTranscript={transcript.length > 0}
              running={running}
            />
          </div>
          {running ? (
            <div ref={bottomRef} className="pt-2 scroll-mb-24">
              <StatusPhrases
                hasSummary={
                  !!summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0)
                }
                thinking={summary?.thinking ?? ""}
              />
            </div>
          ) : null}

          {hiddenWarning && running ? <HiddenTabOverlay onDismiss={dismissHiddenWarning} /> : null}
          {finalizing ? <FinalizingOverlay /> : null}
        </section>
      ) : null}

      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transcrição</DialogTitle>
            <DialogDescription>Texto bruto capturado pelo microfone.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <TranscriptView rows={chunkRows} state={transcriptState} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={audioOpen} onOpenChange={setAudioOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Áudio completo</DialogTitle>
            <DialogDescription>Reprodução da gravação inteira.</DialogDescription>
          </DialogHeader>
          {finalAudio ? <AudioPlayer audio={finalAudio} /> : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
