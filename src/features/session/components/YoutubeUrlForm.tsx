"use client";

import { ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { useCoinsStore } from "@/features/coins/store";
import { requestCreateSession } from "@/features/session/lib/api";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { isYoutubeVideoUrl, YOUTUBE_MAX_DURATION_MS } from "@/lib/domain/youtube";
import { cn } from "@/lib/utils";

/**
 * Colar o link. Uma tela inteira para um campo só, e é o ponto.
 *
 * Isto já morou DENTRO do diálogo de gravação, como um card de modo com um
 * `<input>` embutido, e não funcionava por duas razões que só aparecem no uso:
 * o card precisava crescer no meio de uma lista de irmãos do mesmo tamanho, e
 * o rodapé do diálogo tinha de mentir sobre a unidade do preço ("/min" num modo
 * que cobra por vídeo). Escolher COMO capturar e escolher QUAL vídeo são duas
 * perguntas, e amontoá-las num controle só piorava as duas.
 *
 * A tela não cria a sessão e não importa nada: ela valida o link e cria a linha
 * (`mode: "youtube"`), depois empurra para `/recording/:id/youtube`, que é onde
 * a cobrança e o trabalho acontecem. É a mesma divisão dos três modos de
 * gravação — o diálogo cria a linha, a página de gravação faz o trabalho.
 */

const MAX_HOURS = Math.round(YOUTUBE_MAX_DURATION_MS / 3_600_000);

export function YoutubeUrlForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);

  const cost = COIN_COSTS.youtubeImport;
  const balanceLoading = balance === null;
  const insufficient = balance !== null && balance < cost;
  const valid = isYoutubeVideoUrl(url);
  /** Só acusa link inválido depois de a pessoa ter digitado algo de verdade —
   * um erro em vermelho no primeiro caractere é ruído, não ajuda. */
  const touched = url.trim().length > 6;
  const blocked = insufficient || !valid;

  // Mesmo motivo do `NewRecordingDialog`: esta tela vive sob o layout de
  // `(app)`, que sobrevive à navegação. Sem isto o botão fica em "Preparando…"
  // se a pessoa voltar para cá pelo histórico.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só a troca de rota desarma o loading
  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  async function handleSubmit() {
    if (loading || blocked) return;
    setLoading(true);

    // Segunda conferência de saldo: outra aba pode ter gasto moedas enquanto
    // esta tela estava aberta. O botão já está desabilitado por `insufficient`
    // — isto pega só a corrida.
    const fresh = await refresh();
    if (fresh !== null && fresh < cost) {
      setLoading(false);
      toast.error("Saldo de moedas insuficiente", {
        description: `A importação de um vídeo custa ${cost} moedas.`,
      });
      return;
    }

    const result = await requestCreateSession({ mode: "youtube", sourceUrl: url.trim() });
    if ("error" in result) {
      setLoading(false);
      toast.error("Não consegui iniciar a importação", { description: result.error });
      return;
    }
    // `loading` segue ligado: a linha já existe e a próxima página é dinâmica.
    router.push(`/recording/${result.id}/youtube`);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/recordings"
        className="inline-flex w-fit items-center gap-1.5 rounded-full text-[13px] font-medium text-scriba-ink-soft transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
      >
        <ArrowLeft aria-hidden className="size-3.5" strokeWidth={2.4} />
        Biblioteca
      </Link>

      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]"
        >
          <YoutubeIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong">
            Importar do YouTube
          </h1>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
            O Scriba lê a legenda do vídeo e monta o mesmo resumo estruturado das gravações — com
            estudo, releia e frases marcantes.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <label htmlFor="youtube-url" className="px-1 text-[13px] font-medium text-scriba-ink">
          Link do vídeo
        </label>
        <input
          id="youtube-url"
          // `url` e não `text`: no celular é o teclado com "/" e ".com" à mão
          // que decide se colar um link é confortável.
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // Foca sozinho: a tela tem um campo só, e chegar aqui já é a decisão
          // de colar um link.
          // biome-ignore lint/a11y/noAutofocus: tela de campo único, o foco não disputa com nada
          autoFocus
          disabled={loading}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          aria-invalid={touched && !valid}
          aria-describedby={touched && !valid ? "youtube-url-error" : "youtube-url-hint"}
          className={cn(
            "w-full rounded-2xl border bg-scriba-paper px-4 py-3.5 text-[14px] text-scriba-ink transition-colors",
            "placeholder:text-scriba-ink-mute",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25",
            touched && !valid
              ? "border-scriba-cream-accent"
              : "border-scriba-hairline focus-visible:border-scriba-blue"
          )}
        />

        {touched && !valid ? (
          <p
            id="youtube-url-error"
            role="alert"
            className="px-1 text-[12px] font-light leading-relaxed text-scriba-cream-ink"
          >
            Cole o endereço de um vídeo. Links de canal e de playlist não funcionam aqui.
          </p>
        ) : (
          <p
            id="youtube-url-hint"
            className="px-1 text-[12px] font-light leading-relaxed text-scriba-ink-mute"
          >
            Vídeos de até {MAX_HOURS} horas, com legenda disponível no YouTube.
          </p>
        )}

        {balanceLoading ? (
          <span
            aria-hidden
            className="mt-3 block h-13.5 w-full animate-pulse rounded-full bg-scriba-ink-mute/15"
          />
        ) : insufficient ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <p
              role="alert"
              className="rounded-2xl border border-scriba-cream-accent/40 bg-scriba-cream px-4 py-3 text-center text-[12px] font-light leading-relaxed text-scriba-cream-ink"
            >
              Você tem <strong className="font-semibold">{balance} créditos</strong> — importar um
              vídeo custa {cost}. Adicione créditos para começar.
            </p>
            <button
              type="button"
              onClick={() => setBillingOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-7 py-3.5 text-[15px] font-semibold text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            >
              <CreditCard aria-hidden className="size-4" strokeWidth={2.4} />
              Adicionar créditos
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading || blocked}
            aria-disabled={blocked}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold transition-colors",
              blocked
                ? "cursor-not-allowed bg-scriba-ink-mute/25 text-scriba-ink-mute"
                : "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]",
              "disabled:cursor-not-allowed disabled:opacity-90",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            <YoutubeIcon className="size-4" />
            {loading ? "Preparando…" : "Importar"}
            {loading ? null : <CoinCost count={cost} suffix="/vídeo" />}
          </button>
        )}
      </form>

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </main>
  );
}
