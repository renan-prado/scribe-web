import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";

/**
 * O POST-IT: a casca do cartão da Biblioteca, hoje o único mural do app.
 *
 * Ela guarda a cor sorteada, o cartão inteiro clicável, o véu do toque, o
 * anel de foco, e deixa o CONTEÚDO para quem a usa (`LibraryNote`).
 *
 * **Ela nasceu para servir DOIS murais**, a Biblioteca e os Estudos, e o
 * `StudyNote` que punha um estudo nela saiu junto quando o modo estudo saiu do
 * produto. A casca ficou separada do conteúdo mesmo com um caller só: um
 * `variant` aqui traria de volta o `if` que o `SessionCard` tinha, com dois
 * conteúdos vivos no mesmo arquivo, e o "stretched link" — `::after` +
 * `static` + `z-10` afinados entre si — é o tipo de detalhe que uma segunda
 * cópia deixa de acompanhar no primeiro ajuste, e um cartão para de ser
 * clicável sem ninguém perceber.
 *
 * ## A anatomia, e por que ela é essa
 *
 * **Três informações, e nada mais: a moldura, o título, a data.** Saíram, do
 * cartão antigo de cada lista, o resumo curto, a duração, o local, as
 * pastilhas e o botão "Ver →" (o cartão inteiro já é o link). Numa coluna de
 * ~150px cada linha a mais é uma linha que empurra a data para fora do
 * primeiro olhar.
 *
 * O `hint` é a exceção, e é uma linha que só existe DURANTE a busca: quando o
 * que casou está na transcrição ou num versículo, o cartão não mostra nada que
 * explique por que ele está ali. Sem filtro ligado, ninguém o vê.
 *
 * ## A cor vem do ID, nunca da posição
 *
 * `noteOf` faz um hash do `colorKey` e escolhe uma das quatro cores. Pela
 * POSIÇÃO na lista seria uma linha mais curta e estaria errado: gravar um
 * sermão novo empurra todos os outros um degrau, e o acervo inteiro se
 * repinta — o cartão amarelo de ontem é verde hoje. Cor de post-it é memória
 * visual, e instável ela é só ruído. Pelo id, ela nasce com a sessão e morre
 * com ela.
 *
 * O hash é determinístico e sem `Math.random()`/`Date`, então servidor e
 * cliente chegam à mesma cor e a hidratação não tem o que divergir.
 *
 * Cada cor traz o próprio par de tinta porque uma das quatro é ESCURA (ver o
 * bloco `--v2-note-*` em `globals.css`). E só a escura leva o fio de luz na
 * borda: contra o fundo da página ela dá 1,25:1 e, sem o fio, lê como um
 * buraco na lista em vez de cartão. Nos três claros o mesmo fio seria sujeira,
 * eles já se separam do fundo pela própria cor.
 *
 * Não leva `"use client"`: sem estado e sem hook, vai para o bundle do cliente
 * só porque `LibraryBrowser`, que é client, o importa.
 */
