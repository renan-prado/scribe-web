import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function HiddenTabOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="hidden-tab-title"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/90 px-6 text-center backdrop-blur-md"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--scriba-blue-soft)] text-[color:var(--scriba-blue)]">
        <AlertTriangle className="size-5" strokeWidth={2.2} />
      </span>
      <div className="flex flex-col items-center gap-2">
        <p
          id="hidden-tab-title"
          className="font-heading text-base font-semibold text-[color:var(--scriba-ink-strong)]"
        >
          A gravação precisa desta aba em foco
        </p>
        <p className="max-w-sm text-pretty text-sm font-light leading-relaxed text-[color:var(--scriba-ink-soft)]">
          Enquanto a aba fica em segundo plano, o navegador pode pausar a captura e trechos da fala
          podem ter sido perdidos. Volte assim que puder para continuar sem furos.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "rounded-full bg-[color:var(--scriba-blue)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_14px_rgba(79,168,240,0.32)] transition-colors outline-none",
          "hover:bg-[color:var(--scriba-blue-hover)]",
          "focus-visible:ring-4 focus-visible:ring-[color:var(--scriba-blue)]/30"
        )}
      >
        Entendi, continuar
      </button>
    </div>
  );
}
