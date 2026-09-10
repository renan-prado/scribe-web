"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { useCoinsStore } from "@/features/coins/store";
import { requestYoutubeImport } from "@/features/session/lib/api";
import { COIN_COSTS } from "@/lib/coins/pricing";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";

const log = createLogger("session:youtube");

/**
 * A tela de espera de uma importação do YouTube, a única "gravação" do
 * produto em que o usuário não faz nada além de esperar.
 *
 * Ela dispara `POST /api/youtube/import` ao montar e fica de pé até a resposta
 * chegar, o que leva o tempo de um resumo final sobre uma pregação inteira.
 * Quando termina, empurra para `/recording/:id/summary`.
 *
 * **Ela não mostra barra de progresso, e sim uma sequência de frases.** Não há
 * progresso REAL para mostrar: a rota é uma requisição só, e o servidor não
 * emite eventos (streaming é uma das coisas que o produto deliberadamente não
 * tem, ver o AGENTS.md da raiz). Uma barra teria de ser inventada, e barra
 * inventada que trava em 90% é pior que texto honesto. As frases avançam por
 * TEMPO e dizem o que está acontecendo de verdade, na ordem em que acontece.
 */

type Props = {
  sessionId: string;
  /** A URL do vídeo, para a tela mostrar o que está sendo importado. */
  sourceUrl: string;
};

/**
 * As etapas, com o instante em que cada frase entra. Os tempos vêm da ordem
 * real da rota: a legenda volta em 1-3s, o resumo é o que leva minutos.
 */
const STEPS = [
  { atMs: 0, label: "Buscando a legenda do vídeo…" },
  { atMs: 6_000, label: "Lendo a pregação inteira…" },
  { atMs: 25_000, label: "Organizando a mensagem em tópicos…" },
  { atMs: 60_000, label: "Separando versículos e frases marcantes…" },
  // A última não tem sucessora de propósito: passado esse ponto ninguém sabe
  // quanto falta, e trocar a frase de novo só sugeriria um progresso que não
  // está sendo medido.
  { atMs: 110_000, label: "Quase lá, finalizando o resumo…" },
] as const;

/** As mensagens de recusa. Cada uma diz o que houve E o que fazer. */
const ERROR_COPY: Record<string, { title: string; body: string; retry: boolean }> = {
  no_captions: {
    title: "Esse vídeo não tem legendas",
    body: "O Scriba lê a legenda que o YouTube já tem, sem ela, não há texto para resumir. Vídeos de canais maiores quase sempre têm legenda automática. Tente outro link.",
    retry: false,
  },
  video_not_found: {
    title: "Não consegui abrir esse vídeo",
    body: "Ele pode ser privado, ter sido removido, ou o link pode estar incompleto. Confira o endereço e tente de novo.",
    retry: false,
  },
  video_too_long: {
    title: "Esse vídeo é longo demais",
    body: "Por enquanto a importação vai até 2 horas de vídeo. Se for uma transmissão de culto inteiro, procure o corte só da pregação.",
    retry: false,
  },
  video_too_short: {
    title: "Esse vídeo é curto demais",
    body: "Não há fala suficiente para render um resumo que valha as moedas. Tente um vídeo com uma mensagem completa.",
    retry: false,
  },
  invalid_url: {
    title: "Esse link não é de um vídeo",
    body: "Links de canal e de playlist não funcionam aqui, o Scriba precisa do endereço de um vídeo específico.",
    retry: false,
  },
  provider_unavailable: {
    title: "Importação indisponível",
    body: "A importação do YouTube está temporariamente fora do ar. Nenhuma moeda foi debitada. Tente novamente mais tarde.",
    retry: true,
  },
  provider_failed: {
    title: "Não consegui buscar a legenda",
    body: "O serviço que lê as legendas não respondeu. Nenhuma moeda foi debitada. Vale tentar de novo em instantes.",
    retry: true,
  },
  summary_failed: {
    title: "O resumo falhou",
    body: "A transcrição do vídeo foi salva e está na sua gravação, só o resumo não saiu. Abra a gravação para gerá-lo de novo.",
    retry: false,
  },
};

const FALLBACK_ERROR = {
  title: "Não consegui importar esse vídeo",
  body: "Algo deu errado no caminho. Se as moedas não foram debitadas, vale tentar de novo.",
  retry: true,
};

