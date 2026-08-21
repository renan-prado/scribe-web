import { MapPin, User } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Minhas lista" };

import { revalidatePath } from "next/cache";
import Link from "next/link";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { RefreshSessionsButton } from "@/features/session/components/RefreshSessionsButton";
import { deleteSession, listSessions } from "@/lib/db/sessions";
import { cn } from "@/lib/utils";
import { SessionCardMenu } from "./SessionCardMenu";

async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/home");
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default async function HomePage() {
  const sessionsResult = await listSessions()
    .then((s) => ({ ok: true as const, sessions: s }))
    .catch((err: Error) => ({ ok: false as const, message: err.message }));

  const sessions = sessionsResult.ok ? sessionsResult.sessions : [];
  const loadError = sessionsResult.ok ? null : sessionsResult.message;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não consegui carregar as sessões: {loadError}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão salva ainda. Comece pela primeira gravação.
          </p>
          <NewRecordingDialog />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Minhas gravações:
            </span>
            <RefreshSessionsButton />
          </div>
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => {
              const when = DATE_FMT.format(new Date(s.createdAt));
              const dur = formatDuration(s.durationMs);
              return (
                <li
                  key={s.id}
                  className={cn(
                    "group relative flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4",
                    "transition-colors hover:border-foreground/25 hover:bg-muted/40"
                  )}
                >
                  <Link
                    href={`/recording/${s.id}/summary`}
                    className="-mx-1 flex min-w-0 flex-1 flex-col gap-1.5 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:gap-2"
                  >
                    <span className="line-clamp-2 text-[0.95rem] font-medium leading-snug text-foreground sm:text-base">
                      {s.title?.trim() || "Sessão sem título"}
                    </span>
                    {s.shortSummary ? (
                      <span className="line-clamp-2 text-[0.8rem] leading-snug text-muted-foreground sm:text-sm">
                        {s.shortSummary}
                      </span>
                    ) : null}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.7rem] tracking-wide text-muted-foreground/80">
                      {s.speakerName?.trim() ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">{s.speakerName}</span>
                        </span>
                      ) : null}
                      {s.speakerLocation?.trim() ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{s.speakerLocation}</span>
                        </span>
                      ) : null}
                      <span className="whitespace-nowrap">
                        {when}
                        {dur ? ` · ${dur}` : ""}
                      </span>
                    </span>
                  </Link>
                  <SessionCardMenu sessionId={s.id} deleteAction={deleteSessionAction} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
