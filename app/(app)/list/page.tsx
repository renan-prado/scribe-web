import { MapPin, Mic, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { NavLink } from "@/components/NavLink";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { RefreshSessionsButton } from "@/features/session/components/RefreshSessionsButton";
import { listDeepenedSessionIds } from "@/lib/db/deepenings";
import { deleteSession, listSessions } from "@/lib/db/sessions";
import { SessionCardMenu } from "./SessionCardMenu";

export const metadata: Metadata = { title: "Suas gravações" };

async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/list");
}

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function groupLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const dow = start.getDay(); // 0 = Sunday
  const daysSinceMon = (dow + 6) % 7;
  const startOfWeek = new Date(start.getTime() - daysSinceMon * dayMs);
  const startOfLastWeek = new Date(startOfWeek.getTime() - 7 * dayMs);
  if (d >= startOfWeek) return "Esta semana";
  if (d >= startOfLastWeek) return "Semana passada";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
    return capitalize(monthNameLong(d.getMonth()));
  }
  if (d.getFullYear() === now.getFullYear()) return capitalize(monthNameLong(d.getMonth()));
  return `${capitalize(monthNameLong(d.getMonth()))} ${d.getFullYear()}`;
}

const MONTHS_PT_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function monthNameLong(idx: number): string {
  return MONTHS_PT_LONG[idx];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortDate(iso: string, includeYear: boolean): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS_PT_SHORT[d.getMonth()]}`;
  return includeYear ? `${base} ${d.getFullYear()}` : base;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m} min`;
}

export default async function LibraryPage() {
  const sessionsResult = await listSessions()
    .then((s) => ({ ok: true as const, sessions: s }))
    .catch((err: Error) => ({ ok: false as const, message: err.message }));

  const sessions = sessionsResult.ok ? sessionsResult.sessions : [];
  const loadError = sessionsResult.ok ? null : sessionsResult.message;
  const deepenedIds = await listDeepenedSessionIds(sessions.map((s) => s.id)).catch(
    () => new Set<string>()
  );
  const now = new Date();

  const groups: {
    label: string;
    items: (typeof sessions)[number][];
  }[] = [];
  for (const s of sessions) {
    const label = groupLabel(s.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-3xl">
            Suas gravações
          </h1>
          <p className="text-sm font-light text-[color:var(--scriba-ink-soft)]">
            Tudo o que você ouviu e registrou com o Scriba.
          </p>
        </div>
        {sessions.length > 0 ? <RefreshSessionsButton /> : null}
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não consegui carregar as gravações: {loadError}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed border-[color:var(--scriba-hairline-soft)] bg-white p-6 shadow-[0_6px_22px_rgba(79,168,240,0.08)]">
          <p className="text-sm text-[color:var(--scriba-ink-soft)]">
            Nenhuma gravação salva ainda. Comece pela primeira gravação.
          </p>
          <NewRecordingDialog />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-1">
                <span className="text-xs font-semibold text-[color:var(--scriba-ink-mute)]">
                  {group.label}
                </span>
                <span className="h-px flex-1 bg-[color:var(--scriba-hairline)]" />
                <span className="text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
                  {group.items.length}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((s) => {
                  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
                  const isDeepened = deepenedIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="group flex flex-col rounded-3xl border border-[color:var(--scriba-hairline-soft)] bg-white p-5 shadow-[0_4px_14px_rgba(79,168,240,0.08)] transition-shadow hover:shadow-[0_8px_20px_rgba(79,168,240,0.18)] sm:p-6"
                    >
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <NavLink
                            href={`/recording/${s.id}/summary`}
                            spinner="overlay"
                            contentClassName="flex min-w-0 items-center gap-2.5"
                            className="flex min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--scriba-blue)]">
                              <Mic className="size-4 text-white" />
                            </div>
                            <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-base">
                              {s.title?.trim() || "Sessão sem título"}
                            </span>
                          </NavLink>
                          <SessionCardMenu sessionId={s.id} deleteAction={deleteSessionAction} />
                        </div>
                        {s.shortSummary?.trim() ? (
                          <p className="text-pretty text-[13px] font-light leading-snug text-[color:var(--scriba-ink-soft)]">
                            {s.shortSummary}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {s.speakerName?.trim() || s.speakerLocation?.trim() ? (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {s.speakerName?.trim() ? (
                              <span className="text-[12px] font-medium text-[color:var(--scriba-ink)]">
                                {s.speakerName}
                              </span>
                            ) : null}
                            {s.speakerLocation?.trim() ? (
                              <>
                                <span className="text-[color:var(--scriba-ink-mute)]">·</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
                                  <MapPin className="size-3" />
                                  {s.speakerLocation}
                                </span>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                        <div className="flex flex-col gap-3 border-t border-[color:var(--scriba-hairline)] pt-3 sm:flex-row sm:items-center sm:gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
                              {shortDate(s.createdAt, includeYear)}
                            </span>
                            {formatDuration(s.durationMs) ? (
                              <>
                                <span className="size-[3px] rounded-full bg-[color:var(--scriba-ink-mute)]/60" />
                                <span className="text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
                                  {formatDuration(s.durationMs)}
                                </span>
                              </>
                            ) : null}
                            {isDeepened ? (
                              <>
                                <span className="size-[3px] rounded-full bg-[color:var(--scriba-ink-mute)]/60" />
                                <span
                                  title="Você já aprofundou este sermão"
                                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--scriba-blue-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--scriba-blue)]"
                                >
                                  <Sparkles className="size-3" />
                                  Aprofundado
                                </span>
                              </>
                            ) : null}
                          </div>
                          <div className="sm:ml-auto">
                            <NavLink
                              href={`/recording/${s.id}/summary`}
                              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--scriba-blue-soft)] px-4 py-2 text-[11px] font-semibold text-[color:var(--scriba-blue)] transition-colors hover:bg-[color:var(--scriba-blue-soft)]/70 sm:w-auto"
                            >
                              Ver resumo →
                            </NavLink>
                          </div>
                        </div>
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
