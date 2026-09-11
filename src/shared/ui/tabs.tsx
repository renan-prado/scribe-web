"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

/**
 * Abas com os tokens do Scriba: pílulas sobre a superfície recuada, e a
 * selecionada invertida, tinta no fundo e papel no texto.
 *
 * A navegação por teclado (setas, Home/End, roving tabindex) e a amarração
 * `aria-controls`/`aria-labelledby` vêm do base-ui. É a razão de existir este
 * wrapper em vez de três `<button>` com `useState`: essa parte é fácil de
 * escrever errado e difícil de perceber que está errada.
 *
 * `keepMounted` fica no padrão (falso): os painéis inativos saem do DOM, então
 * o conteúdo escondido não conta para o leitor de tela nem para o Ctrl+F.
 */

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-scriba-surface p-1",
        className
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "relative z-10 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12.5px] font-medium text-scriba-ink-soft outline-none transition-colors",
        "hover:text-scriba-ink-strong focus-visible:ring-3 focus-visible:ring-ring/50",
        // **A aba ativa INVERTE.** Ela já foi `--scriba-paper` sobre
        // `--scriba-surface`, o que dá 1,04:1 no tema claro e 1,05:1 no escuro:
        // a pílula era praticamente do tom do trilho, e quem a desenhava era
        // uma sombra azulada da paleta antiga, quase invisível no claro e
        // completamente invisível no escuro. Um anel de `--scriba-hairline`
        // melhorou pouco (1,2:1) e continuou pedindo atenção do leitor para
        // achar onde ele está.
        //
        // O que resolve é trocar a FIGURA pelo FUNDO: a selecionada pinta com
        // a cor da tinta e escreve com a cor do papel, os dois tokens que já
        // invertem sozinhos entre os temas. Dá ~17:1 contra o trilho nos dois,
        // em vez de 1,05:1, e a aba ativa passa a ser a única coisa escura (ou
        // clara, no escuro) da fileira. É o mesmo desenho do botão primário, e
        // é de propósito: "onde eu estou" merece o mesmo peso de "o que eu
        // aperto".
        "data-[active]:bg-scriba-ink-strong data-[active]:text-scriba-paper",
        "data-[active]:shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
        className
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("flex flex-col gap-4 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsPanel, TabsTab };
