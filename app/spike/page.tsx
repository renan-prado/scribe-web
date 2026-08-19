"use client";

import {
  AlertTriangle,
  BookOpen,
  Download,
  FileText,
  Headphones,
  MapPin,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Sparkles,
  Square,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Proposal } from "@/app/api/consolidate/route";
import type { Insight } from "@/app/api/insights/route";
import type { SummaryBlock, SummaryPayload, SummaryPhase } from "@/app/api/summarize/route";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ChunkEvent, createRecorder, type Recorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

const AUTHOR_PLACEHOLDER = "José Leante";
const LOCATION_PLACEHOLDER = "Assembleia de Deus • Ipiranga • Vila Marcondes";

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function defaultRecordingTitle(date: Date): string {
  return `Gravação dia ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}.`;
}

type ChunkStatus = "uploading" | "ok" | "silence" | "error";

type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
  startedAtMs: number;
};

type FinalAudio = { url: string; extension: string; sizeBytes: number };

const SILENCE_RMS_THRESHOLD = 0.005;
const SUMMARY_WARMUP_CHUNKS = 3;
const SUMMARY_EVERY_N_CHUNKS = 1;
const INSIGHTS_EVERY_N_CHUNKS = 5;
const CONSOLIDATE_EVERY_N_CHUNKS = 6;
const CONSOLIDATE_PULSE_MS = 5000;
// Cap the transcript sent to summarize/insights so long recordings don't
// balloon the prompt (and cost/latency). The previousSummary already carries
// older context — the model only needs the recent tail to keep going.
const RECENT_TRANSCRIPT_CHARS = 6000;

function tailTranscript(full: string, maxChars: number): string {
  if (full.length <= maxChars) return full;
  const tail = full.slice(-maxChars);
  const spaceIdx = tail.indexOf(" ");
  return spaceIdx > 0 ? tail.slice(spaceIdx + 1) : tail;
}

const EARLY_STATUS_PHRASES = [
  "ouvindo o áudio",
  "escutando com atenção",
  "aguardando as primeiras ideias",
  "captando a fala inicial",
  "acompanhando o começo",
  "atento ao que vem por aí",
  "esperando o discurso engrenar",
];

const LATER_STATUS_PHRASES = [
  "acompanhando o raciocínio",
  "juntando as ideias que surgiram até aqui",
  "conectando os argumentos",
  "identificando os temas centrais",
  "consultando as Escrituras",
  "estruturando o resumo",
  "escutando com atenção o próximo trecho",
  "amadurecendo as ideias",
  "deixando o pensamento se desenvolver",
];

async function isSilentBlob(blob: Blob): Promise<boolean> {
  try {
    const arrayBuf = await blob.arrayBuffer();
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    try {
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      let sumSquares = 0;
      let count = 0;
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          sumSquares += data[i] * data[i];
          count++;
        }
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, count));
      return rms < SILENCE_RMS_THRESHOLD;
    } finally {
      void ctx.close();
    }
  } catch {
    return false;
  }
}

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function tailSentences(text: string, count: number): string {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [];
  if (parts.length === 0) return text.slice(-400);
  return parts.slice(-count).join(" ").trim();
}

function collectAffectedIndices(proposals: Proposal[]): number[] {
  const set = new Set<number>();
  for (const p of proposals) {
    if (p.action === "merge") for (const i of p.targetIndices) set.add(i);
    else if (p.action === "refine") set.add(p.targetIndex);
    else if (p.action === "insertHeading") set.add(p.afterIndex + 1);
  }
  return Array.from(set);
}

function mergeInsights(prev: Insight[], incoming: Insight[]): Insight[] {
  const taken = new Set(prev.map((i) => i.targetBlockIndex));
  const additions = incoming.filter((i) => !taken.has(i.targetBlockIndex));
  if (additions.length === 0) return prev;
  return [...prev, ...additions];
}

