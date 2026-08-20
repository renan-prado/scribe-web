import { MapPin, Plus, Trash2, User } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { deleteSession, listSessions } from "@/lib/db/sessions";
import { cn } from "@/lib/utils";

async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/");
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
  let sessions: Awaited<ReturnType<typeof listSessions>> = [];
  let loadError: string | null = null;
  try {
    sessions = await listSessions();
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            scribe-web
          </h1>
          <p className="text-sm text-muted-foreground">
            Transcrições, resumos e cartões extraídos de sermões gravados.
          </p>
        </div>
        <Link
          href="/spike"
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm",
            "transition-transform hover:scale-[1.02] active:scale-95",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
          )}
        >
          <Plus className="size-4" />
          Nova gravação
        </Link>
      </header>

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não consegui carregar as sessões: {loadError}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão salva ainda. Abra uma nova gravação para começar.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => {
            const when = DATE_FMT.format(new Date(s.createdAt));
            const dur = formatDuration(s.durationMs);
            return (
              <li
                key={s.id}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3",
                  "transition-colors hover:border-foreground/25 hover:bg-muted/40"
                )}
              >
                <Link
                  href={`/session/${s.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md -mx-1 px-1"
                >
                  <span className="truncate text-base font-medium text-foreground">
                    {s.title?.trim() || "Sessão sem título"}
                  </span>
                  {s.shortSummary ? (
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {s.shortSummary}
                    </span>
                  ) : null}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] tracking-wide text-muted-foreground/80">
                    {s.speakerName?.trim() ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {s.speakerName}
                      </span>
                    ) : null}
                    {s.speakerLocation?.trim() ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {s.speakerLocation}
                      </span>
                    ) : null}
                    <span>
                      {when}
                      {dur ? ` · ${dur}` : ""}
                    </span>
                  </span>
                </Link>
                <form action={deleteSessionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    aria-label="Excluir sessão"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-muted-foreground",
                      "transition-colors hover:bg-destructive/10 hover:text-destructive",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                    )}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
