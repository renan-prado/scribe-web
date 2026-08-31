import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SavedTranscriptSessionView } from "@/features/session/components/SavedTranscriptSessionView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { getSession } from "@/lib/db/sessions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  return { title: session?.title?.trim() || "Transcrição" };
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

export default async function RecordingTranscriptPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  // Só sessões do modo transcrição moram aqui; as outras têm resumo.
  if (session.mode !== "transcript_only") redirect(`/recording/${id}/summary`);
  // Ainda gravando (nada salvo): volta pra tela de captura.
  if (!session.endedAt) redirect(`/recording/${id}/transcribe`);

  const createdAt = new Date(session.createdAt);

  return (
    <SavedTranscriptSessionView
      id={id}
      title={session.title?.trim() || "Gravação sem título"}
      createdAtLabel={DATE_FMT.format(createdAt)}
      createdAtShortLabel={DATE_FMT_SHORT.format(createdAt)}
      durationLabel={formatDurationLong(session.durationMs)}
      durationMs={session.durationMs}
      speakerName={session.speakerName}
      speakerLocation={session.speakerLocation}
      transcript={session.transcript}
    />
  );
}
