"use client";

import { ChevronDown, ListChecks, Plus } from "lucide-react";
import { useState } from "react";
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
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { useSummaryInsert } from "@/features/session/components/SummaryInsertContext";
import { TranslationChoices } from "@/features/session/components/TranslationChoices";
import { useResolvedTranslation } from "@/features/session/components/TranslationScope";
import { useVerseSelection, VerseSelectionBar } from "@/features/session/components/VerseSelection";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import { TRANSLATIONS, type TranslationId } from "@/lib/bibles/translations";
import { parseVerseReference } from "@/lib/domain/reference";

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
 * **A tradução do subtítulo é um CONTROLE, não um rótulo.** Ela dizia "na NVI"
 * escrita à mão, e ficou mentindo no dia em que a NVI saiu do registro por
 * licença (ver `lib/bibles/translations.ts`): quem lia o capítulo lia a Bíblia
 * Livre com o nome de outra tradução em cima. Agora o nome vem de quem o texto
 * é, e tocá-lo troca a tradução DESTA leitura, aqui e agora, sem gravar nada —
 * a mesma regra do `BibleQuoteBlock`, e pelo mesmo motivo: o capítulo é aberto
 * a partir da prosa de um resumo que pode nem ser de quem está lendo. Quem quer
 * a troca permanente tem o /profile.
 *
 * **O capítulo inteiro não é o único tamanho.** Segurar um versículo abre as
 * caixas e manda só o que foi marcado (`VerseSelection`); o "Selecionar
 * versículos" ao lado do botão é o mesmo caminho para quem está no mouse, onde
 * segurar não é gesto que se descubra. O botão do capítulo inteiro continua
 * ali, porque "a passagem que o pregador abriu" costuma ser o capítulo.
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
  const resolved = useResolvedTranslation();
  const [chosen, setChosen] = useState<TranslationId | null>(null);
  const translation = chosen ?? resolved;
  const state = useVerseFetch(reference, translation);
  const insert = useSummaryInsert();
  const parsed = parseVerseReference(reference);
  const selection = useVerseSelection({
    bookDisplay: parsed?.bookDisplay ?? null,
    chapter: parsed?.chapter ?? null,
    // A tradução só viaja para o bloco quando foi ESCOLHIDA aqui; ver
    // `SummaryInsertApi.addPassages`.
    translation: chosen ?? undefined,
    onCommitted: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookGlyph className="size-3.5" />
            {reference}
          </DialogTitle>
          {/* O gatilho mora DENTRO da frase, e não numa pastilha ao lado: aqui
              o subtítulo já era uma linha de texto, e uma pastilha acrescentaria
              um segundo controle a um diálogo que tem um só. */}
          <DialogDescription className="flex flex-wrap items-center gap-1">
            Capítulo completo, na
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline decoration-dotted underline-offset-[3px] outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label={`Tradução: ${TRANSLATIONS[translation].name}. Trocar.`}
                title="Trocar a tradução"
              >
                {TRANSLATIONS[translation].name}
                <ChevronDown aria-hidden className="size-3" />
              </DropdownMenuTrigger>
              <TranslationChoices value={translation} onChange={setChosen} />
            </DropdownMenu>
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-20">
          {state.status === "ok" && state.verses.length > 0 ? (
            <VerseLines verses={state.verses} selection={selection} />
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
            {selection.active ? (
              <VerseSelectionBar selection={selection} className="w-full" />
            ) : (
              <>
                <Button variant="ghost" onClick={selection.start}>
                  <ListChecks className="size-3.5" />
                  Selecionar versículos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    insert.addPassage(reference, chosen ?? undefined);
                    onOpenChange(false);
                  }}
                >
                  <Plus className="size-3.5" />
                  Capítulo inteiro
                </Button>
              </>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
