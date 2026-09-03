import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { NavLink } from "@/components/NavLink";
import { StudiesEmptyState } from "@/features/session/components/StudiesEmptyState";
import { StudiesUpsell } from "@/features/session/components/StudiesUpsell";
import { formatDurationShort, groupLabel, shortDate } from "@/features/session/lib/formatting";
import { listDeepenings } from "@/lib/db/deepenings";
import { canCurrentUserUse } from "@/lib/entitlements/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Seus estudos" };

export default async function StudiesPage() {
  const [result, canGenerate] = await Promise.all([
    listDeepenings()
      .then((s) => ({ ok: true as const, studies: s }))
      .catch((err: Error) => ({ ok: false as const, message: err.message })),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);

  const studies = result.ok ? result.studies : [];
  const loadError = result.ok ? null : result.message;
  const now = new Date();

  const groups: { label: string; items: (typeof studies)[number][] }[] = [];
  for (const s of studies) {
    const label = groupLabel(s.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  const isEmpty = studies.length === 0 && !loadError;
  // Sem o plano e sem nenhum estudo, a página inteira vira o convite: explicar
  // como gerar algo que a pessoa não pode gerar seria pior que não explicar.
  const showUpsellState = isEmpty && !canGenerate;

  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8",
        isEmpty && "flex-1 justify-center py-0 sm:py-0"
      )}
    >
      {isEmpty ? null : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl">
              Seus estudos
            </h1>
            <p className="text-sm font-light text-scriba-ink-soft">
              Estudos teológicos que o Scriba gerou a partir dos seus sermões.
            </p>
          </div>
        </div>
      )}

      {/* Tem estudos mas perdeu (ou nunca teve) o plano: a lista fica, o
          convite entra acima dela. Só a GERAÇÃO é restrita — ver
          lib/entitlements/features.ts. */}
      {!canGenerate && studies.length > 0 ? <StudiesUpsell variant="banner" /> : null}

      {loadError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não consegui carregar os estudos: {loadError}
        </div>
      ) : showUpsellState ? (
        <StudiesUpsell variant="full" />
      ) : studies.length === 0 ? (
        <StudiesEmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-1">
                <span className="text-xs font-semibold text-scriba-ink-mute">{group.label}</span>
                <span className="h-px flex-1 bg-scriba-hairline" />
                <span className="text-[11px] font-light text-scriba-ink-mute">
                  {group.items.length}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((s) => {
                  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
                  const sessionIncludeYear =
                    s.sessionCreatedAt &&
                    new Date(s.sessionCreatedAt).getFullYear() !== now.getFullYear();
                  const sessionLabel = s.sessionTitle?.trim() || "Sessão sem título";
                  return (
                    <li
                      key={s.sessionId}
                      className="group flex flex-col rounded-3xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,194,139,0.08)] transition-shadow hover:shadow-[0_8px_20px_rgba(79,194,139,0.18)] sm:p-6"
                    >
                      <NavLink
                        href={`/recording/${s.sessionId}/deepening`}
                        spinner="overlay"
                        contentClassName="flex min-w-0 flex-1 flex-col gap-3"
                        className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-scriba-green-soft">
                            <BookOpen className="size-4 text-scriba-green-ink" />
                          </div>
                          <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-base">
                            {s.studyTitle}
                          </span>
                        </div>
                        {s.studyShort ? (
                          <p className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft">
                            {s.studyShort.length > 180
                              ? `${s.studyShort.slice(0, 180).trim()}…`
                              : s.studyShort}
                          </p>
                        ) : null}
                      </NavLink>

                      <div className="mt-4 flex flex-col gap-2 border-t border-scriba-hairline pt-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
                          Baseado em
                        </span>
                        <NavLink
                          href={`/recording/${s.sessionId}/summary`}
                          spinner="overlay"
                          contentClassName="flex flex-col gap-0.5"
                          className="-mx-1 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-scriba-green-soft/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          <span className="text-pretty text-[13px] font-medium leading-snug text-scriba-ink">
                            {sessionLabel}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-light text-scriba-ink-mute">
                            {s.sessionSpeakerName?.trim() ? (
                              <span className="font-medium text-scriba-ink">
                                {s.sessionSpeakerName}
                              </span>
                            ) : null}
                            {s.sessionCreatedAt ? (
                              <>
                                {s.sessionSpeakerName?.trim() ? (
                                  <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                                ) : null}
                                <span>{shortDate(s.sessionCreatedAt, !!sessionIncludeYear)}</span>
                              </>
                            ) : null}
                            {formatDurationShort(s.sessionDurationMs) ? (
                              <>
                                <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                                <span>{formatDurationShort(s.sessionDurationMs)}</span>
                              </>
                            ) : null}
                          </span>
                        </NavLink>
                        <span className="mt-1 text-[11px] font-light text-scriba-ink-mute">
                          Estudo gerado em {shortDate(s.createdAt, includeYear)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
