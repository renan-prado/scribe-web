"use client";

import {
  BookOpenText,
  Captions,
  Check,
  CreditCard,
  FileText,
  type LucideIcon,
  Mic,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { useCoinsStore } from "@/features/coins/store";
import { requestCreateSession } from "@/features/session/lib/api";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { recordingRouteFor, type SessionMode } from "@/lib/domain/session";
import { cn } from "@/lib/utils";

const MODE_COPY: Record<
  SessionMode,
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
  transcript_only: {
    title: "Modo Transcrição",
    icon: Captions,
    costPerMinute: COIN_COSTS.transcriptMinute,
    description: (
      <>
        O texto aparece na tela conforme é falado, trecho a trecho. Sem comentários e sem resumo, só
        o registro do que foi dito.
      </>
    ),
    idealFor: "quem quer o texto exato",
  },
};

const MODE_ORDER = Object.keys(MODE_COPY) as SessionMode[];

/**
 * Trigger + dialog for starting a new recording session. Renders a Scriba-blue
 * pill button by default ("Gravar sermão") — passing `trigger` overrides that
 * button entirely (used by the mobile bottom nav for the elevated circle).
 *
 * The dialog exposes the capture modes as selectable cards: `live` runs the
 * bible/insights/echo pipelines during recording; `audio_only` skips them and
 * only produces the final summary on stop; `transcript_only` skips the summary
 * too and shows the transcription as it happens. The start button lives below
 * the cards and reflects the cost of whichever mode is selected.
 */
export function NewRecordingDialog({ trigger }: { trigger?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SessionMode>("live");
  /** Compra de créditos a partir do próprio diálogo — evita mandar o usuário
   * para outra tela só para descobrir como destravar a gravação. */
  const [billingOpen, setBillingOpen] = useState(false);
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);
  const balanceLoading = balance === null;
  const minCost = MODE_COPY[mode].costPerMinute;
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
    router.push(`/recording/${result.id}/${recordingRouteFor(mode)}?autostart=1`);
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
                "inline-flex h-8.5 items-center gap-2 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-4 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] transition-colors",
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
      {/* Título e botão ficam fixos; só a lista de modos rola. O `px-4` do corpo
          soma com o `mx-2` da folga do scrollbar e dá os mesmos 24px das faixas. */}
      <DialogContent
        className="rounded-[28px] bg-scriba-paper sm:max-w-md"
        bodyClassName="flex flex-col gap-5 px-4 pt-5 pb-5"
      >
        <DialogHeader className="px-6 pt-8">
          <DialogTitle className="text-center font-heading text-base font-semibold text-scriba-ink">
            Selecione o modo de gravação
          </DialogTitle>
        </DialogHeader>

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
                  {/* Selecionado usa o gradiente do CTA, não `bg-scriba-blue`.
                      Ícone branco sobre o azul de superfície dá 2,56:1 no claro
                      e 2,33:1 no escuro — reprova até os 3:1 que a WCAG 1.4.11
                      pede para objeto gráfico, então não era opção. O gradiente
                      resolve e ainda amarra o disco ao botão "Gravar". */}
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-[image:var(--scriba-cta)] text-scriba-cta-ink"
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
                        ? "border-transparent bg-[image:var(--scriba-cta)] text-scriba-cta-ink"
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

        <DialogFooter variant="plain" className="px-6 pb-8">
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
                    : "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink",
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
            // Saldo insuficiente deixou de ser um beco sem saída com tooltip: o
            // caminho para destravar fica na frente do usuário, na mesma tela.
            return (
              <div className="mt-1 flex flex-col gap-2.5">
                <p
                  role="alert"
                  className="rounded-2xl border border-scriba-cream-accent/40 bg-scriba-cream px-4 py-3 text-center text-[12px] font-light leading-relaxed text-scriba-cream-ink"
                >
                  Você tem <strong className="font-semibold">{balance} créditos</strong> — o{" "}
                  {copy.title} custa {minCost} por minuto. Adicione créditos para começar.
                </p>
                <button
                  type="button"
                  onClick={() => setBillingOpen(true)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2.5 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-7 py-3.5 text-[15px] font-semibold text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
                  )}
                >
                  <CreditCard aria-hidden className="size-4" strokeWidth={2.4} />
                  Adicionar créditos
                </button>
              </div>
            );
          })()}
        </DialogFooter>
      </DialogContent>

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </Dialog>
  );
}
