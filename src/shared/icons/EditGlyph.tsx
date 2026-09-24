import { cn } from "@/lib/utils";

/**
 * O glifo de "editar": a folha com a caneta do `public/icons/edit.svg`,
 * embutida como componente para herdar `currentColor` (um `<img src>` não
 * herdaria).
 *
 * **É o par do [`WriteGlyph`](./WriteGlyph.tsx), e os dois não são
 * intercambiáveis:** a caneta sozinha é CRIAR um texto ("Escrever resumo"), a
 * caneta sobre a folha é MEXER num que já existe ("Editar"). Eles saíram
 * juntos do mesmo conjunto, e é o que os faz ler como uma família onde antes
 * havia dois traçados de lucide sem parentesco nenhum.
 *
 * Substitui o `PenLine`/`Pencil` do lucide em todo lugar do app em que o
 * assunto é editar um resumo: a barra de baixo da leitura no celular, o botão
 * "Editar" do cabeçalho, o item do menu de três pontinhos e o lápis que
 * aparece ao passar o mouse no título. O painel `/admin` continua com o
 * `Pencil` do lucide, que ali é a ação de uma linha de tabela e não este
 * assunto.
 *
 * O `viewBox` é o do arquivo (512x511, não 24x24): reescalar o path à mão
 * introduziria arredondamento onde não há ganho nenhum.
 */
export function EditGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 511"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="m405.332031 256.484375c-11.796875 0-21.332031 9.558594-21.332031 21.332031v170.667969c0 11.753906-9.558594 21.332031-21.332031 21.332031h-298.667969c-11.777344 0-21.332031-9.578125-21.332031-21.332031v-298.667969c0-11.753906 9.554687-21.332031 21.332031-21.332031h170.667969c11.796875 0 21.332031-9.558594 21.332031-21.332031 0-11.777344-9.535156-21.335938-21.332031-21.335938h-170.667969c-35.285156 0-64 28.714844-64 64v298.667969c0 35.285156 28.714844 64 64 64h298.667969c35.285156 0 64-28.714844 64-64v-170.667969c0-11.796875-9.539063-21.332031-21.335938-21.332031zm0 0" />
      <path d="m200.019531 237.050781c-1.492187 1.492188-2.496093 3.390625-2.921875 5.4375l-15.082031 75.4375c-.703125 3.496094.40625 7.101563 2.921875 9.640625 2.027344 2.027344 4.757812 3.113282 7.554688 3.113282.679687 0 1.386718-.0625 2.089843-.210938l75.414063-15.082031c2.089844-.429688 3.988281-1.429688 5.460937-2.925781l168.789063-168.789063-75.414063-75.410156zm0 0" />
      <path d="m496.382812 16.101562c-20.796874-20.800781-54.632812-20.800781-75.414062 0l-29.523438 29.523438 75.414063 75.414062 29.523437-29.527343c10.070313-10.046875 15.617188-23.445313 15.617188-37.695313s-5.546875-27.648437-15.617188-37.714844zm0 0" />
    </svg>
  );
}
