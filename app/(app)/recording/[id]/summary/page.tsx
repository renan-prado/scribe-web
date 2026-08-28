import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { hasDeepening } from "@/lib/db/deepenings";
import { getPractices } from "@/lib/db/practices";
import { getSession } from "@/lib/db/sessions";

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
  const [session, deepeningExists, practicesRow] = await Promise.all([
    getSession(id),
    hasDeepening(id),
    getPractices(id).catch(() => null),
  ]);
  if (!session) notFound();

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
      hasDeepening={deepeningExists}
    />
  );
}
