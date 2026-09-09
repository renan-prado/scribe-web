"use client";

import { AudioLines, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { LiveTranscriptStream } from "@/features/session/components/LiveTranscriptStream";
import { PausedOverlay } from "@/features/session/components/PausedOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { RecordingDock } from "@/features/session/components/RecordingDock";
import { RecordingHeader } from "@/features/session/components/RecordingHeader";
import { RecordingViewTabs } from "@/features/session/components/RecordingViewTabs";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { TranscriptView } from "@/features/session/components/TranscriptView";
import {
  POOR_AUDIO_BAD_COUNT,
  POOR_AUDIO_WINDOW,
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
} from "@/features/session/config";
import { useBackgroundKeepalive } from "@/features/session/hooks/useBackgroundKeepalive";
import { useCoinGuard } from "@/features/session/hooks/useCoinGuard";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import {
  requestDeleteSession,
  requestFinalSummary,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { notifyCoinsRecovered, warnLowCoins } from "@/features/session/lib/coinToasts";
import { reportRecorderError } from "@/features/session/lib/recorderErrors";
import { formatMmSs, tailSentences } from "@/features/session/lib/text";
import { getSessionState } from "@/features/session/store";
import type { ChunkRow, TranscriptState } from "@/features/session/types";
import { COIN_COSTS } from "@/lib/coins/pricing";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { createLogger } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";

const log = createLogger("session:audio");

/** Amarram cada aba ao seu `role="tabpanel"`. */
const MIC_PANEL_ID = "recording-audio-mic";
const TRANSCRIPT_PANEL_ID = "recording-audio-transcript";

/** Distância do fim, em px, dentro da qual a rolagem ainda conta como
 * "acompanhando". Mesmo valor do modo transcrição. */
const AUTO_FOLLOW_BOTTOM_PX = 140;

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
  const chunksRef = useRef<Map<number, { text: string; suspect: boolean }>>(new Map());
  const autoStartFiredRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [qualityPoor, setQualityPoor] = useState(false);
  /**
   * Espelho do estado acima, e o equivalente local do `audioQuality` do store —
   * este modo não usa o session store. Precisa ser ref porque quem o lê é o
   * `handleChunk`, um useCallback estável: ler o state ali devolveria sempre o
   * valor do primeiro render, e o aviso subiria uma vez por chunk ruim em vez
   * de uma vez por sessão. Pegajoso até o fim da gravação, como no modo live.
   */
  const qualityPoorRef = useRef(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  /**
   * A leitura calma, agrupada por minuto — a mesma que o live e o modo
   * transcrição oferecem. Não é duplicação da aba: a aba é o fluxo de trechos
   * na ordem em que chegaram, para CONFERIR; o diálogo junta em parágrafos,
   * para reler.
   */
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  /**
   * Qual das duas visões está na tela. O microfone é o padrão — este modo
   * existe para quem quer gravar e guardar o telefone.
   */
  const [view, setView] = useState<"mic" | "transcript">("mic");
  /**
   * Espelho de `chunksRef` para RENDER, e a razão de os dois existirem: o ref
   * segue sendo a fonte do texto que vai para o resumo final, porque quem o lê
   * é um `useCallback` estável e um state ali seria sempre o do primeiro
   * render. O array abaixo não tem esse problema — ninguém o lê dentro de
   * callback — e é o que a transcrição na tela consome.
   */
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  /** Autoscroll da transcrição; desliga quando o usuário sobe para reler. */
  const [follow, setFollow] = useState(true);

  const activelyRecording = running && !paused;
  const elapsedMs = useElapsedTimer(activelyRecording, startedAtRef);
  useWakeLock({ enabled: activelyRecording });

  const assembleTranscript = useCallback((opts?: { excludeSuspect?: boolean }) => {
    const indices = Array.from(chunksRef.current.keys()).sort((a, b) => a - b);
    return indices
      .map((i) => chunksRef.current.get(i))
      .filter(
        (c): c is { text: string; suspect: boolean } =>
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
      // O chunk de silêncio sai ANTES de virar linha: ele não tem texto para
      // mostrar e ficaria como um esqueleto que nunca resolve.
      if (await isSilentBlob(ev.blob)) return;
      const startedAtMs = Math.max(0, ev.startedAt - startedAtRef.current);
      setChunkRows((rows) => [
        ...rows,
        { index: ev.index, status: "uploading", text: "", startedAtMs },
      ]);
      // Chunks suspeitos (assinatura de alucinação detectada no servidor) não
      // entram no hint — realimentá-los tende a repetir a alucinação.
      const previousText = assembleTranscript({ excludeSuspect: true });
      const prevHint = tailSentences(previousText, 2);
      const result = await uploadChunkWithRetry(ev, prevHint, sessionId);
      setChunkRows((rows) =>
        rows.map((r) =>
          r.index === ev.index
            ? result.ok
              ? { ...r, status: "ok" as const, text: result.text, suspect: result.suspect }
              : { ...r, status: "error" as const }
            : r
        )
      );
      if (result.ok) {
        chunksRef.current.set(ev.index, { text: result.text, suspect: result.suspect });
        if (!qualityPoorRef.current) {
          const recent = Array.from(chunksRef.current.keys())
            .sort((a, b) => a - b)
            .slice(-POOR_AUDIO_WINDOW)
            .map((i) => chunksRef.current.get(i));
          if (recent.filter((c) => c?.suspect).length >= POOR_AUDIO_BAD_COUNT) {
            qualityPoorRef.current = true;
            setQualityPoor(true);
            log.debug("poor audio", { index: ev.index });
            toast.warning("Áudio com qualidade baixa detectada.", {
              description: "Aproxime o aparelho de quem está falando, se der.",
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
    setChunkRows([]);
    setFollow(true);
    // Este modo não guarda running/paused no store — mas o `RecordingHeader`
    // lê título, autor, local e início DE LÁ, e é o mesmo header dos outros
    // dois modos. Semear aqui é o que dá a este modo a edição de metadados que
    // ele nunca teve; sem isso o header desenharia os dados da sessão anterior.
    getSessionState().reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    getSessionState().setRecordingStartedAt(new Date());
    qualityPoorRef.current = false;
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
    rec.onError((ev) => reportRecorderError(sessionId, ev));
    try {
      await rec.start();
      recorderRef.current = rec;
      // startedAtRef MUST be seeded before setRunning(true) so useElapsedTimer
      // observes a valid origin on first render — see AGENTS.md guardrails.
      startedAtRef.current = performance.now();
      setRunning(true);
      setPaused(false);
      log.debug("start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId, initialSpeakerName, initialSpeakerLocation]);

  const pause = useCallback(async () => {
    if (!recorderRef.current || paused) return;
    pausedElapsedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    const indices = Array.from(chunksRef.current.keys());
    nextChunkIndexRef.current = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    setPaused(true);
    await recorderRef.current.stop();
    recorderRef.current = null;
    log.debug("pause", {
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
    rec.onError((ev) => reportRecorderError(sessionId, ev));
    try {
      await rec.start();
      recorderRef.current = rec;
      startedAtRef.current = performance.now() - pausedElapsedRef.current;
      setPaused(false);
      log.debug("resume", {
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
      router.replace("/recordings");
      return;
    }

    setFinalizing(true);
    try {
      const result = await requestFinalSummary({
        sessionId,
        text: transcript,
        feedItems: [],
        durationMs,
        // Do STORE, não das props: o header pode ter sido editado durante a
        // gravação, e salvar a prop descartaria a edição em silêncio.
        speakerName: getSessionState().speakerName,
        speakerLocation: getSessionState().speakerLocation,
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
  }, [assembleTranscript, paused, sessionId, router]);

  /**
   * Encerrar SEM gerar resumo, apagando a sessão. Mesmo fluxo dos outros dois
   * modos — este era o único que não o tinha, e quem começava uma gravação por
   * engano só podia parar e esperar um resumo que não queria (pagando por ele).
   * Quem abre a confirmação é o chamador; aqui já é o "sim".
   */
  const discard = useCallback(async () => {
    log.debug("discard", { sessionId });
    setRunning(false);
    setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;
    await requestDeleteSession(sessionId);
    getSessionState().reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    toast.success("Gravação descartada.");
    router.replace("/recordings");
  }, [router, sessionId, initialSpeakerName, initialSpeakerLocation]);

  // Cobrança: `COIN_COSTS.audioOnlyMinute` moedas/min iniciado. Pausado não debita; `useCoinTick`
  // preserva o minuto corrente para retomar não gerar débito extra. Ao
  // esgotar, a captura é congelada (pause) em vez de encerrada.
  const coinGuard = useCoinGuard({
    enabled: activelyRecording,
    reason: "audio_only_minute",
    sessionId,
    costPerMinute: COIN_COSTS.audioOnlyMinute,
    onFreeze: () => void pause(),
    onWarn: (minutesLeft, level) => warnLowCoins(minutesLeft, level, () => setBillingOpen(true)),
    onRecovered: notifyCoinsRecovered,
  });

  // Background-recording defenses (silent audio + Media Session + RN bridge)
  // and browser close-confirmation. See hook docs for full rationale.
  useBackgroundKeepalive({
    phase: running ? (paused ? "paused" : "recording") : "idle",
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

  // Desliga o autoscroll quando o usuário sobe para reler, e religa quando ele
  // volta ao fim. Só a aba da transcrição rola; a do microfone cabe na tela.
  useEffect(() => {
    if (view !== "transcript") return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setFollow(distanceFromBottom <= AUTO_FOLLOW_BOTTOM_PX);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);

  // A aba do microfone não rola; voltar para ela com a página parada no meio
  // da transcrição deixaria a tela em branco.
  useEffect(() => {
    if (view === "mic") window.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  const hasStarted = running || chunkRows.length > 0;
  const hasTranscriptText = chunkRows.some((r) => r.status === "ok" && r.text.trim().length > 0);
  const transcriptState: TranscriptState = running
    ? chunkRows.some((r) => r.status === "uploading")
      ? "transcribing"
      : "listening"
    : "idle";
  const qualityBanner =
    running && qualityPoor ? (
      <div
        role="status"
        className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
      >
        <p className="font-semibold">Áudio com qualidade baixa</p>
        <p className="mt-1">
          A transcrição pode conter erros. Se possível, aproxime o aparelho da caixa de som ou de
          quem está falando — distância e eco são o que mais atrapalham. Você pode continuar ou
          encerrar a gravação.
        </p>
      </div>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      {/* O MESMO cabeçalho do live e do modo transcrição, e não mais um menu
          solto no canto: título, autor e local passam a ser editáveis aqui
          também. Era a diferença que sobrava entre os três modos. */}
      {hasStarted ? (
        <>
          <RecordingHeader
            menu={
              <SessionMenu
                hasTranscript={hasTranscriptText}
                hasLiveFeed={false}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onOpenLiveFeed={() => undefined}
                onReportHallucination={() => setReportOpen(true)}
                onDiscard={running ? () => setDiscardOpen(true) : undefined}
              />
            }
          />
          <div className="h-px w-full bg-scriba-hairline" />
        </>
      ) : null}

      {view === "mic" ? (
        <div
          id={MIC_PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${MIC_PANEL_ID}-tab`}
          className="flex flex-1 flex-col items-center justify-center gap-10 pb-28"
        >
          {/* Enquanto grava, o círculo é só o pulso de "estamos ouvindo" — quem
              comanda é a barra flutuante, igual aos outros dois modos. Antes de
              começar ele continua sendo o convite para tocar. */}
          <RecordButton
            running={running}
            elapsedMs={elapsedMs}
            onStart={start}
            onStop={stop}
            pulseWhileRunning
            indicator
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
          {qualityBanner}
        </div>
      ) : (
        /* O MESMO componente do modo transcrição: cada trecho com o carimbo de
           tempo dele, entrando na tela quando o /api/transcribe responde. O
           `pb-32` abre espaço para a faixa fixa do rodapé não cobrir a última
           linha. */
        <div
          id={TRANSCRIPT_PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${TRANSCRIPT_PANEL_ID}-tab`}
          className="flex flex-1 flex-col gap-6 pb-44"
        >
          {qualityBanner}
          <LiveTranscriptStream rows={chunkRows} running={running} follow={follow} />
        </div>
      )}

      {/* A faixa só aparece depois que há gravação: antes disso a tela é o
          convite para tocar no microfone, e uma aba de transcrição vazia ao
          lado dele só competiria com ele. */}
      {hasStarted ? (
        <RecordingDock
          tabs={
            <RecordingViewTabs
              label="Visão da gravação"
              value={view}
              onChange={setView}
              tabs={[
                { value: "mic", label: "Gravação", icon: <AudioLines />, panelId: MIC_PANEL_ID },
                {
                  value: "transcript",
                  label: "Transcrição",
                  icon: <FileText />,
                  panelId: TRANSCRIPT_PANEL_ID,
                },
              ]}
            />
          }
          // A barra vale nas DUAS abas. Ela já esteve presa à da transcrição,
          // e o resultado era o modo áudio sem pausar, parar ou descartar
          // enquanto o microfone estava na tela — a mesma barra que os outros
          // dois modos têm o tempo todo.
          control={
            running && !paused ? (
              <RecordButton
                running={running}
                elapsedMs={elapsedMs}
                onStart={start}
                onStop={stop}
                onPause={pause}
                onDiscard={() => setDiscardOpen(true)}
                compact
              />
            ) : null
          }
        />
      ) : null}

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
        <PausedOverlay
          elapsedMs={elapsedMs}
          onResume={() => void resume()}
          onStop={stop}
          onDiscard={() => setDiscardOpen(true)}
          outOfCoins={coinGuard.outOfCoins}
        />
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

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar esta gravação?"
        description="Tudo o que foi capturado até agora será apagado e nenhum resumo será gerado. Esta ação não pode ser desfeita."
        confirmLabel="Descartar"
        pendingLabel="Descartando…"
        onConfirm={discard}
      />

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
      {finalizing ? <FinalizingOverlay /> : null}
    </main>
  );
}
