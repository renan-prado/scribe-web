import { Mic, Square } from "lucide-react";
import { formatMmSs } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

export function RecordButton({
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