function applyProposalsToPayload(payload: SummaryPayload, proposals: Proposal[]): SummaryPayload {
  const refines = proposals.filter(
    (p): p is Extract<Proposal, { action: "refine" }> => p.action === "refine"
  );
  const structural = proposals.filter(
    (p): p is Extract<Proposal, { action: "merge" | "insertHeading" }> =>
      p.action === "merge" || p.action === "insertHeading"
  );
  let blocks: SummaryBlock[] = payload.blocks.map((b, i) => {
    const r = refines.find((x) => x.targetIndex === i);
    if (r && b.type === "paragraph") return { type: "paragraph", text: r.newText };
    return b;
  });
  const anchor = (p: Extract<Proposal, { action: "merge" | "insertHeading" }>): number =>
    p.action === "merge" ? Math.min(...p.targetIndices) : p.afterIndex + 1;
  const sortedStructural = [...structural].sort((a, b) => anchor(b) - anchor(a));
  for (const p of sortedStructural) {
    if (p.action === "merge") {
      const sorted = [...p.targetIndices].sort((a, b) => a - b);
      const start = sorted[0];
      const removeCount = sorted.length;
      blocks = [
        ...blocks.slice(0, start),
        { type: "paragraph", text: p.newText },
        ...blocks.slice(start + removeCount),
      ];
    } else {
      const insertAt = p.afterIndex + 1;
      blocks = [
        ...blocks.slice(0, insertAt),
        { type: "h2", text: p.text },
        ...blocks.slice(insertAt),
      ];
    }
  }
  return { ...payload, blocks };
}

function remapInsightsForProposals(insights: Insight[], proposals: Proposal[]): Insight[] {
  const structural = proposals.filter(
    (p): p is Extract<Proposal, { action: "merge" | "insertHeading" }> =>
      p.action === "merge" || p.action === "insertHeading"
  );
  if (structural.length === 0) return insights;
  const anchor = (p: Extract<Proposal, { action: "merge" | "insertHeading" }>): number =>
    p.action === "merge" ? Math.min(...p.targetIndices) : p.afterIndex + 1;
  const sortedStructural = [...structural].sort((a, b) => anchor(b) - anchor(a));
  const out: Insight[] = [];
  for (const ins of insights) {
    let idx = ins.targetBlockIndex;
    let drop = false;
    for (const p of sortedStructural) {
      if (p.action === "merge") {
        const sorted = [...p.targetIndices].sort((a, b) => a - b);
        const start = sorted[0];
        const end = sorted[sorted.length - 1];
        if (idx > start && idx <= end) {
          drop = true;
          break;
        }
        if (idx > end) idx -= sorted.length - 1;
      } else {
        const insertAt = p.afterIndex + 1;
        if (idx >= insertAt) idx += 1;
      }
    }
    if (!drop) out.push({ ...ins, targetBlockIndex: idx });
  }
  return out;
}

async function uploadChunkWithRetry(
  ev: ChunkEvent,
  prevText: string
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const backoffMs = [500, 1500];
  let lastMessage = "unknown error";
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      const form = new FormData();
      const filename = `chunk-${ev.index}.${ev.extension}`;
      form.append("file", ev.blob, filename);
      form.append("chunkIndex", String(ev.index));
      form.append("extension", ev.extension);
      form.append("prevText", prevText);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        lastMessage = body?.error ?? `HTTP ${res.status}`;
      } else {
        return { ok: true, text: body.text ?? "" };
      }
    } catch (err) {
      lastMessage = (err as Error).message ?? "network error";
    }
    if (attempt < backoffMs.length) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
  }
  return { ok: false, message: lastMessage };
}

