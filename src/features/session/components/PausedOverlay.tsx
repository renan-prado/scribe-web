import { Pause, Play, Square } from "lucide-react";
import { formatMmSs } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

type Props = {
  elapsedMs: number;
  onResume: () => void;
  onStop: () => void;
};

/**
 * Softly-veiled overlay shown while the session is paused. Preserves the feed
 * behind a blur so the user knows their work is intact; the two CTAs make the
 * only reasonable next actions explicit: resume capture or stop and generate
 * the summary. While visible, coin billing and OpenAI pipelines are frozen —
 * see `useCoinTick`, `useBackgroundKeepalive`, and the `paused` flag in the
 * session store.
 */
export function PausedOverlay({ elapsedMs, onResume, onStop }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paused-title"
      className={cn(
        "fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 px-6",
        "bg-white/85 backdrop-blur-md text-center"
      )}
    >
      <span className="relative flex size-16 items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue shadow-inner">
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-scriba-blue/25 [animation-duration:3s]"
        />
        <Pause className="relative size-7" strokeWidth={2.2} />
      </span>

      <div className="flex flex-col items-center gap-1">
        <p id="paused-title" className="font-heading text-lg font-semibold text-scriba-ink-strong">
          Gravação em pausa
        </p>
        <p className="max-w-sm text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
          Nada está sendo capturado agora. Nenhuma moeda é consumida enquanto estiver pausado.
        </p>
      </div>

      <p className="font-mono text-2xl font-semibold tabular-nums tracking-widest text-scriba-ink">
        {formatMmSs(elapsedMs)}
      </p>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onResume}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full bg-scriba-blue px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,168,240,0.32)] transition-colors outline-none",
            "hover:bg-scriba-blue-hover",
            "focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
          )}
        >
          <Play className="size-4 fill-current" />
          Retomar gravação
        </button>
        <button
          type="button"
          onClick={onStop}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-scriba-hairline bg-white px-6 py-3 text-sm font-semibold text-scriba-ink transition-colors outline-none",
            "hover:bg-scriba-blue-soft/40",
            "focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          <Square className="size-4 fill-current" />
          Encerrar e gerar resumo
        </button>
      </div>
    </div>
  );
}
