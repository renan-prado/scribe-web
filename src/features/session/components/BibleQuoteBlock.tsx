"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { useResolvedTranslation } from "@/features/session/components/TranslationScope";
import {
  SELECTABLE_TRANSLATIONS,
  TRANSLATIONS,
  type TranslationId,
} from "@/lib/bibles/translations";
import { cn } from "@/lib/utils";

/**
 * O cartão de uma citação bíblica na LEITURA, com a tradução na pastilha.
 *
 * ## Três níveis, e cada um pertence a uma pessoa diferente
 *
 * 1. **O padrão do produto** (`DEFAULT_TRANSLATION`), para quem nunca escolheu.
 * 2. **A preferência de quem LÊ**, no /profile, que desce pelo `TranslationScope`.
 * 3. **A escolha da CITAÇÃO**, gravada no bloco por quem escreveu o resumo.
 *
 * O bloco vence a preferência porque um texto que cita Almeida de propósito
 * continua citando Almeida na tela de quem prefere a Bíblia Livre.
 *
 * ## E o quarto, que não é gravado
 *
 * O toque na pastilha troca a tradução DESTA citação, aqui e agora, sem salvar
 * nada: é a pergunta "como ficaria em outra?", feita no meio de uma leitura que
 * pode ser de um resumo que nem é seu. Gravar exigiria dono, rota e escrita no
 * jsonb para um gesto que quase sempre termina na pergunta seguinte, e faria o
 * leitor de um link compartilhado editar o texto de quem o escreveu. Quem quer
 * a troca PERMANENTE tem os dois caminhos que gravam: o editor (esta citação,
 * para sempre) e o /profile (todas as que não escolheram).
 *
 * É por isso que o estado é local e morre com a página. A tela não anuncia
 * isso: o gesto é reversível no mesmo lugar em que foi feito, e um aviso de
 * "não salvamos" em cada versículo seria ruído sobre a leitura.
 *
 ## São DUAS pastilhas, e não uma
 *
 * A referência e a tradução já foram o mesmo botão, e estava errado: a
 * referência é o NOME da citação e não se troca na leitura (quem a escolheu foi
 * quem escreveu o texto), enquanto a tradução é um controle. Juntas, o alvo
 * dizia "João 3:16" e fazia outra coisa, e no editor as duas são pastilhas
 * separadas, cada uma trocando a sua metade. Aqui elas seguem o mesmo par: a
 * referência volta a ser rótulo, a tradução é o gatilho.
 *
 * A sigla na segunda é também o crédito que a licença da Bíblia Livre exige em
 * espaço curto (ver `lib/bibles/translations.ts`).
 */
export function BibleQuoteBlock({
  reference,
  bookDisplay,
  chapter,
  startVerse,
  endVerse,
  blockTranslation,
}: {
  reference: string;
  bookDisplay: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  blockTranslation?: TranslationId;
}) {
  const resolved = useResolvedTranslation(blockTranslation);
  const [chosen, setChosen] = useState<TranslationId | null>(null);
  const translation = chosen ?? resolved;

  return (
    <figure className="relative flex flex-col gap-3.5 rounded-[26px] p-6 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]">
      {/* `flex-wrap` porque no celular "1 Coríntios 13:1-13" já ocupa a linha
          inteira, e a segunda pastilha desce em vez de espremer a primeira. */}
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-2 veil-chip rounded-full px-4 py-1.5 text-xs font-medium">
          <BookGlyph className="size-3" />
          {reference}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex shrink-0 items-center gap-1.5 veil-chip rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={`Tradução desta passagem: ${TRANSLATIONS[translation].name}. Trocar.`}
            title="Trocar a tradução desta passagem"
          >
            {TRANSLATIONS[translation].short}
            <ChevronDown aria-hidden className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {SELECTABLE_TRANSLATIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => setChosen(option.id)}
                className="items-start gap-2.5"
              >
                <Check
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-3.5 flex-none",
                    option.id === translation ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{option.name}</span>
                  <span className="text-xs font-light leading-snug text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </figcaption>
      <div className="text-[17px] font-light leading-relaxed text-session-verse-text">
        <PassageVerses
          bookDisplay={bookDisplay}
          chapter={chapter}
          startVerse={startVerse}
          endVerse={endVerse}
          translation={translation}
        />
      </div>
    </figure>
  );
}
