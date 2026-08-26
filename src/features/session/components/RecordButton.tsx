import { Mic, Square } from "lucide-react";
import { formatMmSs } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

type RecordButtonProps = {
  running: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
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
  compact = false,
  pulseWhileRunning = false,
  autoStarting = false,
}: RecordButtonProps) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Parar gravação"
        className={cn(
          "group flex items-center gap-3 rounded-full bg-scriba-ink-strong px-5 py-3.5 text-white shadow-[0_10px_24px_rgba(51,65,79,0.28)] outline-none transition-all",
          "hover:bg-scriba-ink-strong/95 hover:shadow-[0_12px_28px_rgba(51,65,79,0.35)]",
          "focus-visible:ring-2 focus-visible:ring-white/40 active:scale-95"
        )}
      >
        <span className="relative flex size-2.5 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#F0564E]/50" />
          <span className="size-2.5 rounded-full bg-[#F0564E]" />
        </span>
        <span className="font-mono text-sm font-medium tabular-nums tracking-wider">
          {formatMmSs(elapsedMs)}
        </span>
        <span className="h-4 w-px bg-white/25" />
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Square className="size-2.5 fill-current" />
          parar
        </span>
      </button>
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
            "relative flex size-24 items-center justify-center rounded-full bg-scriba-blue text-white outline-none transition-colors duration-300 ease-out",
            !running && "animate-scriba-halo",
            "hover:bg-scriba-blue-hover active:scale-95",
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
      {!running && !autoStarting ? (
        <p className="max-w-xs text-pretty text-center text-sm font-light leading-relaxed text-scriba-ink-soft">
          Toque para começar a gravar.
          <br />O Scriba acompanha e organiza enquanto você ouve.
        </p>
      ) : null}
    </div>
  );
}
