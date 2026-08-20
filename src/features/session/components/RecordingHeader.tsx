"use client";

import { Check, MapPin, Pencil, User } from "lucide-react";
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
  return `Gravação dia ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}.`;
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
    title.trim() || (startedAt ? defaultRecordingTitle(startedAt) : "Nova gravação.");

  const handleTitleSave = (value: string) => {
    onTitleChange(value);
    onTitleLock();
  };

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setNameDialogOpen(true)}
            className={cn(
              "group flex items-center gap-2 text-sm leading-none text-muted-foreground",
              "rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border transition-colors group-hover:border-foreground/30">
              <User className="size-3" />
            </span>
            <span className="font-medium leading-none">{speakerName}</span>
            <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
          {menu}
        </div>

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setTitleDialogOpen(true)}
            className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted"
          >
            <h1
              key={displayTitle}
              className="animate-content-fade font-heading text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl md:text-4xl"
              suppressHydrationWarning
            >
              {displayTitle}
              <Pencil className="ml-2 inline size-4 align-middle opacity-0 transition-opacity group-hover:opacity-40" />
            </h1>
          </button>
          {saved ? (
            <span
              role="status"
              aria-label="Sessão salva"
              className="animate-content-fade inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-emerald-700 uppercase dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <Check className="size-3" />
              Salvo
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setLocationDialogOpen(true)}
          className={cn(
            "group mt-4 flex items-center gap-1.5 text-xs leading-none text-muted-foreground",
            "rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-muted hover:text-foreground cursor-pointer w-fit"
          )}
        >
          <MapPin className="size-3 shrink-0" />
          <span className="leading-none">{speakerLocation}</span>
          <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
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
        onSave={handleTitleSave}
      />
    </>
  );
}
