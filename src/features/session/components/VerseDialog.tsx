"use client";

import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";

export function VerseDialog({
  reference,
  onOpenChange,
}: {
  reference: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const state = useVerseFetch(reference);
  const open = reference !== null;
  const headerRef = state.status === "ok" ? state.reference : reference || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            {headerRef}
          </DialogTitle>
          <DialogDescription>
            {state.status === "ok" && state.translation
              ? `Tradução: ${state.translation}`
              : "Versículo sugerido pela IA"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[80px]">
          {state.status === "loading" ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-muted" />
              <div className="h-4 w-11/12 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
              <div className="h-4 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:240ms]" />
            </div>
          ) : state.status === "ok" && state.text ? (
            <blockquote className="text-pretty text-base leading-relaxed text-foreground/90">
              {state.text}
            </blockquote>
          ) : state.status === "ok" ? (
            <p className="text-sm text-muted-foreground">
              Não consegui recuperar o texto dessa referência com confiança. Consulte sua Bíblia.
            </p>
          ) : state.status === "error" ? (
            <p className="text-sm text-destructive">Falha ao buscar: {state.message}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
