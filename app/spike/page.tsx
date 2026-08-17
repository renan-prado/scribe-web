"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChunkEvent, createRecorder, type Recorder } from "@/lib/recorder";

type ChunkStatus = "uploading" | "ok" | "silence" | "error";

type ChunkRow = {
  index: number;
  timestamp: string;
  status: ChunkStatus;
  latencyMs: number | null;
  text: string;
  errorMessage?: string;
};

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

type FinalAudio = { url: string; extension: string; sizeBytes: number };

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
): Promise<{ ok: true; text: string; latencyMs: number } | { ok: false; message: string }> {
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
        return { ok: true, text: body.text ?? "", latencyMs: body.latencyMs ?? 0 };
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
  const [mimeType, setMimeType] = useState<string>("");
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [visibilityLog, setVisibilityLog] = useState<string[]>([]);
  const [finalAudio, setFinalAudio] = useState<FinalAudio | null>(null);
  const [wakeLockStatus, setWakeLockStatus] = useState<string>("idle");
  const [startupError, setStartupError] = useState<string>("");

  const publish = useCallback(() => {
    const rows = Array.from(chunksRef.current.values()).sort((a, b) => a.index - b.index);
    setChunkRows(rows);
  }, []);

  const accumulatedText = useMemo(() => {
    return chunkRows
      .filter((r) => r.status === "ok")
      .map((r) => r.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, [chunkRows]);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      const row: ChunkRow = {
        index: ev.index,
        timestamp: formatMmSs(ev.startedAt - startedAtRef.current),
        status: "uploading",
        latencyMs: null,
        text: "",
      };
      chunksRef.current.set(ev.index, row);
      publish();

      if (await isSilentBlob(ev.blob)) {
        chunksRef.current.set(ev.index, {
          ...row,
          status: "silence",
          latencyMs: 0,
          text: "",
        });
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
        chunksRef.current.set(ev.index, {
          ...current,
          status: "ok",
          latencyMs: result.latencyMs,
          text: result.text,
        });
      } else {
        chunksRef.current.set(ev.index, {
          ...current,
          status: "error",
          errorMessage: result.message,
        });
        setErrorCount((n) => n + 1);
      }
      publish();
    },
    [publish]
  );

  const requestWakeLock = useCallback(async () => {
    const wl = (navigator as unknown as { wakeLock?: WakeLock }).wakeLock;
    if (!wl || typeof wl.request !== "function") {
      setWakeLockStatus("unsupported");
      return;
    }
    try {
      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockStatus("held");
      sentinel.addEventListener("release", () => setWakeLockStatus("released"));
    } catch (err) {
      setWakeLockStatus(`error: ${(err as Error).message}`);
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
      setWakeLockStatus("released");
    }
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    setStartupError("");
    setFinalAudio(null);
    setChunkRows([]);
    setErrorCount(0);
    setVisibilityLog([]);
    chunksRef.current = new Map();

    const rec = createRecorder({
      minChunkMs: 20_000,
      maxChunkMs: 45_000,
      silenceThreshold: 0.01,
      silenceHoldMs: 400,
    });
    rec.onChunk(handleChunk);
    rec.onError((e) => {
      setErrorCount((n) => n + 1);
      setVisibilityLog((log) => [
        ...log,
        `${formatMmSs(performance.now() - startedAtRef.current)} — recorder error (${e.source}): ${e.message}`,
      ]);
    });
    rec.onFinalAudio((ev) => {
      const url = URL.createObjectURL(ev.blob);
      setFinalAudio({ url, extension: ev.extension, sizeBytes: ev.blob.size });
    });

    try {
      const info = await rec.start();
      recorderRef.current = rec;
      setMimeType(info.mimeType);
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
      const stamp = formatMmSs(performance.now() - startedAtRef.current);
      setVisibilityLog((log) => [...log, `${stamp} — visibility: ${document.visibilityState}`]);
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

  const copyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accumulatedText);
    } catch {
      // fall back to selecting
    }
  }, [accumulatedText]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Spike: gravação + transcrição</h1>
        <p className="text-sm text-gray-600">
          Descartável. Prova de conceito para gravar ~50 min em celular com transcrição
          quase-real-time.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="rounded bg-red-600 px-4 py-2 font-medium text-white"
          >
            Parar
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="rounded bg-black px-4 py-2 font-medium text-white"
          >
            Iniciar
          </button>
        )}
        <div className="font-mono text-lg">{formatMmSs(elapsedMs)}</div>
        <div className="text-sm text-gray-600">Erros: {errorCount}</div>
        <div className="text-sm text-gray-600">Chunks: {chunkRows.length}</div>
      </section>

      <section className="grid grid-cols-1 gap-2 text-xs text-gray-700 sm:grid-cols-2">
        <div>
          <span className="text-gray-500">mimeType:</span>{" "}
          <span className="font-mono">{mimeType || "—"}</span>
        </div>
        <div>
          <span className="text-gray-500">wake lock:</span>{" "}
          <span className="font-mono">{wakeLockStatus}</span>
        </div>
        {startupError ? (
          <div className="col-span-full text-red-600">Startup: {startupError}</div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transcrição acumulada</h2>
          <button
            type="button"
            onClick={copyTranscript}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            Copiar
          </button>
        </div>
        <textarea
          readOnly
          value={accumulatedText}
          className="min-h-[160px] w-full rounded border border-gray-300 p-2 font-mono text-sm"
          placeholder="(vazio)"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Chunks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">t</th>
                <th className="px-2 py-1">status</th>
                <th className="px-2 py-1">latência</th>
                <th className="px-2 py-1">texto</th>
              </tr>
            </thead>
            <tbody>
              {chunkRows.map((row) => (
                <tr key={row.index} className="border-b border-gray-200 align-top">
                  <td className="px-2 py-1 font-mono">{row.index}</td>
                  <td className="px-2 py-1 font-mono">{row.timestamp}</td>
                  <td className="px-2 py-1">
                    {row.status === "ok" ? (
                      <span className="text-green-700">ok</span>
                    ) : row.status === "uploading" ? (
                      <span className="text-blue-700">enviando</span>
                    ) : row.status === "silence" ? (
                      <span className="text-gray-500">silêncio</span>
                    ) : (
                      <span className="text-red-700" title={row.errorMessage}>
                        erro
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {row.latencyMs != null ? `${row.latencyMs} ms` : "—"}
                  </td>
                  <td className="px-2 py-1">
                    {row.status === "error" ? (
                      <span className="text-red-700">{row.errorMessage}</span>
                    ) : (
                      row.text || "—"
                    )}
                  </td>
                </tr>
              ))}
              {chunkRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-gray-500">
                    (sem chunks)
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Áudio contínuo</h2>
        {finalAudio ? (
          <div className="flex flex-col gap-2">
            {/* biome-ignore lint/a11y/useMediaCaption: playback of user-recorded audio */}
            <audio
              controls
              src={finalAudio.url}
              className="w-full"
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                // MediaRecorder WebM has no duration in the header (Infinity). Force
                // Chrome to compute it by seeking past the end, then reset to 0.
                if (!Number.isFinite(el.duration)) {
                  const reset = () => {
                    el.removeEventListener("durationchange", reset);
                    el.removeEventListener("timeupdate", reset);
                    el.currentTime = 0;
                  };
                  el.addEventListener("durationchange", reset);
                  el.addEventListener("timeupdate", reset);
                  el.currentTime = 1e101;
                }
              }}
            />
            <a
              href={finalAudio.url}
              download={`spike.${finalAudio.extension}`}
              className="inline-block w-fit rounded border border-gray-300 px-2 py-1 text-xs"
            >
              Baixar ({Math.round(finalAudio.sizeBytes / 1024)} KB)
            </a>
          </div>
        ) : (
          <p className="text-xs text-gray-500">(disponível quando a gravação for parada)</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Log de eventos</h2>
        <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs">
          {visibilityLog.join("\n") || "(vazio)"}
        </pre>
      </section>
    </main>
  );
}
