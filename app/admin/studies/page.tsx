import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { listStudiesForAdmin } from "@/lib/db/admin/studies";

export const metadata: Metadata = { title: "Estudos" };
export const dynamic = "force-dynamic";

/**
 * A tela de avaliação do estudo. Não é métrica: é leitura.
 *
 * Mostra as perguntas que o questionador levantou, marcando as que o
 * respondedor escolheu responder, ao lado do que saiu (contagem de blocos,
 * versículos conferidos, fontes que sobreviveram à selagem).
 *
 * A razão de ser é diagnóstica. Um estudo ruim tem duas causas possíveis que
 * se parecem no texto final e têm consertos opostos: as perguntas eram rasas,
 * ou eram boas e foram mal respondidas. Sem ver as perguntas, não dá para
 * saber em qual dos dois modelos mexer.
 *
 * Uma leitura que a tela precisa preservar: estudo sem nenhuma fonte não é
 * necessariamente pior — é a selagem tendo descartado o que não tinha obra,
 * que é o comportamento desejado.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const DEPTH_LABEL = { media: "média", alta: "alta" } as const;

export default async function AdminStudiesPage() {
  const studies = await listStudiesForAdmin().catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Estudos"
        subtitle="A decisão editorial de cada estudo ao lado do que ela produziu."
      />

      {studies.length === 0 ? (
        <EmptyState>Nenhum estudo gerado ainda.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-4">
          {studies.map((s) => (
            <li
              key={`${s.sessionId}-${s.createdAt}`}
              className="flex flex-col gap-4 rounded-xl border border-scriba-hairline bg-scriba-paper p-5"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/recording/${s.sessionId}/deepening`}
                    className="text-sm font-semibold text-scriba-ink-strong hover:underline"
                  >
                    {s.studyTitle}
                  </Link>
                  <span className="text-xs font-light text-scriba-ink-mute">
                    sobre “{s.sessionTitle ?? "sessão sem título"}”
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  {/* O par natural desta tela: aqui está a decisão editorial,
                      lá está o que ela custou — execução por execução, que é o
                      recorte que importa quando se reprocessa para comparar. */}
                  <Link
                    href={`/admin/precificacao?sessionId=${s.sessionId}`}
                    className="text-[11px] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
                  >
                    custo por execução
                  </Link>
                  <span className="text-[11px] font-light text-scriba-ink-mute">
                    {DATE_FMT.format(new Date(s.createdAt))}
                  </span>
                </div>
              </header>

              {s.thesis ? (
                <p className="border-l-2 border-scriba-green pl-3 text-[13px] font-light leading-relaxed text-scriba-ink">
                  {s.thesis}
                </p>
              ) : null}

              {s.record ? (
                <div className="flex flex-col gap-2 rounded-lg bg-scriba-blue-soft/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
                      Perguntas
                    </span>
                    <span className="rounded-full bg-scriba-paper px-2 py-0.5 text-[11px] font-medium text-scriba-ink-strong">
                      {s.record.answered.length} de {s.record.questions.length}
                    </span>
                    <span className="text-[12px] font-medium text-scriba-ink">
                      {s.record.theme}
                    </span>
                  </div>
                  {s.record.guard && s.record.guard.rewrites > 0 ? (
                    <p className="text-[11px] font-medium text-destructive">
                      O redator repetiu a tese do resumo e teve de reescrever.
                    </p>
                  ) : null}
                  {/* Todas as perguntas, e por que cada uma não virou texto.
                      Os dois descartes têm causas diferentes e consertos
                      diferentes: "cortada" é o guardião dizendo que o resumo já
                      respondia — culpa do questionador; "não escolhida" é o
                      respondedor tendo preferido outras — se ele deixou de fora
                      justamente as boas, a culpa é dele. */}
                  <ol className="flex flex-col gap-1">
                    {s.record.questions.map((q) => {
                      const used = s.record?.answered.includes(q.text) ?? false;
                      const cut = s.record?.guard?.blockedByGuard.includes(q.text) ?? false;
                      return (
                        <li
                          key={q.text}
                          className={
                            used
                              ? "text-[12.5px] font-medium leading-relaxed text-scriba-ink-strong"
                              : "text-[12.5px] font-light leading-relaxed text-scriba-ink-mute"
                          }
                        >
                          <span className={cut ? "line-through decoration-destructive/50" : ""}>
                            {q.text}
                          </span>{" "}
                          <span className="font-normal text-[11px] text-scriba-ink-mute">
                            ({DEPTH_LABEL[q.depth]}
                            {cut ? " · cortada: o resumo já respondia" : ""}
                            {!cut && !used ? " · não escolhida" : ""})
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <p className="text-[11px] font-light italic text-scriba-ink-mute">
                  Gerado antes do pipeline atual — sem perguntas registradas.
                </p>
              )}

              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                <Stat label="Blocos" value={String(s.totalBlocks)} />
                <Stat
                  label="Tipos"
                  value={
                    Object.entries(s.counts)
                      .map(([type, n]) => `${type}×${n}`)
                      .join(" · ") || "—"
                  }
                />
                <Stat label="Versículos" value={s.verses.join(" · ") || "—"} />
                <Stat label="Fontes" value={s.sources.join(" · ") || "—"} />
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">{label}</dt>
      <dd className="font-light text-scriba-ink">{value}</dd>
    </div>
  );
}
