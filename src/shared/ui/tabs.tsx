"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

/**
 * Abas com os tokens do Scriba: pílula clara sobre a superfície recuada, a
 * selecionada subindo para o papel.
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
        "data-[active]:bg-scriba-paper data-[active]:text-scriba-ink-strong data-[active]:shadow-[0_1px_4px_rgba(51,65,79,0.10)]",
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
