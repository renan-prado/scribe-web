import { cn } from "@/lib/utils";

/**
 * O glifo de "escrever": a caneta do `public/icons/write.svg`, embutida como
 * componente para herdar `currentColor` (um `<img src>` não herdaria).
 *
 * Substitui o `PenLine` do lucide-react nos dois lugares que marcam o modo
 * `manual` — o chip "Escrever resumo" da `TopBar` e o glifo de modo dos
 * cartões da Biblioteca — para os dois usarem o MESMO desenho de caneta que
 * o resto do produto (ver `public/icons/edit.svg`, o par dela para "editar").
 */
export function WriteGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="m14.46 3.26.88-.88c1.04-1.04 2.85-1.04 3.89 0l.71.71c.52.52.81 1.21.81 1.94s-.29 1.43-.81 1.94l-.88.88-4.6-4.6zm-1.06 1.06-9.11 9.11c-.29.29-.47.67-.5 1.08l-.27 2.93c-.03.37.1.73.36 1 .24.24.55.37.88.37h.11l2.93-.27c.41-.04.79-.22 1.08-.51l9.11-9.11-4.6-4.6zm9.35 17.68c0-.41-.34-.75-.75-.75h-20c-.41 0-.75.34-.75.75s.34.75.75.75h20c.41 0 .75-.34.75-.75z" />
    </svg>
  );
}
