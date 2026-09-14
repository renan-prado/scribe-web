import { MicGlyph } from "@/components/icons/MicGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import type { SessionListItem } from "@/lib/db/sessions";
import { shortDate } from "../lib/formatting";
import { PostItNote } from "./PostItNote";

/**
 * O post-it de uma SESSÃO salva, o cartão da Biblioteca. É o `<li>` inteiro:
 * quem o usa põe o `<ul>`.
 *
 * Ele é o recheio; a casca — cor, cartão clicável, véu do toque, anatomia —
 * mora no `PostItNote`, que os Estudos usam com outro recheio. Aqui ficou só
 * o que é de uma gravação.
 *
 * ## Ele SUBSTITUIU o `SessionCard`, não o veste
 *
 * O cartão anterior era o do app antigo: pintado em `--scriba-*`, dependendo da
 * classe `dark` do `(app)/layout.tsx` para não pousar branco sobre a página, e
 * com dois cabeçalhos (`mode` e `speaker`) porque duas telas o usavam. Quando
 * `/recordings` virou redirect ele ficou com UM consumidor, e um post-it de
 * autor/título/data não é aquele cartão com menos coisas — é outro cartão. Um
 * `variant="postit"` teria mantido vivos o rodapé, as pastilhas e a paleta
 * velha atrás de um `if`, para nunca mais serem renderizados.
 *
 * **O autor abre o cartão, acima do título**: numa lista de sermões se procura
 * pelo pregador tanto quanto pelo tema. Sem autor a linha simplesmente não
 * existe — um avatar "?" seria um rosto inventado para ninguém.
 *
 * **O menu de três pontinhos SAIU do cartão.** Ele ocupava o canto superior
 * direito, que numa coluna de ~150px é onde o título quebra, e trocava duas
 * linhas de título por um atalho para Editar e Remover — as duas coisas que o
 * menu do `/summary` já oferece, na tela em que a pessoa está olhando o que
 * vai editar ou apagar. Com ele foram o `SessionCardMenu`, a Server Action de
 * apagar da `/home` e o `deleteAction` que descia página adentro.
 *
 * **O MODO é a quarta coisa**, e ele fica no rodapé, à esquerda da data:
 * microfone para o que foi gravado, o play para o que veio do YouTube, no tom
 * apagado da própria data — informação passiva, não pastilha. Marcar só o
 * YouTube, como foi feito primeiro, era marcar a EXCEÇÃO: o cartão sem glifo
 * não dizia "gravado", dizia "não é YouTube", que é uma ausência, e ausência
 * não se lê.
 */
type Props = {
  session: SessionListItem;
  /** "Agora" vem de fora, do servidor: um `new Date()` no cliente pode cair do
   * outro lado da virada do ano em relação ao HTML e derrubar a hidratação da
   * página inteira por causa de um "2025" a mais na data. */
  now: Date;
  /** Para onde o cartão aponta. Toda sessão salva abre no resumo; quem passa a
   * função é quem sabe o prefixo da rota. */
  buildHref?: (id: string) => string;
};

export function LibraryNote({ session: s, now, buildHref = (id) => `/summary/${id}` }: Props) {
  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
  const href = buildHref(s.id);

  return (
    <PostItNote
      colorKey={s.id}
      href={href}
      eyebrow={s.speakerName?.trim() || null}
      title={s.title?.trim() || "Sessão sem título"}
      footer={
        <>
          {/* O rótulo mora no `<span>`, não no `<svg>`: o `YoutubeIcon` já
              nasce `aria-hidden` e não aceita props soltas, e um `<svg>` com
              `aria-label` sem `role="img"` é silenciado por boa parte dos
              leitores de tela. Com o wrapper, os dois glifos são anunciados do
              mesmo jeito. */}
          <span
            role="img"
            aria-label={
              s.mode === "youtube" ? "Importada de um vídeo do YouTube" : "Gravada pelo microfone"
            }
            className="flex shrink-0"
          >
            {/* O ACERTO DE ALTURA é de cada glifo, e os dois números são
                diferentes de propósito.

                O problema comum: `items-center` alinha o ícone pela CAIXA da
                linha, e a caixa de "8 set" tem embaixo um vão de descida que
                nenhuma daquelas letras usa — centrado por ela, o glifo cai
                abaixo do miolo do texto. `translate` e não margem: com
                `items-center` a margem negativa desloca só metade do que se
                pede.

                A diferença entre os dois é ÓPTICA, não geométrica: as duas
                tintas são centradas no próprio `viewBox` (medido), mas o
                YouTube é um retângulo cheio, com aresta reta em cima e
                embaixo, e o microfone é uma cápsula estreita com um pé. Subir
                os dois 1,5px deixava o retângulo visivelmente alto enquanto a
                cápsula caía certa. Medido no print: a 1,5px o miolo do glifo
                do YouTube ficava ~1,1px acima do miolo dos dígitos. */}
            {s.mode === "youtube" ? (
              <YoutubeIcon className="size-3.5 -translate-y-[0.5px]" />
            ) : (
              /* O `MicGlyph`, o MESMO microfone do botão de gravar, e não o
                 `Mic` do lucide: o glifo que a pessoa aperta para gravar e o
                 que marca o resultado daquele gesto na lista têm de ser o mesmo
                 desenho, senão a Biblioteca fala de uma gravação com o
                 vocabulário de outro app. Ele é preenchido, como o do YouTube
                 ao lado, e ocupa 23 de 32 na altura — quase a mesma extensão
                 vertical do vizinho, que é o que mantém a coluna de ícones
                 alinhada. */
              <MicGlyph className="size-3.5 -translate-y-[1.5px]" />
            )}
          </span>
          {shortDate(s.createdAt, includeYear)}
        </>
      }
    />
  );
}
