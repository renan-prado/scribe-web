import { cn } from "@/lib/utils";

/**
 * A pena — a marca do Scriba.
 *
 * Este arquivo é o ÚNICO lugar do código onde o `<path>` da pena existe. Antes
 * dele o mesmo desenho estava copiado inline em sete componentes, e o resultado
 * foi previsível: a aplicação inteira ficou com uma pena antiga (o traço de
 * 155×155) enquanto os favicons já usavam outra. Trocar a marca virou uma
 * caçada. Se precisar da pena em algum lugar novo, importe daqui — não cole o
 * path de novo.
 *
 * O desenho é o mesmo de `public/brand/pena.svg`, que existe para os consumos
 * de FORA do React (favicon, manifest, dados estruturados). Os dois precisam
 * andar juntos quando a marca mudar.
 *
 * Pinta com `currentColor`: a cor desce do container por herança, o que deixa a
 * mesma pena servir o header (tinta), o CTA azul (branco) e o botão amarelo
 * (âmbar) sem gerar um asset por cor.
 */
export function ScribaMark({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      {...(size ? { width: size, height: size } : null)}
      viewBox="0 0 166 166"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", !size && "size-4", className)}
    >
      <path
        d="M121.042 51.8749C127.958 44.9583 134.875 34.5833 145.25 13.8333C41.5 13.8333 27.6667 110.667 20.75 152.167H34.5833C39.425 129.342 50.4917 116.2 69.1667 114.125C96.8333 110.667 117.583 86.4583 124.5 65.7083L114.125 58.7916L121.042 51.8749Z"
        fill="currentColor"
      />
    </svg>
  );
}
