"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requestCreateSession } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

/**
 * Trigger + dialog for starting a new recording session. Renders a Scriba-blue
 * pill button by default ("Gravar sermão") — passing `trigger` overrides that
 * button entirely (used by the mobile bottom nav for the elevated circle).
 */
export function NewRecordingDialog({ trigger }: { trigger?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (loading) return;
    setLoading(true);
    const result = await requestCreateSession({});
    if ("error" in result) {
      setLoading(false);
      toast.error("Não consegui iniciar a sessão", { description: result.error });
      return;
    }
    router.push(`/recording/${result.id}/live?autostart=1`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Nova gravação"
        className={cn(
          trigger
            ? "contents"
            : cn(
                "inline-flex items-center gap-2 rounded-full bg-[color:var(--scriba-blue)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,168,240,0.32)] transition-colors",
                "hover:bg-[color:var(--scriba-blue-hover)]",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--scriba-blue)]/30"
              )
        )}
      >
        {trigger ?? (
          <>
            <Mic className="size-4" strokeWidth={2.4} />
            <span className="hidden sm:inline">Gravar</span>
            <span className="sm:hidden">Gravar</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col items-center gap-8 rounded-[28px] bg-white px-8 py-16">
        <DialogTitle className="sr-only">Nova gravação</DialogTitle>
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          aria-label={loading ? "Preparando sessão" : "Começar a gravar"}
          style={loading ? undefined : { animation: "scriba-halo 2.4s ease-out infinite" }}
          className={cn(
            "flex size-[88px] items-center justify-center rounded-full bg-[color:var(--scriba-blue)] transition-colors",
            "hover:bg-[color:var(--scriba-blue-hover)]",
            "disabled:cursor-not-allowed disabled:opacity-80",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--scriba-blue)]/30"
          )}
        >
          <span aria-hidden className="block h-[30px] w-[22px] rounded-[12px] bg-white" />
        </button>
        <p className="max-w-xs text-pretty text-center text-sm font-light leading-relaxed text-[color:var(--scriba-ink-soft)]">
          {loading ? (
            "Preparando sessão…"
          ) : (
            <>
              Toque para começar a gravar.
              <br />O Scriba acompanha e organiza as ideias enquanto você ouve.
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
