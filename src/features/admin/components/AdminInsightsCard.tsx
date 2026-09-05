"use client";

import { AlertTriangle, CircleCheck, Info, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AdminInsightScope,
  type AdminInsightsRecord,
  type InsightSeverity,
  isInsightStale,
} from "@/lib/domain/admin-insights";
import { cn } from "@/lib/utils";

/**
 * O card de análise das três telas de dinheiro do painel.
 *
 * ## Por que ele gera do CLIENTE, e não no server component
 *
 * A análise é um modelo de raciocínio sobre o agregado inteiro: ~85 segundos,
 * medido. Gerá-la dentro do render da página faria a primeira visita do dia
 * ficar um minuto e meio em branco — e não a de quem pediu o insight, a de
 * quem só queria conferir o MRR. Então o servidor entrega o que já está
 * gravado (uma leitura de uma linha) e este componente decide, já com a tela
 * desenhada, se vale disparar a geração.
 *
 * Consequência aceita: a página não espera pelo card. Ele chega depois, e é
 * assim que tem de ser.
 *
 * ## O disparo automático acontece UMA vez
 *
 * `firedRef` existe porque o efeito roda duas vezes no StrictMode do dev, e
 * dois disparos aqui são duas chamadas de modelo caro. A rota reconfere a
 * validade do lado dela — esta guarda é a primeira das duas, não a única.
 */

const SEVERITY: Record<
  InsightSeverity,
  { badge: string; label: string; icon: typeof AlertTriangle; text: string }
> = {
  critical: {
    badge: "bg-scriba-rose",
    label: "text-scriba-rose-accent",
    icon: AlertTriangle,
    text: "Crítico",
  },
  warning: {
    badge: "bg-scriba-cream",
    label: "text-scriba-cream-accent",
    icon: Info,
    text: "Atenção",
  },
  ok: {
    badge: "bg-scriba-mint",
    label: "text-scriba-mint-accent",
    icon: CircleCheck,
    text: "Oportunidade",
  },
};

const WHEN = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  scope: AdminInsightScope;
  /** O que estava gravado quando a página renderizou. `null` = nunca gerado. */
  initial: AdminInsightsRecord | null;
};

type Status = "idle" | "loading" | "upstream" | "unparseable" | "network" | "unsaved";
/** O que falhou e o que o servidor disse. Só admin lê esta tela. */
type Failure = { status: Status; detail: string | null };

export function AdminInsightsCard({ scope, initial }: Props) {
  const [record, setRecord] = useState<AdminInsightsRecord | null>(initial);
  const [failure, setFailure] = useState<Failure>({ status: "idle", detail: null });
  const firedRef = useRef(false);

  const run = useCallback(
    async (force: boolean) => {
      setFailure({ status: "loading", detail: null });
      try {
        const res = await fetch("/api/admin/insights", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, force }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          setFailure({
            status: body.error === "unparseable" ? "unparseable" : "upstream",
            detail: body.detail ?? `HTTP ${res.status}`,
          });
          return;
        }
        const body = (await res.json()) as {
          record: AdminInsightsRecord;
          persistError?: string | null;
        };
        setRecord(body.record);
        // A leitura chegou; se ela não foi GRAVADA, isso é um aviso ao lado do
        // texto, não um erro no lugar dele — o conteúdo é o mesmo e já foi pago.
        setFailure(
          body.persistError
            ? { status: "unsaved", detail: body.persistError }
            : { status: "idle", detail: null }
        );
      } catch (err) {
        setFailure({ status: "network", detail: (err as Error).message });
      }
    },
    [scope]
  );

  useEffect(() => {
    if (firedRef.current) return;
    if (!isInsightStale(initial?.generatedAt)) return;
    firedRef.current = true;
    void run(false);
  }, [initial?.generatedAt, run]);

  const loading = failure.status === "loading";

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-scriba-ink-strong">
          <span
            aria-hidden
            className="size-3.5 bg-scriba-yellow [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          />
          Leitura da IA
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {record ? (
            <span className="text-[11px] font-light uppercase tracking-[0.1em] text-scriba-ink-mute">
              {WHEN.format(new Date(record.generatedAt))} · {record.windowDays} dias ·{" "}
              {record.model}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => run(true)}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-scriba-hairline px-3 py-1 text-[11.5px] font-medium text-scriba-ink-soft transition-colors hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-blue disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            {loading ? "Analisando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {record ? (
        <>
          <p className="text-[13.5px] leading-relaxed text-scriba-ink-strong">
            {record.payload.headline}
          </p>
          <ul className="flex flex-col divide-y divide-scriba-hairline">
            {record.payload.insights.map((insight) => {
              const tone = SEVERITY[insight.severity];
              const Icon = tone.icon;
              return (
                <li key={insight.title} className="flex flex-col gap-1.5 py-3.5 first:pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                        tone.badge
                      )}
                    >
                      <Icon className={cn("size-3", tone.label)} />
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.08em]",
                          tone.label
                        )}
                      >
                        {tone.text}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-scriba-ink-strong">
                      {insight.title}
                    </span>
                  </div>
                  <p className="text-[12.5px] font-light leading-relaxed text-scriba-ink-soft">
                    {insight.finding}
                  </p>
                  {/* A ação é a única linha em cor de tinta cheia: é o que
                      separa este card de um parágrafo de análise. */}
                  <p className="text-[12.5px] leading-relaxed text-scriba-ink">
                    <span className="font-semibold">→ </span>
                    {insight.action}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-[12.5px] font-light leading-relaxed text-scriba-ink-mute">
          {loading
            ? "Lendo os números do período — leva cerca de 90 segundos."
            : "Ainda sem leitura para esta tela."}
        </p>
      )}

      <StatusNote failure={failure} hasRecord={record != null} />

      <p className="text-[11px] font-light leading-relaxed text-scriba-ink-mute">
        Gerada uma vez por dia sobre os últimos {record?.windowDays ?? 30} dias — os mesmos números
        das tabelas desta página, não uma segunda consulta. Margem citada aqui depende da régua da
        moeda, que é simulação; custo é medido.
      </p>
    </section>
  );
}

/**
 * O erro mostra o que o upstream disse, e não uma frase de conforto.
 *
 * A versão anterior dizia "a OpenAI não respondeu a tempo" para QUALQUER falha
 * de upstream — timeout, 400, 401 — e o diagnóstico só existia no terminal do
 * servidor. Acabou custando uma rodada inteira de investigação de um timeout
 * que a própria mensagem já teria entregue se trouxesse o número.
 */
function StatusNote({ failure, hasRecord }: { failure: Failure; hasRecord: boolean }) {
  if (failure.status === "idle" || failure.status === "loading") return null;
  if (failure.status === "unsaved") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-light text-scriba-cream-accent">
          A leitura acima foi gerada, mas não pôde ser gravada — ela some ao recarregar a página, e
          a próxima visita vai pagar a análise de novo.
        </p>
        {failure.detail ? (
          <p className="font-mono text-[11px] leading-snug text-scriba-ink-mute">
            {failure.detail}
          </p>
        ) : null}
      </div>
    );
  }
  const message =
    failure.status === "unparseable"
      ? "O modelo respondeu num formato que não deu para ler."
      : failure.status === "network"
        ? "A requisição não completou."
        : "A geração falhou.";
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[12px] font-light text-scriba-rose-accent">
        {message} Tente atualizar.
        {hasRecord ? " O texto acima é a última leitura que deu certo." : ""}
      </p>
      {failure.detail ? (
        <p className="font-mono text-[11px] leading-snug text-scriba-ink-mute">{failure.detail}</p>
      ) : null}
    </div>
  );
}
