"use client";

import { ArrowLeft, MapPin, Pencil, Plus } from "lucide-react";
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
import { ColoqueEmPratica } from "@/features/session/components/ColoqueEmPratica";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { DeepenButton } from "@/features/session/components/DeepenButton";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { Feed } from "@/features/session/components/Feed";
import { FeedAgendadoPreview } from "@/features/session/components/FeedAgendadoPreview";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TitleDialog } from "@/features/session/components/TitleDialog";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import type { FeedItem } from "@/lib/domain/feed";
import type { HighlightsPayload } from "@/lib/domain/highlights";
import type { PracticesPayload } from "@/lib/domain/practices";
import type { RemindersPayload } from "@/lib/domain/reminders";
import type { RereadsPayload } from "@/lib/domain/rereads";
import type { SummaryPayload } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** Neutral pill matching the "Salvo" / "Estudo" family for "add missing meta"
 * CTAs. Rendered when speaker or location is unknown. */
const ADD_BADGE_CLASSES = cn(
  "inline-flex items-center gap-1 rounded-full bg-scriba-ink-mute/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft outline-none transition-colors",
  "hover:bg-scriba-blue-soft/70 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40"
);

/**
 * View of a saved session. Renders the same SummaryView the live page uses on
 * stop, plus dialogs for the live feed, the raw transcript, and editing metadata.
 *
 * Speaker and location each get an independent edit dialog (opened by clicking
 * the badge/chip). The combined "Editar sermão" dialog is still reachable from
 * the menu for cases where the user wants to touch multiple fields at once.
 */
type SavedSessionViewProps = {
  id: string;
  title: string;
  createdAtLabel: string;
  createdAtShortLabel: string;
  durationLabel: string;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  transcript: string;
  feedItems: FeedItem[];
  summary: SummaryPayload | null;
  practices: PracticesPayload | null;
  rereads: RereadsPayload | null;
  reminders: RemindersPayload | null;
  highlights: HighlightsPayload | null;
  hasDeepening: boolean;
  /** Ver `lib/entitlements/server.ts`. */
  canGenerateStudy: boolean;
};

export function SavedSessionView({
  id,
  title: initialTitle,
  createdAtLabel,
  createdAtShortLabel,
  durationLabel,
  durationMs,
  speakerName: initialSpeakerName,
  speakerLocation: initialSpeakerLocation,
  transcript,
  feedItems,
  summary,
  practices,
  rereads,
  reminders,
  highlights,
  hasDeepening,
  canGenerateStudy,
}: SavedSessionViewProps) {
  const [feedOpen, setFeedOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const router = useRouter();
  const refreshCoins = useCoinsStore((s) => s.refresh);

  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

  async function handleDelete() {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir. Tente novamente.");
      return;
    }
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

  async function patchField(field: "title" | "speakerName" | "speakerLocation", value: string) {
    const body = { [field]: value || null };
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("update failed");
    if (field === "title") setTitle(value || title);
    else if (field === "speakerName") setSpeakerName(value || null);
    else setSpeakerLocation(value || null);
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
            <button
              type="button"
              onClick={() => setSpeakerDialogOpen(true)}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full -mx-1 px-1 py-0.5 outline-none transition-colors",
                "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink">
                {initials}
              </span>
              <span className="text-sm font-medium leading-none text-scriba-ink">
                {speakerName}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSpeakerDialogOpen(true)}
              className={ADD_BADGE_CLASSES}
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Adicionar autor
            </button>
          )}
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-label="Sessão salva"
              className="hidden items-center gap-1.5 rounded-full bg-scriba-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-dark sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-scriba-mint-strong" />
              Salvo
            </span>
            <SessionMenu
              hasTranscript={transcript.length > 0}
              hasLiveFeed={feedItems.length > 0}
              onOpenTranscript={() => setTranscriptOpen(true)}
              onOpenLiveFeed={() => setFeedOpen(true)}
              onDelete={() => setDeleteOpen(true)}
              onReprocess={summary ? handleReprocess : undefined}
              reprocessing={reprocessing}
              onReportHallucination={() => setReportOpen(true)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTitleDialogOpen(true)}
          className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-scriba-blue-soft/60"
        >
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl">
            {title}
            <Pencil className="ml-2 inline size-4 align-middle opacity-0 text-scriba-ink-mute transition-opacity group-hover:opacity-60" />
          </h1>
        </button>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            {speakerLocation?.trim() ? (
              <button
                type="button"
                onClick={() => setLocationDialogOpen(true)}
                className={cn(
                  "group -mx-1 inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-light text-scriba-ink-mute outline-none transition-colors",
                  "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              >
                <MapPin className="size-3" />
                {speakerLocation}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLocationDialogOpen(true)}
                className={cn(ADD_BADGE_CLASSES, "w-fit")}
              >
                <Plus className="size-3" strokeWidth={2.5} />
                Adicionar local
              </button>
            )}
            <p className="hidden text-[11px] font-light text-scriba-ink-mute sm:block">
              {createdAtLabel}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </div>
          {summary ? (
            <DeepenButton
              sessionId={id}
              hasDeepening={hasDeepening}
              variant="summary-header"
              canGenerate={canGenerateStudy}
            />
          ) : null}
          {/* No mobile a data fica abaixo do botão "Gerar estudo"; no desktop
              ela mora na coluna esquerda, sob o local. */}
          <p className="text-[11px] font-light text-scriba-ink-mute sm:hidden">
            {createdAtShortLabel}
          </p>
        </div>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

      <SummaryView summary={summary} hasTranscript={transcript.length > 0} running={false} />

      {/* As tres secoes pos-resumo reservam a mesma "canaleta" direita que os
          blocos do SummaryView reservam pro botao de comentario do Scriba —
          um placeholder invisivel size-9 alinha a borda direita de todo o
          conteudo na mesma coluna. No mobile o placeholder some. */}
      <div className="flex items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <ColoqueEmPratica practices={practices} />
        </div>
        <div aria-hidden className="hidden size-9 shrink-0 sm:block" />
      </div>

      <div className="flex items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <FeedAgendadoPreview rereads={rereads} reminders={reminders} highlights={highlights} />
        </div>
        <div aria-hidden className="hidden size-9 shrink-0 sm:block" />
      </div>

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

      <HallucinationReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={id}
        scope="summary"
        onReprocess={summary ? handleReprocess : undefined}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir este resumo?"
        description="O resumo e a transcrição desta gravação serão apagados permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        onConfirm={handleDelete}
      />

      <TitleDialog
        open={titleDialogOpen}
        onOpenChange={setTitleDialogOpen}
        initialValue={title}
        onSave={(v) => patchField("title", v)}
      />

      <EntityFieldDialog
        open={speakerDialogOpen}
        onOpenChange={setSpeakerDialogOpen}
        title={speakerName?.trim() ? "Editar autor" : "Adicionar autor"}
        placeholder="Nome do pregador"
        initialValue={speakerName ?? ""}
        fetchSuggestions={requestSpeakerSuggestions}
        onSave={(v) => patchField("speakerName", v)}
      />
      <EntityFieldDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        title={speakerLocation?.trim() ? "Editar local" : "Adicionar local"}
        placeholder="Igreja ou local"
        initialValue={speakerLocation ?? ""}
        fetchSuggestions={requestLocationSuggestions}
        onSave={(v) => patchField("speakerLocation", v)}
      />
    </main>
  );
}
