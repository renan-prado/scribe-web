"use client";

import { AlertTriangle, CircleCheck, Info, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminInsightsRecord, InsightSeverity } from "@/lib/domain/admin-insights";
import { cn } from "@/lib/utils";

/**
 * A leitura da IA sobre os números do painel, em `/admin/insights`.
 *
 * ## Ela só roda no clique
 *
 * Este componente já foi um CARD lateral em `/admin/precificacao`,
 * `/admin/usage` e `/admin/metricas`, com três leituras diferentes, e cada um
 * deles DISPARAVA a geração sozinho quando a linha gravada passava de 24 horas.
 * Duas coisas estavam erradas nisso: a chamada de LLM mais cara do produto
 * rodava sem ninguém pedir (quem abria a tela para conferir o MRR pagava um
 * modelo de raciocínio), e três leituras sobre os mesmos eventos diziam quase a
 * mesma coisa em três lugares onde nenhuma delas era o assunto da tela.
 *
 * Hoje é uma leitura só, com página própria, e o gesto que a paga é explícito.
 * O servidor entrega o que já está gravado (uma leitura de uma linha) e este
 * componente não faz NADA até o botão ser tocado.
 *
 * ## A espera é anunciada em segundos
 *
 * São ~85s medidos num modelo de raciocínio. Um spinner mudo nesse tempo se lê
 * como tela travada, e a reação natural é recarregar, que abandona a chamada já
 * paga. Por isso o estado de carregando diz quanto tempo leva, e o botão fica
 * desabilitado enquanto isso.
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
  /** O que estava gravado quando a página renderizou. `null` = nunca gerado. */
  initial: AdminInsightsRecord | null;
};

type Status = "idle" | "loading" | "upstream" | "unparseable" | "network" | "unsaved";
/** O que falhou e o que o servidor disse. Só admin lê esta tela. */
type Failure = { status: Status; detail: string | null };

export function AdminInsightsPanel({ initial }: Props) {
  const [record, setRecord] = useState<AdminInsightsRecord | null>(initial);
  const [failure, setFailure] = useState<Failure>({ status: "idle", detail: null });

  const run = useCallback(async () => {
    setFailure({ status: "loading", detail: null });
    try {
      const res = await fetch("/api/admin/insights", { method: "POST" });
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
      // texto, não um erro no lugar dele, o conteúdo é o mesmo e já foi pago.
      setFailure(
        body.persistError
          ? { status: "unsaved", detail: body.persistError }
          : { status: "idle", detail: null }
      );
    } catch (err) {
      setFailure({ status: "network", detail: (err as Error).message });
    }
  }, []);

  const loading = failure.status === "loading";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {/* O hexágono amarelo é o acento do produto. O `Sparkles` do lucide é
              proibido neste repositório, ver src/shared/AGENTS.md. */}
          <span
            aria-hidden
            className="size-3.5 bg-scriba-yellow [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          />
          Leitura da IA
        </CardTitle>
        <CardDescription>
          {record
            ? `Gerada em ${WHEN.format(new Date(record.generatedAt))} · ${record.windowDays} dias · ${record.model}`
            : "Nenhuma leitura gerada ainda."}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => void run()} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {loading ? "Analisando…" : record ? "Gerar de novo" : "Gerar leitura"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Lendo os números dos últimos 30 dias. Leva cerca de 90 segundos, e a página pode ficar
            aberta: recarregar agora abandona uma chamada que já foi paga.
          </p>
        ) : null}

        {record ? (
          <>
            <p className="text-sm leading-relaxed font-medium">{record.payload.headline}</p>
            <ul className="flex flex-col divide-y">
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
                      <span className="text-sm font-semibold">{insight.title}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {insight.finding}
                    </p>
                    {/* A ação é a única linha em cor de tinta cheia: é o que
                        separa este bloco de um parágrafo de análise. */}
                    <p className="text-sm leading-relaxed">
                      <span className="font-semibold">→ </span>
                      {insight.action}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : loading ? null : (
          <p className="text-sm text-muted-foreground">
            O botão acima lê os números dos últimos 30 dias e escreve o que eles significam. É a
            chamada de modelo mais cara do produto, por isso ela só acontece quando você pede.
          </p>
        )}

        <StatusNote failure={failure} hasRecord={record != null} />
      </CardContent>
    </Card>
  );
}

/**
 * O erro mostra o que o upstream disse, e não uma frase de conforto.
 *
 * A versão anterior dizia "a OpenAI não respondeu a tempo" para QUALQUER falha
 * de upstream, timeout, 400, 401, e o diagnóstico só existia no terminal do
 * servidor. Acabou custando uma rodada inteira de investigação de um timeout
 * que a própria mensagem já teria entregue se trouxesse o número.
 */
function StatusNote({ failure, hasRecord }: { failure: Failure; hasRecord: boolean }) {
  if (failure.status === "idle" || failure.status === "loading") return null;
  if (failure.status === "unsaved") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-scriba-cream-accent">
          A leitura acima foi gerada, mas não pôde ser gravada: ela some ao recarregar a página, e a
          próxima visita vai pagar a análise de novo.
        </p>
        {failure.detail ? (
          <p className="font-mono text-xs leading-snug text-muted-foreground">{failure.detail}</p>
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
      <p className="text-sm text-destructive">
        {message} Tente gerar de novo.
        {hasRecord ? " O texto acima é a última leitura que deu certo." : ""}
      </p>
      {failure.detail ? (
        <p className="font-mono text-xs leading-snug text-muted-foreground">{failure.detail}</p>
      ) : null}
    </div>
  );
}
