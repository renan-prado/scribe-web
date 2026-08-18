"use client";

import {
  Download,
  FileText,
  Headphones,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type ChunkStatus = "uploading" | "ok" | "silence" | "error";

type ChunkRow = {
  index: number;
  status: ChunkStatus;
  text: string;
};

type FinalAudio = { url: string; extension: string; sizeBytes: number };

const SILENCE_RMS_THRESHOLD = 0.005;
const SUMMARY_WARMUP_CHUNKS = 3;
const SUMMARY_EVERY_N_CHUNKS = 3;
const FORMAT_EVERY_N_CHUNKS = 4;

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
  const lastFormatChunkRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [finalAudio, setFinalAudio] = useState<FinalAudio | null>(null);
  const [startupError, setStartupError] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [formattedTranscript, setFormattedTranscript] = useState("");
  const [formattedUpToOkCount, setFormattedUpToOkCount] = useState(0);
  const [summarizing, setSummarizing] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);

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

  const displayTranscript = useMemo(() => {
    if (!formattedTranscript) return transcript;
    const newerText = chunkRows
      .filter((r) => r.status === "ok")
      .slice(formattedUpToOkCount)
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return newerText ? `${formattedTranscript}\n\n${newerText}` : formattedTranscript;
  }, [chunkRows, formattedTranscript, formattedUpToOkCount, transcript]);

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

  useEffect(() => {
    if (!transcript || summarizing) return;
    const withinWarmup = okChunkCount > 0 && okChunkCount <= SUMMARY_WARMUP_CHUNKS;
    const dueForSummary =
      (withinWarmup || (okChunkCount > 0 && okChunkCount % SUMMARY_EVERY_N_CHUNKS === 0)) &&
      lastSummaryChunkRef.current !== okChunkCount;
    if (!dueForSummary) return;
    lastSummaryChunkRef.current = okChunkCount;
    setSummarizing(true);
    fetch("/api/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.summary) setSummary(body.summary);
        if (typeof body?.title === "string") setSummaryTitle(body.title);
      })
      .catch(() => {})
      .finally(() => setSummarizing(false));
  }, [okChunkCount, transcript, summarizing]);

  useEffect(() => {
    if (!transcript || formatting) return;
    const dueForFormat =
      okChunkCount > 0 &&
      okChunkCount % FORMAT_EVERY_N_CHUNKS === 0 &&
      lastFormatChunkRef.current !== okChunkCount;
    if (!dueForFormat) return;
    lastFormatChunkRef.current = okChunkCount;
    const okCountAtTrigger = okChunkCount;
    setFormatting(true);
    fetch("/api/format-paragraphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.formatted) {
          setFormattedTranscript(body.formatted);
          setFormattedUpToOkCount(okCountAtTrigger);
        }
      })
      .catch(() => {})
      .finally(() => setFormatting(false));
  }, [okChunkCount, transcript, formatting]);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      const row: ChunkRow = { index: ev.index, status: "uploading", text: "" };
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
    setSummary("");
    setSummaryTitle("");
    setFormattedTranscript("");
    setFormattedUpToOkCount(0);
    lastSummaryChunkRef.current = 0;
    lastFormatChunkRef.current = 0;
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
  }, [releaseWakeLock, running]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && running && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [requestWakeLock, running]);

  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
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

  return (
    <main
      className={cn(
        "mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center gap-10 px-6 py-16",
        !hasStarted && "justify-center"
      )}
    >
      {!hasStarted ? <Greeting /> : null}
      <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : null}

      {hasStarted ? (
        <section className="flex w-full min-h-[280px] self-stretch flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                  Resumo
                </span>
                {summarizing ? <InlineDots /> : null}
              </div>
              <SummaryTitle title={summaryTitle} running={running} />
            </div>
            <SessionMenu
              hasTranscript={transcript.length > 0}
              hasAudio={finalAudio !== null}
              onOpenTranscript={() => setTranscriptOpen(true)}
              onOpenAudio={() => setAudioOpen(true)}
            />
          </header>
          <div className="flex-1">
            <SummaryView
              summary={summary}
              hasTranscript={transcript.length > 0}
              running={running}
            />
          </div>
        </section>
      ) : null}

      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transcrição</DialogTitle>
            <DialogDescription>Texto bruto capturado pelo microfone.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <TranscriptView text={displayTranscript} state={transcriptState} />
          </div>
          {formatting ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <InlineDots /> Reformatando parágrafos…
            </p>
          ) : null}
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
        Grave um sermão, uma aula da EBD, uma palestra ou uma conversa entre amigos e geramos um
        resumo bíblico para você!
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
}: {
  running: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
}) {
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

function InlineDots() {
  return (
    <div role="status" aria-label="Processando" className="flex items-center gap-1">
      <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60" />
      <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
      <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
    </div>
  );
}

function TranscriptView({
  text,
  state,
}: {
  text: string;
  state: "listening" | "transcribing" | "idle";
}) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {paragraphs.length > 0 ? (
        <div className="space-y-3 text-pretty text-sm leading-relaxed text-foreground">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ) : state === "idle" ? (
        <p className="text-sm text-muted-foreground">Sem transcrição.</p>
      ) : null}
      {state === "transcribing" ? <TranscriptSkeleton /> : null}
      {state === "listening" && !text ? <ListeningDots /> : null}
    </div>
  );
}

function SummaryTitle({ title, running }: { title: string; running: boolean }) {
  if (title) {
    return (
      <h2 className="font-heading text-xl font-semibold leading-tight text-foreground">{title}</h2>
    );
  }
  if (running) {
    return (
      <div
        role="status"
        aria-label="Gerando título"
        className="h-6 w-2/3 animate-skeleton-shimmer rounded-md bg-muted"
      />
    );
  }
  return null;
}

function renderBoldRefs(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are order-stable within a paragraph
        <strong key={`${i}-${inner}`} className="font-semibold text-foreground">
          {inner}
        </strong>
      );
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: parts are order-stable within a paragraph
    return <span key={`${i}-${part.slice(0, 24)}`}>{part}</span>;
  });
}

function SummaryView({
  summary,
  hasTranscript,
  running,
}: {
  summary: string;
  hasTranscript: boolean;
  running: boolean;
}) {
  if (summary) {
    const paragraphs = summary
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return (
      <div className="space-y-4 text-pretty text-base leading-relaxed text-foreground">
        {paragraphs.map((p) => (
          <p key={p}>{renderBoldRefs(p)}</p>
        ))}
        {running ? <GeneratingMore /> : null}
      </div>
    );
  }
  if (running || hasTranscript) {
    return <SummarySkeleton />;
  }
  return <p className="text-sm text-muted-foreground">O resumo aparecerá aqui.</p>;
}

function GeneratingMore() {
  return (
    <div
      role="status"
      aria-label="Gerando mais conteúdo"
      className="flex items-center gap-2 pt-2 text-xs text-muted-foreground"
    >
      <span className="flex items-center gap-1">
        <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60" />
        <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
        <span className="size-1 animate-listening-dot rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
      </span>
      <span>gerando mais conforme a fala continua</span>
    </div>
  );
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
