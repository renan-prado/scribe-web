import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function HiddenTabOverlay({ onDismiss }: { onDismiss: () => void }) {
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
