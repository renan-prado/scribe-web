"use client";

import { BookOpenText, Check, FileText, type LucideIcon, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { useCoinsStore } from "@/features/coins/store";
import { requestCreateSession } from "@/features/session/lib/api";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

type Mode = "live" | "audio_only";

const MODE_COPY: Record<
  Mode,
  {
    title: string;
    icon: LucideIcon;
    costPerMinute: number;
    description: ReactNode;
    idealFor: string;
  }
> = {
  live: {
    title: "Modo Estudo",
    icon: BookOpenText,
    costPerMinute: COIN_COSTS.liveMinute,
    description: (
      <>
        Enquanto o sermão acontece, o Scriba comenta ao vivo, trazendo versículos, contextos e
        ensinamentos na tela para você acompanhar.
      </>
    ),
    idealFor: "estudos, palestras e aulas",
  },
  audio_only: {
    title: "Modo Resumo",
    icon: FileText,
    costPerMinute: COIN_COSTS.audioOnlyMinute,
    description: (
      <>
        O Scriba escuta em silêncio e, ao final, organiza tudo em um resumo estruturado com o
        essencial da mensagem.
      </>
    ),
    idealFor: "pregações, cultos e ministrações",
  },
};

const MODE_ORDER = Object.keys(MODE_COPY) as Mode[];

/**
 * Trigger + dialog for starting a new recording session. Renders a Scriba-blue
 * pill button by default ("Gravar sermão") — passing `trigger` overrides that
 * button entirely (used by the mobile bottom nav for the elevated circle).
 *
 * The dialog exposes two capture modes as selectable cards: `live` runs the
 * bible/insights/echo pipelines during recording; `audio_only` skips them and
 * only produces the final summary on stop. The start button lives below the
 * cards and reflects the cost of whichever mode is selected.
 */
export function NewRecordingDialog({ trigger }: { trigger?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("live");
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);
  const balanceLoading = balance === null;
  const minCost = mode === "audio_only" ? COIN_COSTS.audioOnlyMinute : COIN_COSTS.liveMinute;
  const insufficient = balance !== null && balance < minCost;

  async function handleStart() {
    if (loading || insufficient) return;
    setLoading(true);

    // Second-chance preflight: refetch balance in case a concurrent tab spent
    // coins while this dialog was open. The button is already disabled when
    // `insufficient` — this catches races only.
    const fresh = await refresh();
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
                "inline-flex h-8.5 items-center gap-2 rounded-full bg-scriba-blue px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,168,240,0.32)] transition-colors",
                "hover:bg-scriba-blue-hover",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
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
      <DialogContent className="flex flex-col gap-5 rounded-[28px] bg-scriba-paper px-6 py-8 sm:max-w-md">
        <DialogTitle className="text-center font-heading text-base font-semibold text-scriba-ink">
          Selecione o modo de gravação
        </DialogTitle>

        <fieldset className="flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Modo de gravação</legend>
          {MODE_ORDER.map((m) => {
            const active = mode === m;
            const { title, icon: Icon, costPerMinute, description, idealFor } = MODE_COPY[m];
            return (
              <label
                key={m}
                className={cn(
                  "relative flex flex-col gap-3.5 rounded-2xl border p-4 text-left transition-colors",
                  active
                    ? "border-scriba-blue bg-scriba-blue-soft/40 shadow-[0_6px_18px_rgba(79,168,240,0.16)]"
                    : "border-scriba-hairline bg-scriba-paper hover:border-scriba-blue/45 hover:bg-scriba-surface/60",
                  "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-scriba-blue/25",
                  loading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
              >
                <input
                  type="radio"
                  name="recording-mode"
                  value={m}
                  checked={active}
                  onChange={() => setMode(m)}
                  disabled={loading}
                  className="sr-only"
                />
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-scriba-blue text-scriba-on-blue"
                        : "bg-scriba-surface text-scriba-ink-soft"
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-scriba-ink">
                    {title}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      active
                        ? "border-scriba-blue bg-scriba-blue text-scriba-on-blue"
                        : "border-scriba-hairline"
                    )}
                  >
                    {active ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                </div>

                <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft">
                  {description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-scriba-yellow/40 bg-scriba-yellow/15 px-2.5 py-0.5 text-[11px] font-medium text-scriba-ink">
                    <span aria-hidden className="coin-hex block size-[7px] bg-scriba-yellow" />
                    <span>
                      <span className="text-scriba-ink-soft">Para</span> {idealFor}
                    </span>
                  </span>
                  {/* Below 425px the price would crowd the "Ideal para" chip — the
                      start button already shows the cost of the selected mode. */}
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-scriba-ink-soft max-[425px]:hidden">
                    <span
                      aria-hidden
                      className="coin-hex block h-[10.25px] w-[9px] bg-scriba-yellow"
                    />
                    {costPerMinute}
                    <span className="font-medium opacity-70">/min</span>
                  </span>
                </div>
              </label>
            );
          })}
        </fieldset>

        {(() => {
          if (balanceLoading) {
            return (
              <span
                aria-hidden
                className="mt-1 block h-13.5 w-full animate-pulse rounded-full bg-scriba-ink-mute/15"
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
                "mt-1 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold shadow-[0_10px_24px_rgba(79,168,240,0.32)] transition-colors",
                insufficient
                  ? "cursor-not-allowed bg-scriba-ink-mute/25 text-scriba-ink-mute shadow-none"
                  : "bg-scriba-blue text-white hover:bg-scriba-blue-hover",
                "disabled:cursor-not-allowed disabled:opacity-90",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
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
                  render={<span tabIndex={0} className="inline-flex w-full focus:outline-none" />}
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
