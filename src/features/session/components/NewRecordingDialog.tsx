"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { CoinCost } from "@/components/CoinCost";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { requestCreateSession } from "@/features/session/lib/api";
import { refreshCoinBalance, useCoinBalance } from "@/features/session/lib/coins";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

type Mode = "live" | "audio_only";

const MODE_COPY: Record<Mode, { title: string; costPerMinute: number; caption: ReactNode }> = {
  live: {
    title: "Acompanhar ao vivo",
    costPerMinute: COIN_COSTS.liveMinute,
    caption: (
      <>
        Enquanto o sermão acontece, o Scriba mostra versículos, contextos, frases importantes e
        outros insights. No final, você também recebe o resumo completo.
      </>
    ),
  },
  audio_only: {
    title: "Só o resumo",
    costPerMinute: COIN_COSTS.audioOnlyMinute,
    caption: (
      <>
        O Scriba grava o sermão sem mostrar conteúdos durante a pregação. No final, você recebe os
        principais ensinamentos, versículos e aplicações organizados em um resumo.
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
  const balance = useCoinBalance();
  const balanceLoading = balance === null;
  const minCost = mode === "audio_only" ? COIN_COSTS.audioOnlyMinute : COIN_COSTS.liveMinute;
  const insufficient = balance !== null && balance < minCost;

  async function handleStart() {
    if (loading || insufficient) return;
    setLoading(true);

    // Second-chance preflight: refetch balance in case a concurrent tab spent
    // coins while this dialog was open. The button is already disabled when
    // `insufficient` — this catches races only.
    const fresh = await refreshCoinBalance();
    if (fresh !== null && fresh < minCost) {
      setLoading(false);
      toast.error("Saldo de moedas insuficiente", {
        description: `Você precisa de pelo menos ${minCost} moedas para começar.`,
      });
      return;
    }

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
            const { title, costPerMinute } = MODE_COPY[m];
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => !loading && setMode(m)}
                disabled={loading}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 leading-tight transition-colors",
                  active
                    ? "bg-white text-[color:var(--scriba-blue)] shadow-[0_2px_10px_rgba(79,168,240,0.18)]"
                    : "text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-ink)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--scriba-blue)]/40",
                  "disabled:cursor-not-allowed"
                )}
              >
                <span>{title}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium tabular-nums",
                    active ? "text-[color:var(--scriba-blue)]/70" : "text-current opacity-70"
                  )}
                >
                  <span
                    aria-hidden
                    className="block bg-[#F8C64B]"
                    style={{
                      width: "7px",
                      height: "8px",
                      clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                    }}
                  />
                  {costPerMinute}/min
                </span>
              </button>
            );
          })}
        </div>

        <p className="max-w-xs text-pretty text-center text-sm font-light leading-relaxed text-[color:var(--scriba-ink-soft)]">
          {loading ? "Preparando sessão…" : copy.caption}
        </p>

        {(() => {
          if (balanceLoading) {
            return (
              <span
                aria-hidden
                className="mt-4 inline-block h-[54px] w-[220px] animate-pulse rounded-full bg-[color:var(--scriba-ink-mute)]/15"
              />
            );
          }
          const startButton = (
            <button
              type="button"
              onClick={handleStart}
              disabled={loading || insufficient}
              aria-disabled={insufficient}
              aria-label={loading ? "Preparando sessão" : "Gravar"}
              className={cn(
                "mt-4 inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold shadow-[0_10px_24px_rgba(79,168,240,0.32)] transition-colors",
                insufficient
                  ? "cursor-not-allowed bg-[color:var(--scriba-ink-mute)]/25 text-[color:var(--scriba-ink-mute)] shadow-none"
                  : "bg-[color:var(--scriba-blue)] text-white hover:bg-[color:var(--scriba-blue-hover)]",
                "disabled:cursor-not-allowed disabled:opacity-90",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--scriba-blue)]/30"
              )}
            >
              <Mic aria-hidden className="size-4" strokeWidth={2.4} />
              {loading ? "Preparando…" : "Gravar"}
              {loading ? null : <CoinCost count={copy.costPerMinute} suffix="/min" />}
            </button>
          );
          if (!insufficient) return startButton;
          return (
            <TooltipProvider delay={120}>
              <Tooltip>
                <TooltipTrigger
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for the tooltip on a disabled button
                  render={<span tabIndex={0} className="inline-flex focus:outline-none" />}
                >
                  {startButton}
                </TooltipTrigger>
                <TooltipContent>Moedas insuficientes para gravar neste modo.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
