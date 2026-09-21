import type { SessionListItem } from "@/lib/domain/session";
import { shortDate } from "../lib/formatting";
import { PostItNote } from "./PostItNote";
import { SessionModeGlyph } from "./SessionModeGlyph";

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
 * **O MODO é a quarta coisa**, e ele fica no rodapé, à esquerda da data, no
 * tom apagado da própria data — informação passiva, não pastilha. O desenho
 * dele (e os acertos ópticos de cada glifo) mora no `SessionModeGlyph`, porque
 * as três vistas da Biblioteca o usam.
 *
 * **As outras duas vistas são a LINHA e o CARTÃO** (`LibraryRow`,
 * `LibraryCard`), e elas não são este cartão com um `variant`: o post-it é cor
 * sorteada, altura livre e ordem coluna-a-coluna, e as outras duas existem
 * justamente para não ter nada disso. Ver `library-view.ts`.
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
          <SessionModeGlyph mode={s.mode} />
          {shortDate(s.createdAt, includeYear)}
        </>
      }
    />
  );
}
