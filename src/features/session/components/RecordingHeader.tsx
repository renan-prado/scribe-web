"use client";

import { Check, MapPin, Pencil, Plus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { defaultRecordingTitle } from "@/features/session/lib/formatting";
import {
  isUnknownLocationLabel,
  isUnknownSpeakerLabel,
  normalizeLocationInput,
  normalizeSpeakerInput,
} from "@/features/session/lib/unknown";
import { getSessionState, useSessionStore } from "@/features/session/store";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
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

type TitleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  onSave: (value: string) => void;
};

function TitleDialog({ open, onOpenChange, initialValue, onSave }: TitleDialogProps) {
  const [draft, setDraft] = useState(initialValue);
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);
  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar título</DialogTitle>
        </DialogHeader>
        <input
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-5 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] transition-colors",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header bar for the live recording page. Owned state (title, speakerName,
 * speakerLocation, saved, recording start time) all lives in the session
 * store — the header reads and writes it directly instead of drilling
 * callbacks from RecordingLive. Only `menu` is drilled because it's a
 * ReactNode composed by the caller.
 *
 * When speaker/location are unknown, the header renders a standard "Adicionar
 * autor / local" badge that opens its OWN searchable combobox (independent
 * dialog per field). Clicking the input in that combobox surfaces the list
 * of the user's previously used entities, ordered by usage.
 */
type RecordingHeaderProps = {
  menu: ReactNode;
};

export function RecordingHeader({ menu }: RecordingHeaderProps) {
  const title = useSessionStore((s) => s.summaryTitle);
  const startedAt = useSessionStore((s) => s.recordingStartedAt);
  const speakerName = useSessionStore((s) => s.speakerName);
  const speakerLocation = useSessionStore((s) => s.speakerLocation);
  const saved = useSessionStore((s) => s.saved);

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);

  const displayTitle =
    title.trim() || (startedAt ? defaultRecordingTitle(startedAt) : "Nova gravação");
  const speakerUnknown = isUnknownSpeakerLabel(speakerName);
  const locationUnknown = isUnknownLocationLabel(speakerLocation);
  const initials = initialsOf(speakerName);

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {speakerUnknown ? (
            <button
              type="button"
              onClick={() => setNameDialogOpen(true)}
              className={ADD_BADGE_CLASSES}
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Adicionar autor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setNameDialogOpen(true)}
              className={cn(
                "group flex items-center gap-2 rounded-full px-1 -mx-1 py-0.5 outline-none transition-colors",
                "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink">
                {initials}
              </span>
              <span className="text-sm font-medium leading-none text-scriba-ink">
                {speakerName}
              </span>
              <Pencil className="size-3 opacity-0 text-scriba-ink-soft transition-opacity group-hover:opacity-60" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {saved ? (
              <span
                role="status"
                aria-label="Sessão salva"
                className="inline-flex items-center gap-1.5 rounded-full bg-scriba-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-dark"
              >
                <span className="size-1.5 rounded-full bg-scriba-mint-strong" />
                Salvo
                <Check className="size-3" />
              </span>
            ) : null}
            {menu}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTitleDialogOpen(true)}
          className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-scriba-blue-soft/60"
        >
          <h1
            key={displayTitle}
            className="animate-content-fade font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl"
            suppressHydrationWarning
          >
            {displayTitle}
            <Pencil className="ml-2 inline size-4 align-middle opacity-0 text-scriba-ink-mute transition-opacity group-hover:opacity-60" />
          </h1>
        </button>

        {locationUnknown ? (
          <button
            type="button"
            onClick={() => setLocationDialogOpen(true)}
            className={cn(ADD_BADGE_CLASSES, "mt-1 w-fit")}
          >
            <Plus className="size-3" strokeWidth={2.5} />
            Adicionar local
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLocationDialogOpen(true)}
            className={cn(
              "group -mx-1 mt-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 outline-none transition-colors",
              "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            <MapPin className="size-3 shrink-0 text-scriba-ink-mute" />
            <span className="text-xs font-light leading-none text-scriba-ink-mute">
              {speakerLocation}
            </span>
            <Pencil className="size-3 opacity-0 text-scriba-ink-mute transition-opacity group-hover:opacity-60" />
          </button>
        )}
      </header>

      <EntityFieldDialog
        open={nameDialogOpen}
        onOpenChange={setNameDialogOpen}
        title={speakerUnknown ? "Adicionar autor" : "Editar autor"}
        placeholder="Nome do pregador"
        initialValue={normalizeSpeakerInput(speakerName)}
        fetchSuggestions={requestSpeakerSuggestions}
        onSave={(v) => {
          if (v) getSessionState().setSpeakerName(v);
        }}
      />
      <EntityFieldDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        title={locationUnknown ? "Adicionar local" : "Editar local"}
        placeholder="Igreja ou local"
        initialValue={normalizeLocationInput(speakerLocation)}
        fetchSuggestions={requestLocationSuggestions}
        onSave={(v) => {
          if (v) getSessionState().setSpeakerLocation(v);
        }}
      />
      <TitleDialog
        open={titleDialogOpen}
        onOpenChange={setTitleDialogOpen}
        initialValue={displayTitle}
        onSave={(v) => {
          const s = getSessionState();
          s.setSummaryTitle(v);
          s.lockTitle();
        }}
      />
    </>
  );
}
