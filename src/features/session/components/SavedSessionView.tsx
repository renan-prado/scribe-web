"use client";

import { MapPin, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { PageBlurOverlay } from "@/components/PageBlurOverlay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCoinsStore } from "@/features/coins/store";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { DeepenButton } from "@/features/session/components/DeepenButton";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TitleDialog } from "@/features/session/components/TitleDialog";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { initialsOf } from "@/features/session/lib/text";
import type { SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

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
  summary: SummaryPayload | null;
  hasDeepening: boolean;
  /** Ver `lib/entitlements/server.ts`. */
  canGenerateStudy: boolean;
  /**
   * A barra do topo, montada pela PÁGINA e entregue pronta.
   *
   * Slot, e não um `backHref`: a `TopBar` é um server component (ela lê o
   * perfil e o saldo), e esta view é `"use client"` — daqui não há como
   * renderizá-la, só como receber o nó já pronto. É também o que trouxe o
   * voltar, a lupa e o avatar para cá: esta tela tinha um link "Voltar" de 12px
   * próprio, e abrir um cartão trocava o cabeçalho do app por outro.
   */
  header?: ReactNode;
  /**
   * Quanta ficha técnica o cabeçalho mostra.
   *
   * - `"full"` (padrão): local numa linha, e a data por extenso com a duração
   *   noutra (curta no celular, longa no desktop).
   * - `"compact"` (o `/summary`): local e data na MESMA linha, separados
   *   por um ponto, e a duração sai. É o cabeçalho do cartão do `/home`
   *   repetido aqui, para que abrir um cartão não pareça trocar de produto; e
   *   a duração some porque ela é do arquivo, não do sermão, ninguém abre um
   *   resumo para saber quantos minutos ele durou.
   *
   * Em `"compact"` quem manda a data já manda SIMPLIFICADA, em
   * `createdAtShortLabel`, "6 set" em vez de "06 de set. de 2026".
   */
  meta?: "full" | "compact";
  /**
   * Como esta sessão nasceu. Só `"manual"` muda alguma coisa aqui, e muda
   * três: o menu ganha "Editar o texto", perde "Reprocessar" e perde "Algo
   * está errado".
   *
   * Reprocessar refaz o resumo A PARTIR DA TRANSCRIÇÃO, e não há transcrição —
   * a chamada custaria 15 moedas para apagar o que a pessoa escreveu e pôr no
   * lugar um resumo de um texto vazio. "Algo está errado" audita a IA contra a
   * transcrição, e aqui não houve IA: o alerta apontaria o dedo para o próprio
   * autor.
   */
  mode?: SessionMode;
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
  summary,
  hasDeepening,
  canGenerateStudy,
  header,
  meta = "full",
  mode = "audio",
}: SavedSessionViewProps) {
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
    router.push("/home");
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
  const written = mode === "manual";

  return (
    // `pt-2`, e não o `py-8` de antes: a barra do topo encosta no alto da tela
    // como encosta na Biblioteca, senão o mesmo cabeçalho pousaria 30px mais
    // baixo ao abrir um cartão.
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-8 sm:gap-8 sm:px-6 sm:pb-10">
      <PageBlurOverlay
        open={reprocessing}
        title="Reprocessando o resumo"
        subtitle="Refazendo os pontos centrais da mensagem."
      />
      {header}

      {/* O holofote do passo "Título, autor e local são seus" recorta o
          cabeçalho INTEIRO, e não só o título: os três campos editáveis moram
          aqui, e apontar para um deles deixaria os outros dois sem explicação
          na única tela em que eles aparecem. */}
      <header data-tour="summary-header" className="flex flex-col gap-3">
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
              onOpenTranscript={() => setTranscriptOpen(true)}
              onDelete={() => setDeleteOpen(true)}
              onReprocess={summary && !written ? handleReprocess : undefined}
              reprocessing={reprocessing}
              onReportHallucination={written ? undefined : () => setReportOpen(true)}
              editHref={written ? `/escrever/${id}` : undefined}
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
                {meta === "compact" ? (
                  <>
                    <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                    {createdAtShortLabel}
                  </>
                ) : null}
              </button>
            ) : (
              <span className="inline-flex w-fit items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLocationDialogOpen(true)}
                  className={cn(ADD_BADGE_CLASSES, "w-fit")}
                >
                  <Plus className="size-3" strokeWidth={2.5} />
                  Adicionar local
                </button>
                {meta === "compact" ? (
                  <span className="text-xs font-light text-scriba-ink-mute">
                    {createdAtShortLabel}
                  </span>
                ) : null}
              </span>
            )}
            {/* A ficha longa (data por extenso + duração) é do cabeçalho
                `full`. No `compact` a data já subiu para a linha do local. */}
            {meta === "full" ? (
              <p className="hidden text-[11px] font-light text-scriba-ink-mute sm:block">
                {createdAtLabel}
                {durationLabel ? ` · ${durationLabel}` : ""}
              </p>
            ) : null}
          </div>
          {/* Gerar estudo pede transcrição, e um texto escrito não tem: a rota
              recusaria com `empty_transcript` depois de o botão prometer. É
              decisão do v1 — se o estudo passar a se ancorar nos próprios
              blocos um dia, o botão volta aqui. */}
          {summary && !written ? (
            <DeepenButton
              sessionId={id}
              hasDeepening={hasDeepening}
              variant="summary-header"
              canGenerate={canGenerateStudy}
            />
          ) : null}
          {/* No mobile a data fica abaixo do botão "Gerar estudo"; no desktop
              ela mora na coluna esquerda, sob o local. No `compact` ela não
              está em nenhum dos dois: mora na linha do local, como no cartão. */}
          {meta === "full" ? (
            <p className="text-[11px] font-light text-scriba-ink-mute sm:hidden">
              {createdAtShortLabel}
            </p>
          ) : null}
        </div>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

      <SummaryView summary={summary} hasTranscript={transcript.length > 0} running={false} />

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
        onReprocess={summary ? handleReprocess : undefined}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={written ? "Excluir este texto?" : "Excluir este resumo?"}
        description={
          written
            ? "Este texto será apagado permanentemente. Esta ação não pode ser desfeita."
            : "O resumo e a transcrição desta gravação serão apagados permanentemente. Esta ação não pode ser desfeita."
        }
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
        kind="speaker"
        open={speakerDialogOpen}
        onOpenChange={setSpeakerDialogOpen}
        title={speakerName?.trim() ? "Editar autor" : "Adicionar autor"}
        placeholder="Nome do pregador"
        initialValue={speakerName ?? ""}
        fetchSuggestions={requestSpeakerSuggestions}
        onSave={(v) => patchField("speakerName", v)}
      />
      <EntityFieldDialog
        kind="location"
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
