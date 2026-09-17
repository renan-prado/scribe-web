"use client";

import { Check, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * O "+" que leva um pedaço da conversa para o resumo.
 *
 * ## Ele é o terceiro caminho para dentro do texto, e o mais direto
 *
 * Os outros dois passam pelo modelo: a `suggestion` (ele escolhe o bloco) e a
 * `offer` (ele oferece escrever). Este não passa por ninguém — a passagem já
 * está na tela, o trecho já está selecionado, e o que falta é só um lugar para
 * pôr. Uma conversa em que se acha um material bom e não há como guardá-lo é
 * uma conversa que termina em copiar e colar, e é exatamente o que separa o
 * Biblo de um chat numa aba.
 *
 * ## Por que ícone com tooltip, e não um botão com rótulo
 *
 * Ele fica no canto de um cartão dentro de um balão de conversa: um rótulo
 * ("Adicionar ao resumo") ali é mais largo que a pastilha da referência ao
 * lado, e passa a competir com o versículo, que é o conteúdo. O `+` é o mesmo
 * glifo do menu de blocos do editor e do `CreateDock` — quem já usou o editor
 * sabe o que ele faz antes de parar o cursor em cima.
 *
 * ## Ele ALTERNA, e é por isso que guarda estado
 *
 * Adicionado, vira um "✓" que desfaz. Sem isso não há como voltar atrás sem
 * abrir o editor e procurar o bloco, e a pessoa que tocou por engano paga o
 * engano com uma caça ao texto. Quem desfaz de verdade é o consumidor, que
 * apaga a ÚLTIMA ocorrência igual — ver `BibloSummaryDock`.
 */
export function BibloAddButton({
  added,
  onToggle,
  label = "Adicionar ao resumo",
  className,
}: {
  added: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}) {
  return (
    // `delay` curto pelo mesmo motivo do `CreateActions`: o nome do ícone é
    // informação que se pede com o cursor já parado em cima. O `Provider` mora
    // aqui porque o base-ui só o aceita nele, e não no `Root`.
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onToggle}
              aria-label={added ? "Remover do resumo" : label}
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute",
                added
                  ? "bg-scriba-hairline text-scriba-ink"
                  : "text-scriba-ink-soft hover:bg-scriba-hairline/60 hover:text-scriba-ink",
                className
              )}
            />
          }
        >
          {added ? (
            <Check aria-hidden className="size-4" strokeWidth={2} />
          ) : (
            <Plus aria-hidden className="size-4" strokeWidth={2} />
          )}
        </TooltipTrigger>
        <TooltipContent>{added ? "Remover do resumo" : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
