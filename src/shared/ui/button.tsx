import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // O botão primário do produto. É o MESMO par de tokens da landing e do
        // "Gerar estudo" — ver `src/shared/AGENTS.md` §"O botão primário".
        // Era `bg-primary`, que é o preto neutro que veio do shadcn: como esta
        // é a variante PADRÃO, todo `<Button>` sem `variant` (o admin inteiro,
        // o /404) desenhava um botão preto que não pertence à paleta. O hover
        // vem da classe `.scriba-cta` (um `filter`), porque o fundo é gradiente
        // e um `hover:bg-*` o chaparia.
        default:
          "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)]",
        outline:
          "border-scriba-hairline bg-scriba-paper text-scriba-ink hover:bg-scriba-btn-muted hover:text-scriba-ink-strong aria-expanded:bg-scriba-btn-muted aria-expanded:text-scriba-ink-strong",
        secondary:
          "bg-scriba-btn-muted text-scriba-ink hover:bg-scriba-btn-muted-hover hover:text-scriba-ink-strong aria-expanded:bg-scriba-btn-muted-hover aria-expanded:text-scriba-ink-strong",
        ghost:
          "text-scriba-ink-soft hover:bg-scriba-btn-muted hover:text-scriba-ink-strong aria-expanded:bg-scriba-btn-muted aria-expanded:text-scriba-ink-strong",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-scriba-blue-ink underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
