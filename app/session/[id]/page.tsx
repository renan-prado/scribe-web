import { notFound } from "next/navigation";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { getSession } from "@/lib/db/sessions";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
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

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <SavedSessionView
      title={session.title?.trim() || "Sessão sem título"}
      createdAtLabel={DATE_FMT.format(new Date(session.createdAt))}
      durationLabel={formatDuration(session.durationMs)}
      speakerName={session.speakerName}
      speakerLocation={session.speakerLocation}
      transcript={session.transcript}
      feedItems={session.feedItems}
      summary={session.finalSummary}
    />
  );
}
