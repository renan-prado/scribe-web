"use client";

import { ArrowLeft, MapPin, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { TranslationProvider } from "@/features/session/hooks/useTranslation";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";

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

  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

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

  return (
    <TranslationProvider>
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
        <Link
          href="/home"
          className="inline-flex w-fit items-center gap-1.5 rounded-md -mx-1 px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowLeft className="size-3.5" />
          Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <header className="flex flex-col gap-3">
            {speakerName?.trim() ? (
              <span className="inline-flex items-center gap-2 text-sm leading-none text-muted-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
                  <User className="size-3" />
                </span>
                <span className="font-medium leading-none">{speakerName}</span>
              </span>
            ) : null}
            <h1 className="font-heading text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {title}
            </h1>
            {speakerLocation?.trim() ? (
              <span className="inline-flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
                <MapPin className="size-3" />
                {speakerLocation}
              </span>
            ) : null}
            <p className="text-[0.7rem] tracking-wide text-muted-foreground/80">
              {createdAtLabel}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </header>
          <SessionMenu
            hasTranscript={transcript.length > 0}
            hasLiveFeed={feedItems.length > 0}
            onOpenTranscript={() => setTranscriptOpen(true)}
            onOpenLiveFeed={() => setFeedOpen(true)}
            onEdit={() => setEditOpen(true)}
          />
        </div>

        <div className="h-px w-full bg-border" />

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
                readingMode={false}
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
              <p className="text-pretty text-sm leading-relaxed text-foreground whitespace-pre-wrap">
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
    </TranslationProvider>
  );
}
