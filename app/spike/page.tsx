"use client";

import { Download, Mic, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [finalAudio, setFinalAudio] = useState<FinalAudio | null>(null);
  const [startupError, setStartupError] = useState<string>("");

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

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

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

  const showFinal = !running && finalAudio && transcript.length > 0;

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center gap-10 px-6 py-16">
      <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {running
            ? "Escutando…"
            : showFinal
              ? "Gravação finalizada"
              : "Toque no microfone para começar"}
        </p>
      )}

      {running || showFinal ? (
        <Transcript
          text={transcript}
          state={running ? (isProcessing ? "transcribing" : "listening") : "idle"}
        />
      ) : null}

      {showFinal ? <AudioPlayer audio={finalAudio} /> : null}
    </main>
  );
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
    <div className="relative flex size-40 items-center justify-center">
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
          "relative flex size-32 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-all duration-300 ease-out",
          "hover:scale-[1.03] active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/40"
        )}
      >
        {running ? (
          <>
            <span className="font-mono text-2xl tabular-nums">{formatMmSs(elapsedMs)}</span>
            <span className="mt-1 flex items-center gap-1 text-[0.65rem] tracking-wider uppercase opacity-70">
              <Square className="size-2.5 fill-current" /> Parar
            </span>
          </>
        ) : (
          <Mic className="size-10" />
        )}
      </button>
    </div>
  );
}

function Transcript({
  text,
  state,
}: {
  text: string;
  state: "listening" | "transcribing" | "idle";
}) {
  return (
    <div className="w-full self-stretch space-y-3">
      {text ? (
        <p className="text-pretty text-base leading-relaxed text-foreground">{text}</p>
      ) : state === "idle" ? (
        <p className="text-center text-muted-foreground">Aguardando fala…</p>
      ) : null}
      {state === "transcribing" ? <TranscriptSkeleton /> : null}
      {state === "listening" ? <ListeningDots /> : null}
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

  const onSeek = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
  }, []);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full self-stretch rounded-2xl border border-border bg-card p-4 shadow-sm">
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
