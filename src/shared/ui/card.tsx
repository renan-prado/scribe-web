import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * O `Card` do shadcn, na forma do bloco `dashboard-01`.
 *
 * Chegou tarde ao repositório: até aqui todo cartão do admin era uma `<div>`
 * com `rounded-2xl border border-scriba-hairline-soft bg-scriba-paper` escrita
 * à mão em cada tela. Isso funcionava, mas deixava três coisas de fora que o
 * bloco do shadcn pressupõe e que a estética dele depende:
 *
 * 1. **`data-slot="card"`**, que é como o pai pinta os filhos sem saber quem
 *    eles são. O gradiente dos KPIs não mora no cartão, mora na GRADE, como
 *    `*:data-[slot=card]:bg-gradient-to-t` (ver `KpiGrid`). Sem o atributo o
 *    seletor não casa e a grade inteira fica chapada.
 * 2. **`CardAction`**, que só existe por causa do `grid-cols-[1fr_auto]` que o
 *    `CardHeader` liga sozinho quando encontra um filho com esse slot. É o que
 *    coloca a pastilha de tendência à direita SEM tirar o título do fluxo.
 * 3. **`bg-card`, e não `bg-scriba-paper`.** Os dois valem o mesmo hoje, mas
 *    o gradiente termina em `to-card`: escrever a superfície com um token e o
 *    fim do gradiente com outro é como as duas metades se desencontram no dia
 *    em que um deles mudar.
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Só funciona dentro de um `CardHeader`: é ele que abre a segunda coluna. */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
