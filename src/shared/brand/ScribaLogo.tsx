import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand/ScribaMark";

type ScribaLogoProps = {
  /** Lado da pena em px. O texto acompanha por `textClassName`. */
  size?: number;
  textClassName?: string;
  /** Rótulo secundário sob a palavra — hoje só o "Admin" da sidebar. */
  subtitle?: string;
  className?: string;
};

/**
 * O logotipo: pena + a palavra "scriba" em Poppins.
 *
 * Duas regras que já custaram correção e não devem se perder de novo:
 *
 * 1. É marcado como UMA imagem (`role="img"`), não como um ícone decorativo ao
 *    lado de um texto solto. O leitor de tela anuncia "Scriba" uma vez, em vez
 *    do SVG seguido de uma palavra órfã em minúscula.
 *
 * 2. A cor sai do CONTAINER e desce por herança para os dois: o `<path>` pinta
 *    com `currentColor` e a palavra herda o `color`. Pena e palavra são uma
 *    marca só — dar classe de cor própria a um dos dois é exatamente o que os
 *    desencontra (ver o commit "pena e palavra do logo voltam a ter a mesma
 *    cor"). Quem chama define a cor no elemento de fora.
 */
export function ScribaLogo({
  size = 26,
  textClassName = "text-[22px]",
  subtitle,
  className,
}: ScribaLogoProps) {
  return (
    <span
      role="img"
      aria-label={subtitle ? `Scriba ${subtitle}` : "Scriba"}
      className={cn("flex items-center gap-1", className)}
    >
      <ScribaMark size={size} />
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span
          className={cn("font-semibold leading-none", textClassName)}
          style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
        >
          scriba
        </span>
        {subtitle ? (
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[.14em] opacity-70">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
