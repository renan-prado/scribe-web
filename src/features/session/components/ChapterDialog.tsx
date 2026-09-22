"use client";

import { Plus } from "lucide-react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { useSummaryInsert } from "@/features/session/components/SummaryInsertContext";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";

/**
 * O capítulo inteiro, aberto a partir de uma menção do resumo ("Jonas 1").
 *
 * Irmão do `VerseDialog`, e separado dele de propósito: aquele mostra UM
 * versículo que a IA sugeriu, com o texto corrido de `joinVerses` e o subtítulo
 * dizendo de onde veio. Aqui é o capítulo que o PREGADOR citou, em dezenas de
 * versículos numerados, juntá-los num parágrafo só daria um bloco ilegível.
 * Fundir os dois num componente com bandeira seria um `if` para cada linha.
 *
 * Não precisa de rota nova: `/api/verse` já trata referência sem versículo
 * como capítulo inteiro (`ref.startVerse ?? 1` até o primeiro buraco), e
 * `useVerseFetch` cacheia por referência com `staleTime` infinito, reabrir o
 * mesmo capítulo não repete a busca.
 *
 * A rolagem é do `DialogContent`, que já tem `max-h-[85dvh]` e um corpo com
 * `overflow-y-auto`. O Salmo 119, com 176 versículos, cabe sem nada extra.
 *
 * **"Adicionar ao resumo" só aparece dentro de um `SummaryInsertProvider`.**
 * Este diálogo é aberto de qualquer prosa que passa por `RichText` —
 * resumo, estudo, mensagem do Biblo —, e nem toda tela tem onde escrever a
 * resposta (a landing, por exemplo, não tem sessão nenhuma). `useSummaryInsert()`
 * devolve `null` fora do provider, e o botão simplesmente não desenha —
 * sem isso, cada chamador teria de saber por conta própria se está numa
 * tela que aceita escrita.
 */
export function ChapterDialog({
  reference,
  open,
  onOpenChange,
}: {
  reference: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const state = useVerseFetch(reference);
  const insert = useSummaryInsert();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookGlyph className="size-3.5" />
            {reference}
          </DialogTitle>
          <DialogDescription>Capítulo completo, na NVI</DialogDescription>
        </DialogHeader>
        <div className="min-h-20">
          {state.status === "ok" && state.verses.length > 0 ? (
            <VerseLines verses={state.verses} />
          ) : state.status === "ok" ? (
            <p className="text-sm text-muted-foreground">
              Não consegui recuperar o texto desse capítulo. Consulte sua Bíblia.
            </p>
          ) : state.status === "error" ? (
            <p className="text-sm text-destructive">Falha ao buscar: {state.message}</p>
          ) : (
            <div aria-hidden className="flex flex-col gap-2 pl-3">
              {["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[95%]", "w-[90%]"].map((w, i) => (
                <span
                  key={w}
                  className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${w}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          )}
        </div>
        {insert ? (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                insert.addPassage(reference);
                onOpenChange(false);
              }}
            >
              <Plus className="size-3.5" />
              Adicionar ao resumo
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
