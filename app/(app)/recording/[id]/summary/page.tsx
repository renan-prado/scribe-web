import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { hasDeepening } from "@/lib/db/deepenings";
import { getHighlights } from "@/lib/db/highlights";
import { getPractices } from "@/lib/db/practices";
import { getReminders } from "@/lib/db/reminders";
import { getRereads } from "@/lib/db/rereads";
import { getSession } from "@/lib/db/sessions";
import { canCurrentUserUse } from "@/lib/entitlements/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  return { title: session?.title?.trim() || "Sessão sem título" };
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FMT_SHORT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function RecordingSummaryPage({ params }: PageProps) {
  const { id } = await params;
  const [
    session,
    deepeningExists,
    practicesRow,
    rereadsRow,
    remindersRow,
    highlightsRow,
    canGenerateStudy,
  ] = await Promise.all([
    getSession(id),
    hasDeepening(id),
    getPractices(id).catch(() => null),
    getRereads(id).catch(() => null),
    getReminders(id).catch(() => null),
    getHighlights(id).catch(() => null),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);
  if (!session) notFound();
  // Sessões do modo transcrição não têm resumo — moram na página de leitura
  // da transcrição.
  if (session.mode === "transcript_only") redirect(`/recording/${id}/transcript`);

  const createdAt = new Date(session.createdAt);

  return (
    <SavedSessionView
      id={id}
      title={session.title?.trim() || "Sessão sem título"}
      createdAtLabel={DATE_FMT.format(createdAt)}
      createdAtShortLabel={DATE_FMT_SHORT.format(createdAt)}
      durationLabel={formatDurationLong(session.durationMs)}
      durationMs={session.durationMs}
      speakerName={session.speakerName}
      speakerLocation={session.speakerLocation}
      transcript={session.transcript}
      feedItems={session.feedItems}
      summary={session.finalSummary}
      practices={practicesRow?.payload ?? null}
      rereads={rereadsRow?.payload ?? null}
      reminders={remindersRow?.payload ?? null}
      highlights={highlightsRow?.payload ?? null}
      hasDeepening={deepeningExists}
      canGenerateStudy={canGenerateStudy}
    />
  );
}