export default function SpikePage() {
  const recorderRef = useRef<Recorder | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const chunksRef = useRef<Map<number, ChunkRow>>(new Map());
  const startedAtRef = useRef<number>(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSummaryChunkRef = useRef(0);
  const lastInsightsChunkRef = useRef(0);
  const lastConsolidateChunkRef = useRef(0);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
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
  const [hiddenWarning, setHiddenWarning] = useState(false);

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

  const requestSummary = useCallback(
    async (body: {
      text: string;
      isFinal?: boolean;
      phase?: SummaryPhase;
      elapsedSec?: number;
      previous?: SummaryPayload;
    }): Promise<SummaryPayload | null> => {
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await res.json()) as Partial<SummaryPayload> & { error?: string };
        if (payload?.error) return null;
        const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
        const shortSummary = typeof payload.shortSummary === "string" ? payload.shortSummary : "";
        const title = typeof payload.title === "string" ? payload.title : "";
        const thinking = typeof payload.thinking === "string" ? payload.thinking : "";
        const next: SummaryPayload = { thinking, title, shortSummary, blocks };
        setSummary(next);
        if (title) setSummaryTitle(title);
        return next;
      } catch {
        return null;
      }
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
    void requestSummary({ text: recent, elapsedSec, previous }).finally(() =>
      setSummarizing(false)
    );
  }, [
    running,
    okChunkCount,
    transcript,
    summarizing,
    finalizing,
    summary,
    requestSummary,
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
    fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: recent, blocks, existingInsightIndices }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body?.insights) && body.insights.length > 0) {
          setInsights((prev) => mergeInsights(prev, body.insights));
        }
      })
      .catch(() => {})
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
        const res = await fetch("/api/consolidate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocks: currentBlocks, isFinal: !!opts.isFinal }),
        });
        const body = (await res.json()) as { proposals?: Proposal[] };
        const proposals = Array.isArray(body?.proposals) ? body.proposals : [];
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

  const requestWakeLock = useCallback(async () => {
    const wl = (navigator as unknown as { wakeLock?: WakeLock }).wakeLock;
    if (!wl || typeof wl.request !== "function") return;
    try {
      wakeLockRef.current = await wl.request("screen");
    } catch {
      // ignore
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    setStartupError("");
    setFinalAudio(null);
    setChunkRows([]);
    setSummary(null);
    setSummaryTitle("");
    setRecordingStartedAt(new Date());
    setHiddenWarning(false);
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
      minChunkMs: 20_000,
      maxChunkMs: 45_000,
      silenceThreshold: 0.01,
      silenceHoldMs: 400,
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
      setElapsedMs(0);
      setRunning(true);
      tickTimerRef.current = setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current);
      }, 250);
      await requestWakeLock();
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, requestWakeLock, running]);

  const stop = useCallback(async () => {
    if (!running) return;
    setRunning(false);
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    await recorderRef.current?.stop();
    recorderRef.current = null;
    await releaseWakeLock();

    const finalTranscript = Array.from(chunksRef.current.values())
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (finalTranscript) {
      const elapsedSec = Math.floor((performance.now() - startedAtRef.current) / 1000);
      const previous = summary ?? undefined;
      setFinalizing(true);
      try {
        let finalPayload = await requestSummary({
          text: finalTranscript,
          isFinal: true,
          elapsedSec,
          previous,
        });
        let localInsights = insights;
        if (finalPayload && finalPayload.blocks.length >= 3) {
          try {
            const cRes = await fetch("/api/consolidate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ blocks: finalPayload.blocks, isFinal: true }),
            });
            const cBody = (await cRes.json()) as { proposals?: Proposal[] };
            const proposals = Array.isArray(cBody?.proposals) ? cBody.proposals : [];
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
          try {
            const existingInsightIndices = localInsights.map((i) => i.targetBlockIndex);
            const iRes = await fetch("/api/insights", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                text: finalTranscript,
                blocks: finalPayload.blocks,
                existingInsightIndices,
              }),
            });
            const iBody = (await iRes.json()) as { insights?: Insight[] };
            if (Array.isArray(iBody?.insights) && iBody.insights.length > 0) {
              setInsights((prev) => mergeInsights(prev, iBody.insights ?? []));
            }
          } catch {
            // ignore
          }
        }
      } finally {
        setFinalizing(false);
      }
    }
  }, [releaseWakeLock, requestSummary, running, summary, insights]);

  useEffect(() => {
    if (!running) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // Latch a warning: we may have lost audio while backgrounded.
        setHiddenWarning(true);
        return;
      }
      // Coming back to the tab: setInterval can freeze while hidden, so
      // resync the timer from the monotonic clock and refresh the wake lock.
      setElapsedMs(performance.now() - startedAtRef.current);
      if (!wakeLockRef.current) void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [requestWakeLock, running]);

  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      void recorderRef.current?.stop();
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const hasStarted = running || chunkRows.length > 0 || finalAudio !== null;
  const transcriptState: "listening" | "transcribing" | "idle" = running
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

          {hiddenWarning && running ? (
            <HiddenTabOverlay onDismiss={() => setHiddenWarning(false)} />
          ) : null}
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