export function YoutubeImport({ sessionId, sourceUrl }: Props) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);
  const refreshCoins = useCoinsStore((s) => s.refresh);

  /**
   * Trava de UMA importação por montagem.
   *
   * O Strict Mode do React 19 monta, desmonta e remonta todo effect em dev, e
   * sem esta trava a segunda montagem dispara um segundo POST. Ele bateria no
   * 409 de `session_already_imported` ou perderia a corrida com o primeiro,
   * mas contar com isso é contar com o servidor para consertar um bug do
   * cliente numa rota que COBRA.
   */
  const started = useRef(false);

  const runImport = useCallback(async () => {
    setError(null);
    setStepIndex(0);

    const result = await requestYoutubeImport({ sessionId });

    if (result.ok) {
      // O saldo mudou: sem isso a moeda debitada só apareceria no próximo
      // carregamento de página.
      void refreshCoins();
      router.replace(`/recording/${sessionId}/summary`);
      return;
    }

    log.warn("import failed", { sessionId, error: result.error, status: result.status });

    // 402 é o único erro cuja saída não é "tente outro link": o caminho é
    // comprar créditos, e o diálogo abre aqui mesmo.
    if (result.status === 402) {
      void refreshCoins();
      setError("insufficient_balance");
      setBillingOpen(true);
      return;
    }
    // O resumo falhou DEPOIS da cobrança, mas a transcrição está salva, então
    // a sessão existe e é legível. O saldo mudou.
    if (result.error === "summary_failed") void refreshCoins();

    setError(result.error);
  }, [sessionId, router, refreshCoins]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runImport();
  }, [runImport]);

  /** Avança as frases por tempo enquanto não há erro. */
  useEffect(() => {
    if (error) return;
    const timers = STEPS.map((step, index) =>
      step.atMs === 0 ? null : setTimeout(() => setStepIndex(index), step.atMs)
    );
    return () => {
      for (const t of timers) if (t) clearTimeout(t);
    };
  }, [error]);

  if (error) {
    const copy =
      error === "insufficient_balance"
        ? {
            title: "Saldo insuficiente",
            body: `A importação de um vídeo custa ${COIN_COSTS.youtubeImport} moedas. Nenhuma moeda foi debitada, adicione créditos e tente de novo.`,
            retry: true,
          }
        : (ERROR_COPY[error] ?? FALLBACK_ERROR);

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl border border-scriba-cream-accent/40 bg-scriba-cream text-scriba-cream-ink"
        >
          <AlertCircle className="size-6" strokeWidth={2} />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-lg font-semibold text-scriba-ink">{copy.title}</h1>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft">
            {copy.body}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          {error === "insufficient_balance" ? (
            <button
              type="button"
              onClick={() => setBillingOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-7 py-3.5 text-[15px] font-semibold text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            >
              Adicionar créditos
            </button>
          ) : null}

          {copy.retry ? (
            <button
              type="button"
              onClick={() => void runImport()}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold transition-colors",
                error === "insufficient_balance"
                  ? "border border-scriba-hairline text-scriba-ink hover:bg-scriba-surface/60"
                  : "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
              )}
            >
              Tentar de novo
            </button>
          ) : null}

          {/* A sessão foi salva: o caminho útil é abri-la, não voltar. */}
          {error === "summary_failed" ? (
            <Link
              href={`/recording/${sessionId}/summary`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-7 py-3.5 text-[15px] font-semibold text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            >
              Abrir a gravação
            </Link>
          ) : null}

          <Link
            href="/recordings"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-7 py-3 text-[13px] font-medium text-scriba-ink-soft transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
          >
            <ArrowLeft aria-hidden className="size-3.5" strokeWidth={2.4} />
            Voltar para as gravações
          </Link>
        </div>

        <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-7 px-6 py-12 text-center">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]"
      >
        <YoutubeIcon className="size-6" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-lg font-semibold text-scriba-ink">
          Importando do YouTube
        </h1>
        <p className="break-all text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          {sourceUrl}
        </p>
      </div>

      {/* `aria-live="polite"`: quem usa leitor de tela ouve cada etapa nova sem
          ter o foco roubado. O `role="status"` faz a região ser anunciada
          mesmo sem foco nenhum nela. */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-[2.5rem] text-pretty text-[14px] font-light leading-relaxed text-scriba-ink-soft"
      >
        {STEPS[stepIndex].label}
      </p>

      <div aria-hidden className="flex items-center gap-1.5">
        {STEPS.map((step, index) => (
          <span
            key={step.atMs}
            className={cn(
              "block size-1.5 rounded-full transition-colors",
              index <= stepIndex ? "bg-scriba-blue" : "bg-scriba-ink-mute/25"
            )}
          />
        ))}
      </div>

      <p className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
        Isso leva alguns minutos numa pregação longa. Pode deixar a tela aberta.
      </p>
    </main>
  );
}
