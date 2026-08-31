"use client";

import { ArrowLeft, FileText, MapPin, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NavLink } from "@/components/NavLink";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import { TitleDialog } from "@/features/session/components/TitleDialog";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

const ADD_BADGE_CLASSES = cn(
  "inline-flex items-center gap-1 rounded-full bg-scriba-ink-mute/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft outline-none transition-colors",
  "hover:bg-scriba-blue-soft/70 hover:text-scriba-blue focus-visible:ring-2 focus-visible:ring-ring/40"
);

type Props = {
  id: string;
  title: string;
  createdAtLabel: string;
  createdAtShortLabel: string;
  durationLabel: string;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  transcript: string;
};

/**
 * Sessão salva do modo transcrição. É a contraparte do SavedSessionView para
 * sessões sem `final_summary`: em vez de resumo + estudo + práticas, a página
 * inteira é a transcrição, com o mesmo painel de busca usado no dialog das
 * outras sessões.
 *
 * Nada aqui oferece gerar resumo ou aprofundamento — o usuário escolheu o modo
 * mais barato justamente para não pagar LLM, e a promessa da tela é essa.
 * Título, autor e local seguem editáveis pelo PATCH de meta.
 */
export function SavedTranscriptSessionView({
  id,
  title: initialTitle,
  createdAtLabel,
  createdAtShortLabel,
  durationLabel,
  durationMs,
  speakerName: initialSpeakerName,
  speakerLocation: initialSpeakerLocation,
  transcript,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir. Tente novamente.");
      return;
    }
    router.push("/list");
  }

  async function patchField(field: "title" | "speakerName" | "speakerLocation", value: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (!res.ok) throw new Error("update failed");
    if (field === "title") setTitle(value || title);
    else if (field === "speakerName") setSpeakerName(value || null);
    else setSpeakerLocation(value || null);
  }

  const initials = initialsOf(speakerName);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
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
                "group -mx-1 inline-flex items-center gap-2 rounded-full px-1 py-0.5 outline-none transition-colors",
                "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-scriba-cream-accent">
            <FileText className="size-3" />
            Transcrição
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTitleDialogOpen(true)}
          className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-scriba-blue-soft/60"
        >
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl">
            {title}
            <Pencil className="ml-2 inline size-4 align-middle text-scriba-ink-mute opacity-0 transition-opacity group-hover:opacity-60" />
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
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-scriba-ink-mute outline-none transition-colors",
              "hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            Excluir
          </button>
          <p className="text-[11px] font-light text-scriba-ink-mute sm:hidden">
            {createdAtShortLabel}
          </p>
        </div>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

      <SavedTranscriptView transcript={transcript} durationMs={durationMs} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir esta transcrição?"
        description="O texto desta gravação será apagado permanentemente. Esta ação não pode ser desfeita."
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