function SessionMenu({
  hasTranscript,
  hasAudio,
  onOpenTranscript,
  onOpenAudio,
}: {
  hasTranscript: boolean;
  hasAudio: boolean;
  onOpenTranscript: () => void;
  onOpenAudio: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        aria-label="Mais opções"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={!hasTranscript} onClick={onOpenTranscript} className="gap-2">
          <FileText className="size-4" />
          Ler transcrição
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasAudio} onClick={onOpenAudio} className="gap-2">
          <Headphones className="size-4" />
          Áudio completo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Greeting() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <span
        suppressHydrationWarning
        className="inline-flex items-center rounded-full bg-muted px-4 py-1.5 text-sm font-medium tabular-nums text-foreground"
      >
        {time || " "}
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Olá, Renan!</h1>
      <p className="max-w-md text-balance text-base font-normal leading-relaxed text-muted-foreground">
        Transforme qualquer <strong className="font-semibold text-foreground">sermão</strong>,{" "}
        <strong className="font-semibold text-foreground">aula da EBD</strong>,{" "}
        <strong className="font-semibold text-foreground">palestra</strong> ou{" "}
        <strong className="font-semibold text-foreground">bate-papo</strong> em um resumo bíblico
        pronto para revisar e revisitar.
      </p>
    </section>
  );
}

function formatClock(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

function RecordButton({
  running,
  elapsedMs,
  onStart,
  onStop,
  compact = false,
}: {
  running: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Parar gravação"
        className={cn(
          "group flex items-center gap-4 rounded-full border border-border bg-background/90 px-5 py-2.5 text-sm text-foreground shadow-sm backdrop-blur outline-none transition-all",
          "hover:border-foreground/40 hover:bg-background hover:shadow-md",
          "focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95"
        )}
      >
        <span className="flex items-center gap-2">
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-foreground/40" />
            <span className="size-2 rounded-full bg-foreground" />
          </span>
          <span className="font-mono tabular-nums">{formatMmSs(elapsedMs)}</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-muted-foreground transition-colors",
            "group-hover:text-foreground"
          )}
        >
          <Square className="size-3 fill-current" />
          <span>parar</span>
        </span>
      </button>
    );
  }
  return (
    <div className="relative flex size-28 items-center justify-center">
      {running ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-record-halo rounded-full bg-primary/10"
        />
      ) : null}
      <button
        type="button"
        onClick={running ? onStop : onStart}
        aria-label={running ? "Parar gravação" : "Iniciar gravação"}
        className={cn(
          "relative flex size-20 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-all duration-300 ease-out",
          "hover:scale-[1.03] active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/40"
        )}
      >
        {running ? (
          <>
            <span className="font-mono text-sm tabular-nums">{formatMmSs(elapsedMs)}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[0.55rem] tracking-wider uppercase opacity-70">
              <Square className="size-2 fill-current" /> Parar
            </span>
          </>
        ) : (
          <Mic className="size-6" />
        )}
      </button>
    </div>
  );
}

function TranscriptView({
  rows,
  state,
}: {
  rows: ChunkRow[];
  state: "listening" | "transcribing" | "idle";
}) {
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

function groupChunksByMinute(rows: ChunkRow[]): { startedAtMs: number; text: string }[] {
  const ok = rows.filter((r) => r.status === "ok" && r.text.trim().length > 0);
  if (ok.length === 0) return [];
  const groups: { startedAtMs: number; text: string }[] = [];
  let currentMinute = -1;
  for (const r of ok) {
    const minute = Math.floor(r.startedAtMs / 60_000);
    if (minute !== currentMinute) {
      currentMinute = minute;
      groups.push({ startedAtMs: minute * 60_000, text: r.text.trim() });
    } else {
      const last = groups[groups.length - 1];
      last.text = `${last.text} ${r.text.trim()}`.replace(/\s+/g, " ").trim();
    }
  }
  return groups;
}

function RecordingHeader({
  title,
  startedAt,
  menu,
}: {
  title: string;
  startedAt: Date | null;
  menu: React.ReactNode;
}) {
  const displayTitle =
    title.trim() || (startedAt ? defaultRecordingTitle(startedAt) : "Nova gravação.");
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm leading-none text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
            <User className="size-3" />
          </span>
          <span className="font-medium leading-none text-foreground">{AUTHOR_PLACEHOLDER}</span>
        </div>
        {menu}
      </div>

      <h1
        key={displayTitle}
        className="animate-content-fade font-heading text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl"
        suppressHydrationWarning
      >
        {displayTitle}
      </h1>

      <p className="mt-4 flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        <span className="leading-none">{LOCATION_PLACEHOLDER}</span>
      </p>
    </header>
  );
}

function HiddenTabOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="hidden-tab-title"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm"
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground">
        <AlertTriangle className="size-5" />
      </span>
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <p id="hidden-tab-title" className="text-base font-semibold text-foreground">
          A gravação precisa desta aba em foco
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-balance">
          Enquanto a aba fica em segundo plano, o navegador pode pausar a captura e trechos da fala
          podem ter sido perdidos. Volte assim que puder para continuar sem furos.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-transform outline-none",
          "hover:scale-[1.02] active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/40"
        )}
      >
        Entendi, continuar
      </button>
    </div>
  );
}

function FinalizingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
    >
      <span className="relative flex size-10 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="size-3 rounded-full bg-primary" />
      </span>
      <div className="flex flex-col items-center gap-1 px-6 text-center">
        <p className="text-base font-semibold text-foreground">Gerando a conclusão</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Ajustando os últimos pontos e amarrando a ideia central.
        </p>
      </div>
    </div>
  );
}

function StatusPhrases({ hasSummary, thinking }: { hasSummary: boolean; thinking?: string }) {
  const pool = hasSummary ? LATER_STATUS_PHRASES : EARLY_STATUS_PHRASES;
  const [index, setIndex] = useState(() => Math.floor(Math.random() * pool.length));

  useEffect(() => {
    setIndex(Math.floor(Math.random() * pool.length));
    const id = setInterval(
      () => setIndex((i) => (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length),
      15000
    );
    return () => clearInterval(id);
  }, [pool]);

  const message = thinking && thinking.trim().length > 0 ? thinking : pool[index];
  const keyForFade = thinking && thinking.trim().length > 0 ? thinking : `pool-${index}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-start gap-2 text-left text-xs"
    >
      <span className="mt-[1px] shrink-0">
        <SpinnerGlyph />
      </span>
      <span
        key={keyForFade}
        className={cn(
          "flex-1 text-pretty leading-relaxed animate-status-fade animate-text-shimmer bg-clip-text text-transparent",
          "bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%,var(--muted-foreground)_100%)]",
          "bg-[length:200%_100%]"
        )}
      >
        {message}
      </span>
    </div>
  );
}

const SPINNER_FRAMES = ["·", "*", "✳", "✶", "✳", "*"];

function SpinnerGlyph() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 140);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      aria-hidden
      className="inline-flex w-3 items-center justify-center font-mono text-sm leading-none text-foreground/70 tabular-nums"
    >
      {SPINNER_FRAMES[frame]}
    </span>
  );
}

function SummaryView({
  summary,
  insights,
  pendingIndices,
  hasTranscript,
  running,
}: {
  summary: SummaryPayload | null;
  insights: Insight[];
  pendingIndices: Set<number>;
  hasTranscript: boolean;
  running: boolean;
}) {
  const hasBody = summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0);
  const hasThinking = summary && summary.thinking.length > 0;
  const insightsByBlock = useMemo(() => {
    const map = new Map<number, Insight[]>();
    for (const ins of insights) {
      const list = map.get(ins.targetBlockIndex) ?? [];
      list.push(ins);
      map.set(ins.targetBlockIndex, list);
    }
    return map;
  }, [insights]);

  if (hasBody || hasThinking) {
    return (
      <div className="flex flex-col gap-8">
        {hasBody && summary!.shortSummary ? (
          <div className="-mb-2 flex flex-col gap-2 border-l-2 border-foreground/60 pl-4">
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
              Ideia central
            </span>
            <p
              key={summary!.shortSummary}
              className="animate-content-fade text-pretty text-lg font-medium leading-snug text-foreground text-balance"
            >
              {summary!.shortSummary}
            </p>
          </div>
        ) : null}
        {hasBody
          ? summary!.blocks.map((block, i) => {
              const attached = insightsByBlock.get(i) ?? [];
              const pulsing = pendingIndices.has(i);
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: index disambiguates blocks whose type + content hash collide (e.g., two short paragraphs starting the same way)
                  key={`${block.type}-${i}-${blockKey(block)}`}
                  className={cn("animate-content-fade", pulsing && "animate-consolidate-pulse")}
                >
                  <BlockRenderer block={block} />
                  {attached.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-3">
                      {attached.map((ins, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: insight order is stable within a fetch
                        <InsightRenderer key={`${ins.type}-${j}`} insight={ins} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
        {!hasBody ? <SummarySkeleton /> : null}
      </div>
    );
  }
  if (running || hasTranscript) {
    return <SummarySkeleton />;
  }
  return <p className="text-sm text-muted-foreground">O resumo aparecerá aqui.</p>;
}

function InsightRenderer({ insight }: { insight: Insight }) {
  const [openRef, setOpenRef] = useState<string | null>(null);

  if (insight.type === "bibleReference") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 pr-0.5 italic">
            <BookOpen className="size-3" />
            Leia também:
          </span>
          {insight.references.map((ref) => (
            <button
              key={ref}
              type="button"
              onClick={() => setOpenRef(ref)}
              className={cn(
                "inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-medium text-foreground/80 transition-colors outline-none",
                "hover:border-foreground/60 hover:bg-muted hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              {ref}
            </button>
          ))}
        </div>
        <VerseDialog reference={openRef} onOpenChange={(open) => !open && setOpenRef(null)} />
      </>
    );
  }
  return (
    <aside
      className="relative flex flex-col gap-5 rounded-3xl rounded-tl-none border-2 border-dashed border-border/80 p-7 animate-insight-gradient"
      style={{
        backgroundImage: "linear-gradient(135deg, #FBFCFE 0%, #F4F6FC 97%)",
        backgroundSize: "200% 200%",
      }}
    >
      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
        <Sparkles className="size-3" />
        <span>{insight.label}</span>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-foreground/85">{insight.text}</p>
      {insight.source ? (
        <p className="text-[0.7rem] italic text-muted-foreground">— {insight.source}</p>
      ) : null}
    </aside>
  );
}

function blockKey(block: SummaryBlock): string {
  if (block.type === "bibleQuote") return `${block.reference}-${block.text.slice(0, 24)}`;
  if (block.type === "quote") return `${block.text.slice(0, 24)}-${block.author ?? ""}`;
  return block.text.slice(0, 32);
}

function BlockRenderer({ block }: { block: SummaryBlock }) {
  switch (block.type) {
    case "h1":
      return (
        <h2 className="mt-4 font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
          {block.text}
        </h2>
      );
    case "h2":
      return (
        <h3 className="mt-4 font-heading text-xl font-bold leading-snug tracking-tight text-foreground">
          {block.text}
        </h3>
      );
    case "paragraph":
      return <p className="text-pretty text-base leading-relaxed text-foreground">{block.text}</p>;
    case "bibleQuote":
      return (
        <figure
          className="relative flex flex-col gap-5 rounded-3xl border border-border p-7 animate-insight-gradient"
          style={{
            backgroundImage: "linear-gradient(135deg, #FBFCFE 0%, #F4F6FC 97%)",
            backgroundSize: "200% 200%",
          }}
        >
          <figcaption>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-semibold text-background">
              <BookOpen className="size-3" />
              {block.reference}
            </span>
          </figcaption>
          {block.text ? (
            <blockquote className="pl-3 text-sm leading-relaxed text-foreground/90">
              {block.text}
            </blockquote>
          ) : null}
        </figure>
      );
    case "highlight":
      return (
        <figure className="my-4 px-4 text-center sm:px-8">
          <blockquote className="text-pretty text-lg font-semibold leading-loose tracking-tight text-foreground sm:text-xl">
            <span
              aria-hidden
              className="mr-3 select-none align-[-0.25em] font-heading text-4xl leading-none text-muted-foreground/30"
            >
              ❝
            </span>
            <span className="bg-[#fff8c9] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {block.text}
            </span>
            <span
              aria-hidden
              className="ml-3 select-none align-[-0.25em] font-heading text-4xl leading-none text-muted-foreground/30"
            >
              ❞
            </span>
          </blockquote>
        </figure>
      );
    case "conclusion":
      return (
        <section
          className="relative mt-4 flex flex-col gap-5 rounded-3xl border border-border p-7 animate-insight-gradient"
          style={{
            backgroundImage: "linear-gradient(135deg, #FBFCFE 0%, #F4F6FC 97%)",
            backgroundSize: "200% 200%",
          }}
        >
          <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
            Conclusão
          </span>
          <p className="text-pretty text-base leading-relaxed text-foreground">{block.text}</p>
        </section>
      );
    case "quote":
      return (
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="text-base italic leading-relaxed text-foreground/80">
            {block.text}
          </blockquote>
          {block.author ? (
            <figcaption className="mt-1 text-xs text-muted-foreground">— {block.author}</figcaption>
          ) : null}
        </figure>
      );
    default:
      return null;
  }
}

function SummarySkeleton() {
  return (
    <div role="status" aria-label="Gerando resumo" className="flex flex-col gap-3">
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
      <div className="h-4 w-11/12 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
      <div className="h-4 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:360ms]" />
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div
      role="status"
      aria-label="Transcrevendo"
      className="flex w-full flex-col items-center gap-2 pt-1"
    >
      <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
      <div className="h-4 w-4/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:150ms]" />
      <div className="h-4 w-2/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:300ms]" />
    </div>
  );
}

function ListeningDots() {
  return (
    <div
      role="status"
      aria-label="Escutando"
      className="flex items-center justify-center gap-1.5 pt-2"
    >
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
    </div>
  );
}

function AudioPlayer({ audio }: { audio: FinalAudio }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const onSeek = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
  }, []);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full self-stretch rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar" : "Reproduzir"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all",
            "hover:scale-105 active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/40 outline-none"
          )}
        >
          {playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="size-5 fill-current translate-x-0.5" />
          )}
        </button>

        <div className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            onPointerDown={onSeek}
            className="group relative h-1.5 w-full cursor-pointer rounded-full bg-muted"
            aria-label="Buscar posição"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100"
              style={{ left: `${progress}%` }}
            />
          </button>
          <div className="flex justify-between font-mono text-[0.7rem] tabular-nums text-muted-foreground">
            <span>{formatMmSs(currentTime * 1000)}</span>
            <span>{duration > 0 ? formatMmSs(duration * 1000) : "--:--"}</span>
          </div>
        </div>

        <a
          href={audio.url}
          download={`spike.${audio.extension}`}
          aria-label="Baixar áudio"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 outline-none"
          )}
        >
          <Download className="size-4" />
        </a>
      </div>

      {/* biome-ignore lint/a11y/useMediaCaption: playback of user-recorded audio */}
      <audio
        ref={audioRef}
        src={audio.url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (!Number.isFinite(el.duration)) {
            const reset = () => {
              el.removeEventListener("durationchange", reset);
              el.removeEventListener("timeupdate", reset);
              setDuration(el.duration);
              el.currentTime = 0;
            };
            el.addEventListener("durationchange", reset);
            el.addEventListener("timeupdate", reset);
            el.currentTime = 1e101;
          } else {
            setDuration(el.duration);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

type VerseFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; reference: string; text: string; translation: string }
  | { status: "error"; message: string };

const verseCache = new Map<string, { reference: string; text: string; translation: string }>();

function VerseDialog({
  reference,
  onOpenChange,
}: {
  reference: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<VerseFetchState>({ status: "idle" });

  useEffect(() => {
    if (!reference) {
      setState({ status: "idle" });
      return;
    }
    const cached = verseCache.get(reference);
    if (cached) {
      setState({ status: "ok", ...cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/verse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((body: { reference?: string; text?: string; translation?: string; error?: string }) => {
        if (cancelled) return;
        if (body?.error) {
          setState({ status: "error", message: body.error });
          return;
        }
        const payload = {
          reference: body.reference || reference,
          text: body.text || "",
          translation: body.translation || "",
        };
        verseCache.set(reference, payload);
        setState({ status: "ok", ...payload });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ status: "error", message: err.message || "falha ao buscar" });
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const open = reference !== null;
  const headerRef = state.status === "ok" ? state.reference : reference || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            {headerRef}
          </DialogTitle>
          <DialogDescription>
            {state.status === "ok" && state.translation
              ? `Tradução: ${state.translation}`
              : "Versículo sugerido pela IA"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[80px]">
          {state.status === "loading" ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
              <div className="h-4 w-11/12 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
              <div className="h-4 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
            </div>
          ) : state.status === "ok" && state.text ? (
            <blockquote className="text-pretty text-base leading-relaxed text-foreground/90">
              {state.text}
            </blockquote>
          ) : state.status === "ok" ? (
            <p className="text-sm text-muted-foreground">
              Não consegui recuperar o texto dessa referência com confiança. Consulte sua Bíblia.
            </p>
          ) : state.status === "error" ? (
            <p className="text-sm text-destructive">Falha ao buscar: {state.message}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
