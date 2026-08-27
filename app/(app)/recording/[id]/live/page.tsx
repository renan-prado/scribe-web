import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordingLive } from "@/features/session/components/RecordingLive";
import { getSession } from "@/lib/db/sessions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  const name = session?.title?.trim() || "Gravação";
  return { title: `Gravando: ${name}` };
}

type Search = { autostart?: string };

export default async function RecordingLivePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { autostart } = await searchParams;
  const session = await getSession(id);
  if (!session) notFound();

  // Route mismatch guard: audio-only sessions belong on /audio.
  if (session.mode === "audio_only") {
    redirect(`/recording/${id}/audio${autostart === "1" ? "?autostart=1" : ""}`);
  }

  return (
    <RecordingLive
      sessionId={session.id}
      initialSpeakerName={session.speakerName?.trim() ?? ""}
      initialSpeakerLocation={session.speakerLocation?.trim() ?? ""}
      autoStart={autostart === "1"}
    />
  );
}
