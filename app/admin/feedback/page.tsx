import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { loadAdminFeedback } from "@/lib/db/admin/feedback";
import {
  FEEDBACK_RATING_EMOJI,
  FEEDBACK_RATING_LABEL,
  FEEDBACK_RATINGS,
  FEEDBACK_TOPIC_LABEL,
  FEEDBACK_TOPIC_QUESTION,
  type FeedbackSurface,
} from "@/lib/domain/feedback";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

/**
 * O que os usuários acharam, a nota de cada parte do produto, e o que
 * escreveram junto.
 *
 * A tela tem TRÊS blocos e a ordem é a mensagem:
 *
 *   1. **A taxa de resposta vem primeiro**, antes de qualquer nota. As médias
 *      abaixo são de quem se dispôs a responder, e essa amostra é
 *      sistematicamente mais gentil que a realidade, 4,0 sobre 12 respostas
 *      de 90 perguntas parece um produto adorado. É a mesma regra dos avisos
 *      antes dos números no financeiro, contra o mesmo risco: uma conta boa
 *      demais é a que ninguém investiga.
 *   2. **A nota de cada coisa, uma por tópico, e nunca uma soma.** Cada tópico
 *      é uma peça com conserto próprio; uma "nota do Scriba" que os misturasse
 *      não apontaria para lugar nenhum. Tópico sem resposta aparece como "-",
 *      não como zero: zero é uma nota abaixo de "ruim", que não existe.
 *   3. **O que as pessoas escreveram**, na íntegra e em ordem. É o
 *      diagnóstico: a média diz que algo está errado, só o texto diz o quê.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const INT = new Intl.NumberFormat("pt-BR");
const AVG = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SURFACE_LABEL: Record<FeedbackSurface, string> = {
  live: "Ao vivo",
  audio: "Áudio",
  transcript: "Transcrição",
  study: "Estudo",
  general: "Perfil",
};

export default async function AdminFeedbackPage() {
  const data = await loadAdminFeedback().catch(() => null);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title="Feedback" subtitle="A nota de cada parte do produto." />
        <EmptyState>Não consegui ler o feedback agora.</EmptyState>
      </div>
    );
  }

  const { asked, answered } = data.prompts;
  const rate = asked > 0 ? (answered / asked) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Feedback"
        subtitle="O que os usuários acharam de cada parte, colhido no instante em que acabaram de usá-la."
      />

      {/* 1. O denominador, antes das notas. Ver o cabeçalho. */}
      <section className="admin-card-surface flex flex-col gap-2 p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Metric label="Perguntas feitas" value={INT.format(asked)} />
          <Metric label="Respondidas" value={INT.format(answered)} />
          <Metric label="Taxa de resposta" value={rate === null ? "-" : `${AVG.format(rate)}%`} />
          <Metric label="Envios" value={INT.format(data.totalSubmissions)} />
        </div>
        <p className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          As médias abaixo são de quem <strong className="font-medium">escolheu</strong> responder.
          Quanto menor a taxa acima, mais gentil que a realidade essa amostra tende a ser, leia as
          duas coisas juntas. Os envios do <em>/profile</em> não nascem de pergunta nossa e por isso
          não entram no denominador.
        </p>
      </section>

      {/* 2. A nota de cada coisa. */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.topics.map((t) => {
          const max = Math.max(1, ...FEEDBACK_RATINGS.map((r) => t.distribution[r]));
          return (
            <article key={t.topic} className="admin-card-surface flex flex-col gap-3 p-5">
              <header className="flex flex-col gap-0.5">
                <h2 className="text-[13px] font-semibold text-scriba-ink-strong">
                  {FEEDBACK_TOPIC_LABEL[t.topic]}
                </h2>
                <p className="text-[11px] font-light leading-snug text-scriba-ink-mute">
                  {FEEDBACK_TOPIC_QUESTION[t.topic]}
                </p>
              </header>

              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tabular-nums tracking-tight text-scriba-ink-strong">
                  {t.average === null ? "-" : AVG.format(t.average)}
                </span>
                <span className="text-[11px] font-light text-scriba-ink-mute">
                  {t.average === null
                    ? "sem resposta ainda"
                    : `de 4 · ${INT.format(t.count)} ${t.count === 1 ? "nota" : "notas"}`}
                </span>
              </div>

              {/* A distribuição, e não só a média: quatro "razoável" e uma
                  mistura de "ruim" com "excelente" dão o mesmo 2,5 e pedem
                  coisas opostas. */}
              <dl className="flex flex-col gap-1">
                {FEEDBACK_RATINGS.map((rating) => {
                  const n = t.distribution[rating];
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <dt className="flex w-24 flex-none items-center gap-1 text-[11px] text-scriba-ink-soft">
                        <span aria-hidden>{FEEDBACK_RATING_EMOJI[rating]}</span>
                        {FEEDBACK_RATING_LABEL[rating]}
                      </dt>
                      <dd className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "h-1.5 rounded-full",
                            n > 0 ? "bg-scriba-blue" : "bg-scriba-hairline"
                          )}
                          style={{ width: `${n > 0 ? Math.max(6, (n / max) * 100) : 6}%` }}
                        />
                        <span className="text-[11px] tabular-nums text-scriba-ink-mute">{n}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          );
        })}
      </section>

      {/* 3. O que escreveram. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">O que escreveram</h2>
        {data.submissions.length === 0 ? (
          <EmptyState>Nenhum feedback enviado ainda.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {data.submissions.map((s) => (
              <li key={s.submissionId} className="admin-card-surface flex flex-col gap-2.5 p-5">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink">
                      {SURFACE_LABEL[s.surface]}
                    </span>
                    <span className="truncate text-[12px] font-medium text-scriba-ink">
                      {s.userName?.trim() || s.userEmail || "usuário removido"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    {s.sessionId ? (
                      <Link
                        href={`/recording/${s.sessionId}/summary`}
                        className="text-[11px] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
                      >
                        ver sessão
                      </Link>
                    ) : null}
                    {s.appVersion ? (
                      <span className="text-[11px] font-light tabular-nums text-scriba-ink-mute">
                        v{s.appVersion}
                      </span>
                    ) : null}
                    <span className="text-[11px] font-light text-scriba-ink-mute">
                      {DATE_FMT.format(new Date(s.createdAt))}
                    </span>
                  </div>
                </header>

                <div className="flex flex-wrap gap-1.5">
                  {s.ratings.map((r) => (
                    <span
                      key={r.topic}
                      className="inline-flex items-center gap-1.5 rounded-full bg-scriba-surface px-2.5 py-1 text-[11px] text-scriba-ink-soft ring-1 ring-scriba-hairline"
                    >
                      <span aria-hidden>{FEEDBACK_RATING_EMOJI[r.rating]}</span>
                      <span className="font-medium text-scriba-ink">
                        {FEEDBACK_TOPIC_LABEL[r.topic]}
                      </span>
                      {FEEDBACK_RATING_LABEL[r.rating]}
                    </span>
                  ))}
                </div>

                {/* O comentário é o diagnóstico. Ele fica INTEIRO e sem
                    truncamento: são 300 caracteres no máximo, e cortar a
                    frase de alguém para caber num card é perder justamente a
                    parte que a média não diz. */}
                {s.comment ? (
                  <p className="whitespace-pre-wrap text-pretty text-[13px] leading-relaxed text-scriba-ink">
                    “{s.comment}”
                  </p>
                ) : (
                  <p className="text-[12px] font-light italic text-scriba-ink-mute">
                    Sem comentário, só a nota.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-scriba-ink-mute">
        {label}
      </span>
      <span className="text-[20px] font-semibold tabular-nums tracking-tight text-scriba-ink-strong">
        {value}
      </span>
    </div>
  );
}
