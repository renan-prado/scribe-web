"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 dark:bg-black/55 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Layout de três faixas: `DialogHeader` e `DialogFooter` ficam fixos e SÓ o
 * miolo rola. Os dois são içados para fora da área rolável — basta declará-los
 * como filhos do `DialogContent`, na ordem que fizer sentido ler.
 *
 * O popup, portanto, não rola; quem rola é a div do meio (`dialog-body`). Além
 * de manter título e ações sempre à vista, isso tira o scrollbar de cima da
 * borda arredondada: o corpo leva `mx-2` (e `mt/mb-2` quando encosta na borda),
 * e é essa margem — não um padding do popup — que afasta a barra do canto. O
 * padding do corpo completa os 16px de respiro de sempre.
 *
 * A folga só existe onde há borda de dialog: na emenda com header ou footer
 * não há canto arredondado, então ali entra padding cheio (`pt-4`/`pb-4`) e o
 * vão entre as faixas continua sendo os mesmos 16px. Por isso o popup não tem
 * padding nenhum — as três faixas cuidam do próprio respiro, e a faixa do
 * footer sangra até as bordas sem precisar de margem negativa.
 *
 * `className` veste o popup (largura, raio, fundo); `bodyClassName` veste a
 * área rolável (layout e padding do conteúdo).
 */
function DialogContent({
  className,
  bodyClassName,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  bodyClassName?: string;
}) {
  const items = React.Children.toArray(children);
  const isSlot = (slot: React.ElementType) => (child: React.ReactNode) =>
    React.isValidElement(child) && child.type === slot;
  const isHeader = isSlot(DialogHeader);
  const isFooter = isSlot(DialogFooter);
  const header = items.filter(isHeader);
  const footer = items.filter(isFooter);
  const body = items.filter((child) => !isHeader(child) && !isFooter(child));
  const hasHeader = header.length > 0;
  const hasFooter = footer.length > 0;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {header}
        {body.length > 0 ? (
          <div
            data-slot="dialog-body"
            className={cn(
              "mx-2 grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-2",
              hasHeader ? "pt-4" : "mt-2 pt-2",
              hasFooter ? "pb-4" : "mb-2 pb-2",
              bodyClassName
            )}
          >
            {body}
          </div>
        ) : hasHeader && hasFooter ? (
          // Sem miolo (um confirm, por exemplo) as duas faixas se encostariam.
          <div aria-hidden className="h-4" />
        ) : null}
        {footer}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/** Faixa fixa do topo — `DialogContent` a iça para fora da área rolável. Leva o
 *  padding cheio porque o popup não tem nenhum; o vão até o conteúdo fica por
 *  conta do `pt-4` do corpo. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 px-4 pt-4", className)}
      {...props}
    />
  );
}

/**
 * Faixa fixa da base, também içada para fora da área rolável.
 *
 * `band` (padrão) é a barra de ações cinza que sangra até as bordas do dialog.
 * `plain` é só o rodapé sobre a mesma superfície, para quando a ação é um
 * botão só e uma barra cinza pesaria (ver o diálogo de nova gravação).
 */
function DialogFooter({
  className,
  variant = "band",
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
  variant?: "band" | "plain";
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex gap-2",
        variant === "band"
          ? "flex-col-reverse rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end"
          : "flex-col px-4 pb-4",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
