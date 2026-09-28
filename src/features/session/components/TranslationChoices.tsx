"use client";

import { Check } from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SELECTABLE_TRANSLATIONS, type TranslationId } from "@/lib/bibles/translations";
import { cn } from "@/lib/utils";

/**
 * A LISTA de traduções escolhíveis, com o nome e a linha do que se ganha em
 * cada uma. É só o conteúdo da gaveta: quem desenha o gatilho é cada tela, que
 * o veste do jeito dela (pastilha no cartão de citação, sigla discreta na
 * lateral da Bíblia, texto do subtítulo no diálogo de capítulo).
 *
 * Existe porque a MESMA lista já estava escrita em três lugares, e a terceira
 * cópia nasceu junto com o diálogo de capítulo. Uma tradução nova, ou uma
 * mudança no `hint`, teria de ser lembrada nos três; o gatilho é que muda de
 * tela para tela, o cardápio não.
 */
export function TranslationChoices({
  value,
  onChange,
  align = "start",
}: {
  value: TranslationId;
  onChange: (id: TranslationId) => void;
  align?: "start" | "end" | "center";
}) {
  return (
    <DropdownMenuContent align={align} className="w-72">
      {SELECTABLE_TRANSLATIONS.map((option) => (
        <DropdownMenuItem
          key={option.id}
          onClick={() => onChange(option.id)}
          className="items-start gap-2.5"
        >
          <Check
            aria-hidden
            className={cn(
              "mt-0.5 size-3.5 flex-none",
              option.id === value ? "opacity-100" : "opacity-0"
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
  );
}
