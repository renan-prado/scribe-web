import { BookOpen, MapPin, Mic } from "lucide-react";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { NavLink } from "@/components/NavLink";
import { RefreshSessionsButton } from "@/features/session/components/RefreshSessionsButton";
import { SessionsEmptyState } from "@/features/session/components/SessionsEmptyState";
import { formatDurationShort, groupLabel, shortDate } from "@/features/session/lib/formatting";
import { listDeepenedSessionIds } from "@/lib/db/deepenings";
import { deleteSession, listSessions } from "@/lib/db/sessions";
import { cn } from "@/lib/utils";
import { SessionCardMenu } from "./SessionCardMenu";

export const metadata: Metadata = { title: "Suas gravações" };

async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/list");
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

  const isEmpty = sessions.length === 0 && !loadError;

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
              Suas gravações
            </h1>
            <p className="text-sm font-light text-scriba-ink-soft">
              Tudo o que você ouviu e registrou com o Scriba.
            </p>
          </div>
          {sessions.length > 0 ? <RefreshSessionsButton /> : null}
        </div>
      )}

      {loadError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não consegui carregar as gravações: {loadError}
        </div>
      ) : sessions.length === 0 ? (
        <SessionsEmptyState
          sticker="/stickers/woman/018-woman.svg"
          heading="Sem gravações, ainda..."
        />
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
                  const isDeepened = deepenedIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="group flex flex-col rounded-3xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.08)] transition-shadow hover:shadow-[0_8px_20px_rgba(79,168,240,0.18)] sm:p-6"
                    >
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <NavLink
                            href={`/recording/${s.id}/summary`}
                            spinner="overlay"
                            contentClassName="flex min-w-0 items-center gap-2.5"
                            className="flex min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-scriba-blue">
                              <Mic className="size-4 text-white" />
                            </div>
                            <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-base">
                              {s.title?.trim() || "Sessão sem título"}
                            </span>
                          </NavLink>
                          <SessionCardMenu sessionId={s.id} deleteAction={deleteSessionAction} />
                        </div>
                        {s.shortSummary?.trim() ? (
                          <p className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft">
                            {s.shortSummary}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {s.speakerName?.trim() || s.speakerLocation?.trim() ? (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {s.speakerName?.trim() ? (
                              <span className="text-[12px] font-medium text-scriba-ink">
                                {s.speakerName}
                              </span>
                            ) : null}
                            {s.speakerLocation?.trim() ? (
                              <>
                                <span className="text-scriba-ink-mute">·</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-light text-scriba-ink-mute">
                                  <MapPin className="size-3" />
                                  {s.speakerLocation}
                                </span>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                        <div className="flex flex-col gap-3 border-t border-scriba-hairline pt-3 sm:flex-row sm:items-center sm:gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[11px] font-light text-scriba-ink-mute">
                              {shortDate(s.createdAt, includeYear)}
                            </span>
                            {formatDurationShort(s.durationMs) ? (
                              <>
                                <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                                <span className="text-[11px] font-light text-scriba-ink-mute">
                                  {formatDurationShort(s.durationMs)}
                                </span>
                              </>
                            ) : null}
                            {isDeepened ? (
                              <>
                                <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                                <span
                                  title="Você já gerou o estudo deste sermão"
                                  className="inline-flex items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue"
                                >
                                  <BookOpen className="size-3" />
                                  Estudo
                                </span>
                              </>
                            ) : null}
                          </div>
                          <div className="sm:ml-auto">
                            <NavLink
                              href={`/recording/${s.id}/summary`}
                              className="inline-flex w-full items-center justify-center rounded-full bg-scriba-blue-soft px-4 py-2 text-[11px] font-semibold text-scriba-blue transition-colors hover:bg-scriba-blue-soft/70 sm:w-auto"
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
