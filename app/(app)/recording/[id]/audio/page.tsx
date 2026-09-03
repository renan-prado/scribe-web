import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordingAudioOnly } from "@/features/session/components/RecordingAudioOnly";
import { getSessionMeta } from "@/lib/db/sessions";
import { recordingRouteFor } from "@/lib/domain/session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionMeta(id);
  const name = session?.title?.trim() || "Gravação";
  return { title: `Gravando: ${name}` };
}

type Search = { autostart?: string };

export default async function RecordingAudioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { autostart } = await searchParams;
  const session = await getSessionMeta(id);
  if (!session) notFound();

  // Route mismatch guard: cada modo grava na sua própria página.
  if (session.mode !== "audio_only") {
    const route = recordingRouteFor(session.mode);
    redirect(`/recording/${id}/${route}${autostart === "1" ? "?autostart=1" : ""}`);
  }

  return (
    <RecordingAudioOnly
      sessionId={session.id}
      initialSpeakerName={session.speakerName?.trim() ?? ""}
      initialSpeakerLocation={session.speakerLocation?.trim() ?? ""}
      autoStart={autostart === "1"}
    />
  );
}
