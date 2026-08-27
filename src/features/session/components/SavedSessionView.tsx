"use client";

import { ArrowLeft, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NavLink } from "@/components/NavLink";
import { PageBlurOverlay } from "@/components/PageBlurOverlay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCoinsStore } from "@/features/coins/store";
import { DeepenButton } from "@/features/session/components/DeepenButton";
import { EditSessionDialog } from "@/features/session/components/EditSessionDialog";
import { Feed } from "@/features/session/components/Feed";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
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
type SavedSessionViewProps = {
  id: string;
  title: string;
  createdAtLabel: string;
  durationLabel: string;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload | null;
  hasDeepening: boolean;
};

export function SavedSessionView({
  id,
  title: initialTitle,
  createdAtLabel,
  durationLabel,
  durationMs,
  speakerName: initialSpeakerName,
  speakerLocation: initialSpeakerLocation,
  transcript,
  feedItems,
  summary,
  hasDeepening,
}: SavedSessionViewProps) {
  const [feedOpen, setFeedOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const router = useRouter();
  const refreshCoins = useCoinsStore((s) => s.refresh);

  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

  async function handleDelete() {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    router.push("/list");
  }

  async function handleReprocess() {
    if (reprocessing) return;
    setReprocessing(true);
    try {
      const res = await fetch("/api/final-summary/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 402 || body.error === "insufficient_balance") {
        toast.error("Moedas insuficientes para reprocessar.");
        return;
      }
      if (!res.ok) {
        toast.error("Não consegui reprocessar o resumo. Tente novamente.");
        return;
      }
      void refreshCoins();
      toast.success("Resumo atualizado.");
      router.refresh();
    } catch {
      toast.error("Falha de conexão ao reprocessar.");
    } finally {
      setReprocessing(false);
    }
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
      <PageBlurOverlay
        open={reprocessing}
        title="Reprocessando o resumo"
        subtitle="Refazendo os pontos centrais e enriquecendo com contexto."
      />
      <NavLink
        href="/list"
        className="-mx-1 inline-flex w-fit items-center rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-3.5" />
        Voltar
      </NavLink>

      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {speakerName?.trim() ? (
            <div className="inline-flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue">
                {initials}
              </span>
              <span className="text-sm font-medium leading-none text-scriba-ink">
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
              className="inline-flex items-center gap-1.5 rounded-full bg-scriba-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#3F7F66]"
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
              onReprocess={summary ? handleReprocess : undefined}
              reprocessing={reprocessing}
            />
          </div>
        </div>

        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl">
          {title}
        </h1>

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {speakerLocation?.trim() ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-light text-scriba-ink-mute">
                <MapPin className="size-3" />
                {speakerLocation}
              </span>
            ) : null}
            <p className="text-[11px] font-light text-scriba-ink-mute">
              {createdAtLabel}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </div>
          {summary ? (
            <DeepenButton sessionId={id} hasDeepening={hasDeepening} variant="summary-header" />
          ) : null}
        </div>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

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
            <DialogDescription className="sr-only">
              Texto bruto capturado pelo microfone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <SavedTranscriptView transcript={transcript} durationMs={durationMs} />
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
