"use client";

import { Mic, Pause, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RECORD_CLUSTER_IDLE_MS } from "@/features/session/config";
import { formatMmSs } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

type RecordButtonProps = {
  running: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  /** When provided, adds a pause action to the control cluster. Omit on the
   * idle/empty state where pause has no meaning. */
  onPause?: () => void;
  /** When provided (compact cluster only), adds a discard action — end the
   * recording without generating or saving a summary. The caller is expected
   * to gate it behind a confirmation dialog. */
  onDiscard?: () => void;
  compact?: boolean;
  /** Keep the halo pulse active even while recording. Used by the audio-only
   * view where the big button is the only element on screen and needs the
   * pulse to signal "we're listening". */
  pulseWhileRunning?: boolean;
  /** Landed here from NewRecordingDialog with autostart=1 — start() is about
   * to fire but running is still false. Suppresses the "toque para começar"
   * idle prompt so the user doesn't see it flash before the recorder mounts. */
  autoStarting?: boolean;
};

export function RecordButton({
  running,
  elapsedMs,
  onStart,
  onStop,
  onPause,
  onDiscard,
  compact = false,
  pulseWhileRunning = false,
  autoStarting = false,
}: RecordButtonProps) {
  /* A barra flutuante mora por cima do feed durante a gravação inteira. Depois
     de RECORD_CLUSTER_IDLE_MS sem interação ela recolhe para o descanso — quase
     transparente e sem cor — e o primeiro toque só a reacende, sem disparar
     ação nenhuma. Quem vai pausar ou parar toca duas vezes; em troca, ninguém
     encerra uma gravação por encostar na tela enquanto lê. */
  const [awake, setAwake] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  /* Rearmar por ref, e não por dependência de effect: a contagem precisa
     recomeçar a cada interação INCLUSIVE quando a barra já está acesa, e um
     effect só reagendaria na virada do estado. */
  const wake = useCallback(() => {
    setAwake(true);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setAwake(false), RECORD_CLUSTER_IDLE_MS);
  }, []);

  useEffect(() => {
    if (!compact) return;
    wake();
    return () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [compact, wake]);

  if (compact) {
    const resting = !awake;
    return (
      <div
        onPointerEnter={wake}
        onFocusCapture={wake}
        className={cn(
          "relative flex items-center gap-2 rounded-full bg-scriba-ink-strong pl-4 pr-3 py-1.5 text-background",
          "transition-[opacity,filter,box-shadow] duration-700 ease-out motion-reduce:transition-none",
          resting
            ? "opacity-30 saturate-0 shadow-none"
            : "opacity-100 shadow-[0_10px_24px_rgba(51,65,79,0.28)]"
        )}
      >
        {resting ? (
          /* Come o toque que reacende: em descanso a barra não é alvo de ação,
             é alvo de despertar. Fora da ordem de tabulação porque o Tab já cai
             nos botões reais, e o `onFocusCapture` acima os acende antes. */
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={wake}
            className="absolute inset-0 z-10 rounded-full"
          />
        ) : null}
        <span className="relative flex size-2.5 items-center justify-center">
          {resting ? null : (
            <span className="absolute inset-0 animate-ping rounded-full bg-scriba-rec/50" />
          )}
          <span className="size-2.5 rounded-full bg-scriba-rec" />
        </span>
        <span className="font-mono text-sm font-medium tabular-nums tracking-wider">
          {formatMmSs(elapsedMs)}
        </span>
        {onPause ? (
          <>
            <span className="h-4 w-px bg-background/20" />
            <button
              type="button"
              onClick={onPause}
              aria-label="Pausar gravação"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium outline-none transition-colors",
                "hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background/40 active:scale-95"
              )}
            >
              <Pause className="size-3.5 fill-current" />
              <span className="hidden sm:inline">pausar</span>
            </button>
          </>
        ) : null}
        <span className="h-4 w-px bg-background/20" />
        <button
          type="button"
          onClick={onStop}
          aria-label="Parar gravação"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-scriba-rec/90 px-3 py-1.5 text-sm font-medium outline-none transition-colors",
            "hover:bg-scriba-rec focus-visible:ring-2 focus-visible:ring-white/40 active:scale-95"
          )}
        >
          <Square className="size-3 fill-current" />
          <span className="hidden sm:inline">parar</span>
        </button>
        {onDiscard ? (
          <>
            <span className="h-4 w-px bg-background/20" />
            <button
              type="button"
              onClick={onDiscard}
              aria-label="Descartar gravação"
              className={cn(
                "inline-flex items-center justify-center rounded-full p-2 outline-none transition-colors",
                "hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background/40 active:scale-95"
              )}
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>
    );
  }
  const showRecordingPulse = running && pulseWhileRunning;
  return (
    <div className="relative flex flex-col items-center gap-5">
      <div className="relative flex size-24 items-center justify-center">
        {showRecordingPulse ? (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-scriba-blue/50 [animation-duration:2.4s]"
          />
        ) : null}
        <button
          type="button"
          onClick={running ? onStop : onStart}
          aria-label={running ? "Parar gravação" : "Iniciar gravação"}
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink outline-none transition-colors duration-300 ease-out",
            !running && "animate-scriba-halo",
            " active:scale-95",
            "focus-visible:ring-4 focus-visible:ring-scriba-blue/40"
          )}
        >
          {running ? (
            <Square className="size-7 fill-current" />
          ) : (
            <Mic className="size-8" strokeWidth={2.2} />
          )}
        </button>
      </div>
      {running && onPause ? (
        <button
          type="button"
          onClick={onPause}
          aria-label="Pausar gravação"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-scriba-hairline bg-scriba-paper px-4 py-2 text-sm font-semibold text-scriba-ink outline-none transition-colors",
            "hover:bg-scriba-blue-soft/40",
            "focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          <Pause className="size-3.5 fill-current" />
          Pausar
        </button>
      ) : null}
      {!running && !autoStarting ? (
        <p className="max-w-xs text-pretty text-center text-sm font-light leading-relaxed text-scriba-ink-soft">
          Toque para começar a gravar.
          <br />O Scriba acompanha e organiza enquanto você ouve.
        </p>
      ) : null}
    </div>
  );
}
