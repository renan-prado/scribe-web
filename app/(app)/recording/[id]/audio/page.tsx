import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordingAudioOnly } from "@/features/session/components/RecordingAudioOnly";
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

export default async function RecordingAudioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { autostart } = await searchParams;
  const session = await getSession(id);
  if (!session) notFound();

  // Route mismatch guard: live-mode sessions belong on /live.
  if (session.mode === "live") {
    redirect(`/recording/${id}/live${autostart === "1" ? "?autostart=1" : ""}`);
  }

  return (
    <RecordingAudioOnly
      sessionId={session.id}
      initialSpeakerName={session.speakerName?.trim() || "Autor desconhecido"}
      initialSpeakerLocation={session.speakerLocation?.trim() || "Local desconhecido"}
      autoStart={autostart === "1"}
    />
  );
}
