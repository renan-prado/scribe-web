import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordingTranscribe } from "@/features/session/components/RecordingTranscribe";
import { getSession } from "@/lib/db/sessions";
import { recordingRouteFor } from "@/lib/domain/session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  const name = session?.title?.trim() || "Gravação";
  return { title: `Transcrevendo: ${name}` };
}

type Search = { autostart?: string };

export default async function RecordingTranscribePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { autostart } = await searchParams;
  const session = await getSession(id);
  if (!session) notFound();

  // Sessão já encerrada: não há o que gravar aqui, manda pra leitura.
  if (session.endedAt) redirect(`/recording/${id}/transcript`);

  // Guard de rota: sessões de outros modos gravam em outra página.
  if (session.mode !== "transcript_only") {
    const route = recordingRouteFor(session.mode);
    redirect(`/recording/${id}/${route}${autostart === "1" ? "?autostart=1" : ""}`);
  }

  return (
    <RecordingTranscribe
      sessionId={session.id}
      initialSpeakerName={session.speakerName?.trim() ?? ""}
      initialSpeakerLocation={session.speakerLocation?.trim() ?? ""}
      autoStart={autostart === "1"}
    />
  );
}
