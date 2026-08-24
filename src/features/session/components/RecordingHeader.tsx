"use client";

import { Check, MapPin, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function defaultRecordingTitle(date: Date): string {
  return `Gravação dia ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function EditDialog({
  open,
  onOpenChange,
  heading,
  currentValue,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  currentValue: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(currentValue);

  useEffect(() => {
    if (open) setDraft(currentValue);
  }, [open, currentValue]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <input
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecordingHeader({
  title,
  startedAt,
  speakerName,
  speakerLocation,
  onTitleChange,
  onTitleLock,
  onSpeakerNameChange,
  onSpeakerLocationChange,
  menu,
  saved = false,
}: {
  title: string;
  startedAt: Date | null;
  speakerName: string;
  speakerLocation: string;
  onTitleChange: (title: string) => void;
  onTitleLock: () => void;
  onSpeakerNameChange: (name: string) => void;
  onSpeakerLocationChange: (location: string) => void;
  menu: React.ReactNode;
  saved?: boolean;
}) {
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);

  const displayTitle =
    title.trim() || (startedAt ? defaultRecordingTitle(startedAt) : "Nova gravação");
  const initials = initialsOf(speakerName);

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setNameDialogOpen(true)}
            className={cn(
              "group flex items-center gap-2 rounded-full px-1 -mx-1 py-0.5 outline-none transition-colors",
              "hover:bg-[color:var(--scriba-blue-soft)]/60 focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--scriba-blue-soft)] text-[10px] font-semibold text-[color:var(--scriba-blue)]">
              {initials}
            </span>
            <span className="text-sm font-medium leading-none text-[color:var(--scriba-ink)]">
              {speakerName}
            </span>
            <Pencil className="size-3 opacity-0 text-[color:var(--scriba-ink-soft)] transition-opacity group-hover:opacity-60" />
          </button>
          <div className="flex items-center gap-2">
            {saved ? (
              <span
                role="status"
                aria-label="Sessão salva"
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--scriba-mint)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#3F7F66]"
              >
                <span className="size-1.5 rounded-full bg-[#4E9C7F]" />
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
          className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[color:var(--scriba-blue-soft)]/60"
        >
          <h1
            key={displayTitle}
            className="animate-content-fade font-heading text-2xl font-semibold leading-tight tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-3xl md:text-4xl"
            suppressHydrationWarning
          >
            {displayTitle}
            <Pencil className="ml-2 inline size-4 align-middle opacity-0 text-[color:var(--scriba-ink-mute)] transition-opacity group-hover:opacity-60" />
          </h1>
        </button>

        <button
          type="button"
          onClick={() => setLocationDialogOpen(true)}
          className={cn(
            "group -mx-1 mt-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 outline-none transition-colors",
            "hover:bg-[color:var(--scriba-blue-soft)]/60 focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          <MapPin className="size-3 shrink-0 text-[color:var(--scriba-ink-mute)]" />
          <span className="text-xs font-light leading-none text-[color:var(--scriba-ink-mute)]">
            {speakerLocation}
          </span>
          <Pencil className="size-3 opacity-0 text-[color:var(--scriba-ink-mute)] transition-opacity group-hover:opacity-60" />
        </button>
      </header>

      <EditDialog
        open={nameDialogOpen}
        onOpenChange={setNameDialogOpen}
        heading="Editar autor"
        currentValue={speakerName}
        onSave={onSpeakerNameChange}
      />
      <EditDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        heading="Editar local"
        currentValue={speakerLocation}
        onSave={onSpeakerLocationChange}
      />
      <EditDialog
        open={titleDialogOpen}
        onOpenChange={setTitleDialogOpen}
        heading="Editar título"
        currentValue={displayTitle}
        onSave={(v) => {
          onTitleChange(v);
          onTitleLock();
        }}
      />
    </>
  );
}
