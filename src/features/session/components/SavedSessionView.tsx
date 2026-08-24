"use client";

import { ArrowLeft, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditSessionDialog } from "@/features/session/components/EditSessionDialog";
import { Feed } from "@/features/session/components/Feed";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { SummaryView } from "@/features/session/components/SummaryView";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * View of a saved session. Renders the same SummaryView the live page uses on
 * stop, plus dialogs for the live feed, the raw transcript, and editing metadata.
 */
export function SavedSessionView({
  id,
  title: initialTitle,
  createdAtLabel,
  durationLabel,
  speakerName: initialSpeakerName,
  speakerLocation: initialSpeakerLocation,
  transcript,
  feedItems,
  summary,
}: {
  id: string;
  title: string;
  createdAtLabel: string;
  durationLabel: string;
  speakerName: string | null;
  speakerLocation: string | null;
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload | null;
}) {
  const [feedOpen, setFeedOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

  async function handleDelete() {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    router.push("/list");
  }

  async function handleSave(fields: {
    title: string;
    speakerName: string;
    speakerLocation: string;
  }) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error("update failed");
    setTitle(fields.title || title);
    setSpeakerName(fields.speakerName || null);
    setSpeakerLocation(fields.speakerLocation || null);
  }

  const initials = initialsOf(speakerName);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
      <NavLink
        href="/list"
        className="-mx-1 inline-flex w-fit items-center rounded-md px-1 py-0.5 text-xs font-medium text-[color:var(--scriba-ink-mute)] transition-colors hover:text-[color:var(--scriba-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-3.5" />
        Voltar
      </NavLink>

      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {speakerName?.trim() ? (
            <div className="inline-flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--scriba-blue-soft)] text-[10px] font-semibold text-[color:var(--scriba-blue)]">
                {initials}
              </span>
              <span className="text-sm font-medium leading-none text-[color:var(--scriba-ink)]">
                {speakerName}
              </span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-label="Sessão salva"
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--scriba-mint)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#3F7F66]"
            >
              <span className="size-1.5 rounded-full bg-[#4E9C7F]" />
              Salvo
            </span>
            <SessionMenu
              hasTranscript={transcript.length > 0}
              hasLiveFeed={feedItems.length > 0}
              onOpenTranscript={() => setTranscriptOpen(true)}
              onOpenLiveFeed={() => setFeedOpen(true)}
              onEdit={() => setEditOpen(true)}
              onDelete={handleDelete}
            />
          </div>
        </div>

        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-3xl md:text-4xl">
          {title}
        </h1>

        {speakerLocation?.trim() ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-light text-[color:var(--scriba-ink-mute)]">
            <MapPin className="size-3" />
            {speakerLocation}
          </span>
        ) : null}
        <p className="text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
          {createdAtLabel}
          {durationLabel ? ` · ${durationLabel}` : ""}
        </p>
      </header>

      <div className="h-px w-full bg-[color:var(--scriba-hairline)]" />

      <SummaryView summary={summary} hasTranscript={transcript.length > 0} running={false} />

      <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conteúdo do live</DialogTitle>
            <DialogDescription>
              Cartões extraídos e sugestões que apareceram durante a gravação.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <Feed
              items={feedItems}
              running={false}
              hasTranscript={transcript.length > 0}
              suggesting={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transcrição</DialogTitle>
            <DialogDescription>Texto bruto capturado pelo microfone.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <p className="text-pretty text-sm font-light leading-relaxed text-[color:var(--scriba-ink)] whitespace-pre-wrap">
              {transcript || "Sem transcrição."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <EditSessionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          title,
          speakerName: speakerName ?? "",
          speakerLocation: speakerLocation ?? "",
        }}
        onSave={handleSave}
      />
    </main>
  );
}