type Props = {
  /** De onde sai a cor. É sempre o id da SESSÃO, ver o cabeçalho. */
  colorKey: string;
  href: string;
  /** A linha de cima, a moldura do título (o autor). Sem ela o título sobe
   *  para o topo sem trocar a anatomia do cartão. */
  eyebrow?: string | null;
  title: string;
  /** O rodapé, na tinta apagada do cartão: o glifo do modo e a data. */
  footer: ReactNode;
  /** A linha que explica um casamento invisível da busca. Ver o cabeçalho. */
  hint?: ReactNode;
  /** Arrastar o cartão até uma pasta (ver `folder-dnd.ts`), só a Biblioteca
   *  passa. No `<li>`, e não no link: o link é quem responde ao CLIQUE, e o
   *  arrastar é um gesto do cartão inteiro, os dois não competem porque o
   *  navegador só decide "isto é um arrastar" depois de o ponteiro se mover. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLLIElement>) => void;
};

/**
 * As quatro faces do post-it, cada uma com o próprio par de tinta. A ordem
 * aqui é a ordem do rodízio, e mexer nela repinta o acervo de todo mundo —
 * o índice sorteado é posição neste array.
 */
const NOTES = [
  {
    bg: "bg-v2-note-mist",
    ink: "text-v2-note-mist-ink",
    mute: "text-v2-note-mist-mute",
    ring: "",
  },
  {
    bg: "bg-v2-note-sage",
    ink: "text-v2-note-sage-ink",
    mute: "text-v2-note-sage-mute",
    ring: "",
  },
  {
    bg: "bg-v2-note-slate",
    ink: "text-v2-note-slate-ink",
    mute: "text-v2-note-slate-mute",
    // O fio de luz do cartão escuro, e só dele. Ver o cabeçalho.
    ring: "ring-1 ring-inset ring-white/10",
  },
  {
    bg: "bg-v2-note-lemon",
    ink: "text-v2-note-lemon-ink",
    mute: "text-v2-note-lemon-mute",
    ring: "",
  },
] as const;

/**
 * A cor de um cartão, estável para sempre porque sai do id dele.
 *
 * FNV-1a de 32 bits, que é curto e espalha bem strings parecidas — e os ids
 * daqui são UUIDs, que diferem em poucos caracteres. Somar os códigos daria
 * anagramas da mesma cor, e num acervo de UUIDs isso agrupa.
 */
function noteOf(id: string): (typeof NOTES)[number] {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return NOTES[Math.abs(hash) % NOTES.length];
}

export function PostItNote({
  colorKey,
  href,
  eyebrow,
  title,
  footer,
  hint,
  draggable,
  onDragStart,
}: Props) {
  const note = noteOf(colorKey);

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      // `break-inside-avoid` é o que impede o masonry de CSS (`columns-2`) de
      // cortar um cartão ao meio na virada da coluna. `mb-4` e não `gap`: entre
      // colunas o vão é do `gap`, mas o vão VERTICAL num contexto de colunas
      // sai da margem do próprio item — e os dois andam JUNTOS, senão o mural
      // fica com vão maior num eixo que no outro e as colunas deixam de
      // parecer o mesmo mural.
      className={`mb-4 break-inside-avoid rounded-2xl ${note.bg} ${note.ring}`}
    >
      {/* O CARTÃO É O LINK, um `<a>` em volta de tudo — e isso é o que sobrou
          quando o menu de três pontinhos saiu do post-it. Enquanto ele existia,
          o cartão inteiro era clicável por "stretched link" (o `::after` do
          link do título esticado até as bordas do `<li>`, com o menu por cima
          num `z-10`), porque botão dentro de link é HTML inválido e armadilha
          de teclado. Sem botão nenhum lá dentro, aquele arranjo era mecanismo
          sem a razão que o justificava: quatro classes afinadas entre si
          (`static`, `after:inset-0`, `group-hover:`, `z-10`) para fazer o que
          um `<a>` em volta faz sozinho.

          O retorno ao toque é um véu de PRETO por cima, igual nas quatro cores:
          um véu branco clarearia o cartão escuro e lavaria os três claros, e
          seriam quatro tratamentos onde basta um. `active:` no próprio link é o
          que dá retorno no celular, onde `hover:` é código morto (ver
          `src/shared/AGENTS.md`).

          O FOCO é `outline-current`, e a tinta do cartão desce até aqui
          (`note.ink` no próprio link) só para alimentá-lo: um anel de cor fixa
          some em três das quatro faces — branco nas claras, preto na escura —,
          e o teclado é justamente quem não tem outra pista de onde está. Com
          `currentColor` ele herda a tinta já calibrada contra aquele papel.

          `spinner="overlay"`: o véu de "carregando" cobre o cartão inteiro,
          que agora é o próprio link. */}
      <NavLink
        href={href}
        // O cartão é o caminho principal do app — a Biblioteca existe para ser
        // tocada — e o destino é justamente o conteúdo que a pessoa quer. O
        // `pointerdown` adianta a rota inteira; ver `NavLink`.
        prefetchOnPress
        spinner="overlay"
        contentClassName="flex min-w-0 flex-col"
        className={`flex flex-col rounded-2xl p-4 outline-none transition-colors hover:bg-black/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:bg-black/[0.12] ${note.ink}`}
      >
        {/* `gap-3` entre a moldura e o título, e não o respiro mínimo de antes:
            são DUAS informações de naturezas diferentes (quem pregou, sobre o
            quê), e coladas elas liam como uma linha de cabeçalho quebrada ao
            meio. O vão é o que diz que a segunda começa algo novo.

            `font-light` na moldura, o MESMO peso da data. Os dois já usavam a
            mesma tinta, mas peso diferente é cor diferente aos olhos: a moldura
            saía mais escura que a data sem que nenhum token dissesse isso. As
            duas linhas são o mesmo tipo de informação — o entorno do título — e
            por isso têm de pesar igual. */}
        {eyebrow ? (
          <span className={`mb-3 truncate text-[11px] font-light leading-none ${note.mute}`}>
            {eyebrow}
          </span>
        ) : null}
        {/* SEM BOLD. Num post-it o título é o próprio conteúdo, não a manchete
            de um bloco com resumo embaixo: o peso regular é o que faz a lista
            parecer um mural de anotações em vez de uma lista de resultados.

            **E o TAMANHO é quem faz a hierarquia no lugar do peso.** Sem
            negrito, 15px ficava no mesmo plano da moldura e da data, e o cartão
            lia como três linhas de metadado; a 17px o título volta a ser a
            coisa que se lê primeiro sem precisar engrossar.

            **Entrelinha 1,5, e não a apertada de manchete.** Numa coluna
            estreita um título quebra em três ou quatro linhas, e a 1,375 elas
            se colavam num bloco que se lê como parágrafo. O ar entre elas é o
            que devolve ao cartão a cara de anotação em vez de resultado de
            busca — mas 1,625 já era ar demais: o título se desmontava em linhas
            soltas que não liam como uma frase só. `text-pretty` evita a última
            linha com uma palavra só. */}
        <span
          className={`text-pretty text-[17px] font-normal leading-normal tracking-tight ${note.ink}`}
        >
          {title}
        </span>

        {hint ? (
          <span className={`mt-3 flex items-center gap-1.5 text-[11px] font-light ${note.mute}`}>
            {hint}
          </span>
        ) : null}

        {/* A data ANCORADA na base (`mt-auto`), com um respiro mínimo. No
            masonry os cartões de uma mesma faixa raramente têm a mesma altura,
            e uma data que flutua logo abaixo do título faz cada cartão terminar
            num lugar diferente. Presa embaixo, ela vira a linha de base do
            mural. */}
        <span
          className={`mt-6 inline-flex items-center gap-1.5 text-[11px] font-light ${note.mute}`}
        >
          {footer}
        </span>
      </NavLink>
    </li>
  );
}
