import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecordingLive } from "@/features/session/components/RecordingLive";
import { getSession } from "@/lib/db/sessions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  const name = session?.title?.trim() || "Gravação";
  return { title: `Gravando: ${name}` };
}

type Search = { autostart?: string };

export default async function RecordingLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const { autostart } = await searchParams;
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <RecordingLive
      sessionId={session.id}
      initialSpeakerName={session.speakerName?.trim() || "Autor desconhecido"}
      initialSpeakerLocation={session.speakerLocation?.trim() || "Local desconhecido"}
      autoStart={autostart === "1"}
    />
  );
}
