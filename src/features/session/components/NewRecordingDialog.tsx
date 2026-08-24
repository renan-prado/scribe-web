"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requestCreateSession } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

type Mode = "live" | "audio_only";

const MODE_COPY: Record<Mode, { title: string; caption: ReactNode }> = {
  live: {
    title: "Aprendizado ao vivo",
    caption: (
      <>
        Enquanto você ouve a reflexão, o Scriba traz contextos, destaca frases importantes e
        registra os principais ensinamentos.
      </>
    ),
  },
  audio_only: {
    title: "Somente o resumo",
    caption: (
      <>
        <br />O Scriba grava o áudio e, ao final, transforma o sermão em um resumo claro e
        organizado.
      </>
    ),
  },
};

/**
 * Trigger + dialog for starting a new recording session. Renders a Scriba-blue
 * pill button by default ("Gravar sermão") — passing `trigger` overrides that
 * button entirely (used by the mobile bottom nav for the elevated circle).
 *
 * The dialog exposes two capture modes as a segmented picker: `live` runs the
 * bible/insights/echo pipelines during recording; `audio_only` skips them and
 * only produces the final summary on stop.
 */
export function NewRecordingDialog({ trigger }: { trigger?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("live");

  async function handleStart() {
    if (loading) return;
    setLoading(true);
    const result = await requestCreateSession({ mode });
    if ("error" in result) {
      setLoading(false);
      toast.error("Não consegui iniciar a sessão", { description: result.error });
      return;
    }
    const route = mode === "audio_only" ? "audio" : "live";
    router.push(`/recording/${result.id}/${route}?autostart=1`);
  }

  const copy = MODE_COPY[mode];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Nova gravação"
        className={cn(
          trigger
            ? "contents"
            : cn(
                "inline-flex h-[34px] items-center gap-2 rounded-full bg-[color:var(--scriba-blue)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,168,240,0.32)] transition-colors",
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
      <DialogContent className="flex flex-col items-center gap-8 rounded-[28px] bg-white px-8 py-14">
        <DialogTitle className="sr-only">Nova gravação</DialogTitle>

        <div
          role="tablist"
          aria-label="Modo de gravação"
          className="inline-flex rounded-full bg-[color:var(--scriba-blue-soft)]/50 p-1 text-[12px] font-semibold"
        >
          {(Object.keys(MODE_COPY) as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => !loading && setMode(m)}
                disabled={loading}
                className={cn(
                  "rounded-full px-4 py-1.5 transition-colors",
                  active
                    ? "bg-white text-[color:var(--scriba-blue)] shadow-[0_2px_10px_rgba(79,168,240,0.18)]"
                    : "text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-ink)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--scriba-blue)]/40",
                  "disabled:cursor-not-allowed"
                )}
              >
                {MODE_COPY[m].title}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          aria-label={loading ? "Preparando sessão" : "Começar a gravar"}
          style={loading ? undefined : { animation: "scriba-halo 2.4s ease-out infinite" }}
          className={cn(
            "flex size-[88px] mt-4 items-center justify-center rounded-full bg-[color:var(--scriba-blue)] transition-colors",
            "hover:bg-[color:var(--scriba-blue-hover)]",
            "disabled:cursor-not-allowed disabled:opacity-80",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--scriba-blue)]/30"
          )}
        >
          <span aria-hidden className="block h-[30px] w-[22px] rounded-[12px] bg-white" />
        </button>
        <p className="max-w-xs text-pretty text-center text-sm font-light leading-relaxed text-[color:var(--scriba-ink-soft)]">
          {loading ? "Preparando sessão…" : copy.caption}
        </p>
      </DialogContent>
    </Dialog>
  );
}
