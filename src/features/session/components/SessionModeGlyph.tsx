import { MicGlyph } from "@/components/icons/MicGlyph";
import { WriteGlyph } from "@/components/icons/WriteGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import type { SessionMode } from "@/lib/domain/session";

/**
 * O glifo do MODO de uma sessão: microfone para o gravado, play para o
 * importado, caneta para o escrito à mão.
 *
 * Ele vive num arquivo próprio porque as TRÊS vistas da Biblioteca o desenham
 * (o post-it, a linha e o cartão), e as três estavam a um copiar-colar de ter
 * três acertos ópticos diferentes para o mesmo ícone — que é o tipo de coisa
 * que ninguém percebe divergindo.
 *
 * **Marcar só o YouTube seria marcar a EXCEÇÃO**: o cartão sem glifo não diria
 * "gravado", diria "não é YouTube", que é uma ausência, e ausência não se lê.
 * Com três modos isso deixa de ser preferência e vira necessidade.
 *
 * ## Os acertos de altura são de cada glifo, e diferentes de propósito
 *
 * `items-center` alinha o ícone pela CAIXA da linha, e a caixa de "8 set" tem
 * embaixo um vão de descida que nenhuma daquelas letras usa: centrado por ela,
 * o glifo cai abaixo do miolo do texto. `translate` e não margem, porque com
 * `items-center` a margem negativa desloca só metade do que se pede.
 *
 * A diferença entre os três é ÓPTICA, não geométrica: as tintas são centradas
 * no próprio `viewBox` (medido), mas o YouTube é um retângulo cheio com aresta
 * reta em cima e embaixo, e o microfone é uma cápsula estreita com um pé.
 * Subir os dois 1,5px deixava o retângulo visivelmente alto enquanto a cápsula
 * caía certa. Medido num print: a 1,5px o miolo do glifo do YouTube ficava
 * ~1,1px acima do miolo dos dígitos.
 *
 * A caneta (`WriteGlyph`, o `public/icons/write.svg`) é tinta cheia como os
 * outros dois, então não precisa de `strokeWidth` para compensar. A descida é
 * a do microfone, não a do YouTube: como ele, a caneta é uma diagonal
 * estreita, e não um retângulo de aresta reta.
 *
 * O rótulo mora no `<span>`, não no `<svg>`: o `YoutubeIcon` já nasce
 * `aria-hidden` e não aceita props soltas, e um `<svg>` com `aria-label` sem
 * `role="img"` é silenciado por boa parte dos leitores de tela. Com o wrapper,
 * os três glifos são anunciados do mesmo jeito.
 */
export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  audio: "Gravada pelo microfone",
  youtube: "Importada de um vídeo do YouTube",
  manual: "Escrita por você",
};

export function SessionModeGlyph({ mode }: { mode: SessionMode }) {
  return (
    <span role="img" aria-label={SESSION_MODE_LABELS[mode]} className="flex shrink-0">
      {mode === "youtube" ? (
        <YoutubeIcon className="size-3.5 -translate-y-[0.5px]" />
      ) : mode === "manual" ? (
        <WriteGlyph className="-translate-y-[1.5px] size-3.5" />
      ) : (
        /* O `MicGlyph`, o MESMO microfone do botão de gravar, e não o `Mic` do
           lucide: o glifo que a pessoa aperta para gravar e o que marca o
           resultado daquele gesto na lista têm de ser o mesmo desenho, senão a
           Biblioteca fala de uma gravação com o vocabulário de outro app. */
        <MicGlyph className="size-3.5 -translate-y-[1.5px]" />
      )}
    </span>
  );
}
