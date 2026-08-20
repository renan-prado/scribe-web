"use client";

import { ArrowLeft, FileText, MapPin, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Feed } from "@/features/session/components/Feed";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TranslationProvider } from "@/features/session/hooks/useTranslation";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

/**
 * Read-only view of a saved session. Renders the same SummaryView the live
 * page uses on stop, plus two dialogs — the live feed and the raw transcript —
 * so the user can revisit everything without editing anything.
 */
export function SavedSessionView({
  title,
  createdAtLabel,
  durationLabel,
  speakerName,
  speakerLocation,
  transcript,
  feedItems,
  summary,
}: {
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

  return (
    <TranslationProvider>
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
              "rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={feedItems.length === 0}
              onClick={() => setFeedOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium",
                "transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <Sparkles className="size-3.5" />
              Conteúdo do live
            </button>
            <button
              type="button"
              disabled={!transcript}
              onClick={() => setTranscriptOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium",
                "transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <FileText className="size-3.5" />
              Transcrição
            </button>
          </div>
        </div>

        <header className="flex flex-col gap-3">
          {speakerName?.trim() ? (
            <span className="inline-flex items-center gap-2 text-sm leading-none text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
                <User className="size-3" />
              </span>
              <span className="font-medium leading-none">{speakerName}</span>
            </span>
          ) : null}
          <h1 className="font-heading text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
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
      </main>
    </TranslationProvider>
  );
}
