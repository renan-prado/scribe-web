import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand/ScribaMark";

type ScribaLogoProps = {
  /** Lado da pena em px. O texto acompanha por `textClassName`. */
  size?: number;
  textClassName?: string;
  /** Rótulo secundário sob a palavra — hoje só o "Admin" da sidebar. */
  subtitle?: string;
  /**
   * `gradient` (padrão) pinta pena e palavra com `--scriba-cta`, o mesmo
   * gradiente do botão primário. `ink` volta a herdar o `color` do container —
   * use quando o logotipo tiver de assumir a cor de onde está.
   */
  variant?: "gradient" | "ink";
  className?: string;
};

/** Folga entre a pena e a palavra, em px. Precisa bater com o `gap-1` abaixo. */
const GAP = 4;

/**
 * O logotipo: pena + a palavra "scriba" em Poppins.
 *
 * Três regras que já custaram correção e não devem se perder de novo:
 *
 * 1. É marcado como UMA imagem (`role="img"`), não como um ícone decorativo ao
 *    lado de um texto solto. O leitor de tela anuncia "Scriba" uma vez, em vez
 *    do SVG seguido de uma palavra órfã em minúscula.
 *
 * 2. Pena e palavra recebem SEMPRE o mesmo tratamento. Pintar uma das metades
 *    sozinha é o que as desencontra — ver o commit "pena e palavra do logo
 *    voltam a ter a mesma cor".
 *
 * 3. No modo gradiente, o degradê é UM só atravessando o logotipo inteiro, não
 *    um por metade. Isso não sai de graça: são dois elementos (a palavra usa
 *    `background-clip: text`, a pena usa máscara — gradiente de CSS não entra
 *    em `fill` de SVG), e cada um pintaria o próprio degradê do começo, o que
 *    deixa a pena escura ao lado de uma palavra clara. A correção é dar aos
 *    dois a MESMA caixa de fundo (`backgroundSize`) e deslocar a da palavra
 *    para a esquerda pela largura que a pena já ocupou. Mexer no `gap` sem
 *    mexer no `GAP` daqui quebra o alinhamento.
 *
 * O WCAG 1.4.3 isenta nome de marca de contraste, mas isso aqui não depende da
 * isenção: as duas pontas do gradiente dão 4,73:1 e 6,73:1 sobre o papel.
 */
export function ScribaLogo({
  size = 26,
  textClassName = "text-[22px]",
  subtitle,
  variant = "gradient",
  className,
}: ScribaLogoProps) {
  const grad = variant === "gradient";
  // Largura de referência do degradê. Não precisa ser a largura exata do
  // logotipo — precisa ser a MESMA nas duas metades, e larga o bastante para
  // cobrir o conjunto. ~4x a pena cobre "pena + scriba" em todos os tamanhos
  // em uso (17px a 28px).
  const sweep = size * 4;
  const band = { backgroundImage: "var(--scriba-cta)", backgroundSize: `${sweep}px ${size}px` };

  return (
    <span
      role="img"
      aria-label={subtitle ? `Scriba ${subtitle}` : "Scriba"}
      className={cn("flex items-center gap-1", className)}
    >
      {grad ? (
        <span
          aria-hidden="true"
          className="scriba-mark-gradient block shrink-0"
          style={{ ...band, backgroundPosition: "0 center", width: size, height: size }}
        />
      ) : (
        <ScribaMark size={size} />
      )}
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold leading-none",
            grad && "bg-clip-text text-transparent",
            textClassName
          )}
          style={{
            fontFamily: "var(--font-poppins)",
            letterSpacing: "-0.015em",
            ...(grad ? { ...band, backgroundPosition: `-${size + GAP}px center` } : null),
          }}
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
