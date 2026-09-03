import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/features/admin/components/AdminCards";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { listStudiesForAdmin } from "@/lib/db/admin/studies";
import { APPROACH_LABELS } from "@/lib/domain/study";

export const metadata: Metadata = { title: "Estudos" };
export const dynamic = "force-dynamic";

/**
 * A tela de avaliação do estudo. Não é métrica: é leitura.
 *
 * Cada linha mostra a DECISÃO editorial (o plano) ao lado do que ela produziu
 * (contagem de blocos, fontes que sobreviveram à selagem, versículos). É o
 * instrumento dos critérios 2, 4, 6 e 8 de `docs/estudo-v2.md` §7 — os que não
 * dá para julgar só lendo o estudo pronto.
 *
 * Duas leituras que esta tela torna imediatas:
 *   - um estudo com `depth: raso` e poucos blocos está CERTO, não quebrado;
 *   - um estudo sem nenhuma fonte não é necessariamente pior — significa que a
 *     selagem descartou o que não tinha obra, que é o comportamento desejado.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const DEPTH_LABEL = { raso: "Raso", medio: "Médio", denso: "Denso" } as const;

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
                <span className="text-[11px] font-light text-scriba-ink-mute">
                  {DATE_FMT.format(new Date(s.createdAt))}
                </span>
              </header>

              {s.thesis ? (
                <p className="border-l-2 border-scriba-green pl-3 text-[13px] font-light leading-relaxed text-scriba-ink">
                  {s.thesis}
                </p>
              ) : null}

              {s.plan ? (
                <div className="flex flex-col gap-2 rounded-lg bg-scriba-blue-soft/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
                      Plano
                    </span>
                    <span className="rounded-full bg-scriba-paper px-2 py-0.5 text-[11px] font-medium text-scriba-ink-strong">
                      {DEPTH_LABEL[s.plan.depth]}
                    </span>
                    <span className="text-[12px] font-medium text-scriba-ink">{s.plan.theme}</span>
                  </div>
                  <ol className="flex flex-col gap-2">
                    {s.plan.axes.map((axis) => (
                      <li key={axis.title} className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-scriba-ink-strong">
                          {axis.title}{" "}
                          <span className="font-normal text-scriba-ink-mute">
                            · {APPROACH_LABELS[axis.approach]}
                          </span>
                        </span>
                        <span className="text-[12px] font-light leading-relaxed text-scriba-ink">
                          {axis.rationale}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-[11px] font-light italic text-scriba-ink-mute">
                  Gerado antes do pipeline de cinco etapas — sem plano registrado.
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
