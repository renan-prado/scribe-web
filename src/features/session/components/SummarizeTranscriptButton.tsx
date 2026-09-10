"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NavLink } from "@/components/NavLink";
import { PageBlurOverlay } from "@/components/PageBlurOverlay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { useCoinsStore } from "@/features/coins/store";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { cn } from "@/lib/utils";

/**
 * "Gerar resumo" na página de uma sessão gravada no modo TRANSCRIÇÃO, o único
 * modo que sai da gravação sem `final_summary`.
 *
 * Duas faces, como o `DeepenButton`:
 * - sem resumo: CTA com o custo em moedas, atrás de uma confirmação;
 * - com resumo: link neutro "Ver resumo", sem custo.
 *
 * ## Por que tem confirmação, se o `DeepenButton` não tem
 *
 * Porque aqui o gasto CONTRADIZ a escolha que a pessoa fez ao gravar: ela
 * pegou o modo mais barato justamente para não pagar LLM, e a página inteira
 * dizia que resumo não haveria. Um toque que debita 15 moedas sem avisar seria
 * lido como cobrança indevida. O diálogo diz o preço uma vez e some para
 * sempre, a ação só existe uma vez por sessão.
 *
 * O saldo insuficiente desabilita o botão com a mesma tooltip do estudo. A
 * proteção de verdade continua no servidor: `chargeCoins` devolve 402, e o 402
 * vira o mesmo toast.
 */
export const SUMMARY_FROM_TRANSCRIPT_COST = COIN_COSTS.summaryFromTranscript;

type Props = {
  sessionId: string;
  /** A sessão já tem `final_summary`, resolvido no servidor. */
  hasSummary: boolean;
};

export function SummarizeTranscriptButton({ sessionId, hasSummary }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const balance = useCoinsStore((s) => s.balance);
  const refreshCoins = useCoinsStore((s) => s.refresh);

  const href = `/recording/${sessionId}/summary`;

  if (hasSummary) {
    return (
      <NavLink
        href={href}
        className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/40"
      >
        <FileText aria-hidden className="size-3.5" />
        Ver resumo
      </NavLink>
    );
  }

  const balanceLoading = balance === null;
  const insufficient = balance !== null && balance < SUMMARY_FROM_TRANSCRIPT_COST;

  async function handleGenerate() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/final-summary/from-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 402 || body.error === "insufficient_balance") {
        toast.error("Moedas insuficientes para gerar o resumo.");
        return;
      }
      if (body.error === "session_already_summarized") {
        // A tela está velha (outra aba já gerou). Levar para o resumo é a
        // resposta certa, dizer "falhou" mentiria sobre o que existe.
        router.push(href);
        return;
      }
      if (!res.ok) {
        toast.error("Não consegui gerar o resumo. Tente novamente.");
        return;
      }
      void refreshCoins();
      toast.success("Resumo pronto.");
      router.push(href);
      router.refresh();
    } catch {
      toast.error("Falha de conexão ao gerar o resumo.");
    } finally {
      setPending(false);
    }
  }

  const button = (
    <button
      type="button"
      onClick={() => setConfirmOpen(true)}
      disabled={pending || insufficient}
      aria-disabled={insufficient}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-progress",
        insufficient
          ? "cursor-not-allowed bg-scriba-ink-mute/25 text-scriba-ink-mute"
          : "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)]"
      )}
    >
      <FileText aria-hidden className="size-3.5" />
      {pending ? "Gerando resumo…" : "Gerar resumo"}
      <CoinCost count={SUMMARY_FROM_TRANSCRIPT_COST} />
    </button>
  );

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {/* Esqueleto com a forma exata da pastilha enquanto o saldo carrega, para
          o botão não piscar habilitado → desabilitado. */}
      {balanceLoading ? (
        <span
          aria-hidden
          className="inline-block h-7.5 w-40 animate-pulse rounded-full bg-scriba-ink-mute/15"
        />
      ) : insufficient ? (
        <TooltipProvider delay={120}>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for the tooltip on a disabled button
                  tabIndex={0}
                  className="inline-flex focus:outline-none"
                />
              }
            >
              {button}
            </TooltipTrigger>
            <TooltipContent>Moedas insuficientes para gerar o resumo.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      <PageBlurOverlay
        open={pending}
        title="Gerando o resumo"
        subtitle="Lendo a transcrição inteira e separando os pontos centrais da mensagem."
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Gerar o resumo desta transcrição?"
        description={`Esta gravação foi feita no modo transcrição, que não inclui resumo. Gerar um agora custa ${SUMMARY_FROM_TRANSCRIPT_COST} moedas e roda uma vez sobre o texto completo, depois ela passa a abrir no resumo, e o estudo fica disponível.`}
        confirmLabel="Gerar resumo"
        pendingLabel="Gerando…"
        confirmVariant="default"
        onConfirm={handleGenerate}
      />
    </div>
  );
}
