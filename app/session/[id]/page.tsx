import { permanentRedirect } from "next/navigation";

/**
 * Legacy route. Preserved so any /session/{id} link (bookmarks, prior
 * shares) still works. New links go to /recording/{id}/summary directly.
 */
export default async function LegacySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/recording/${id}/summary`);
}
