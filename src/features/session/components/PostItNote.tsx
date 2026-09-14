import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";

/**
 * O POST-IT: a casca dos cartões dos dois murais, a Biblioteca e os Estudos.
 *
 * Ela guarda o que é igual nos dois — a cor sorteada, o cartão inteiro
 * clicável, o véu do toque, o anel de foco — e deixa o CONTEÚDO para quem a
 * usa, porque é só nisso que os dois diferem: `LibraryNote` põe uma sessão
 * dentro, `StudyNote` põe um estudo.
 *
 * **Casca compartilhada, e não um `variant`.** A diferença entre os dois
 * cartões é o que entra em três buracos; um `variant` traria de volta o `if`
 * que o `SessionCard` tinha, com dois conteúdos vivos no mesmo arquivo. E
 * copiar a casca no segundo mural seria pior: o "stretched link" daqui é
 * `::after` + `static` + `z-10` afinados entre si, e duas cópias disso divergem
 * no primeiro ajuste — uma delas para de ser clicável e ninguém percebe.
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
 * **Os dois murais passam o MESMO id**, o da sessão: um estudo sai de um
 * sermão, e nas duas telas os dois saem com a mesma cor. Não é enfeite, é a
 * única pista de que aquele cartão verde dos Estudos é filho daquele cartão
 * verde da Biblioteca.
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
 * só porque as duas listas, que são client, o importam.
 */
type Props = {
  /** De onde sai a cor. É sempre o id da SESSÃO, ver o cabeçalho. */
  colorKey: string;
  href: string;
  /** A linha de cima, a moldura do título (o autor). Sem ela o título sobe
   *  para o topo sem trocar a anatomia do cartão. */
  eyebrow?: string | null;
  title: string;
  /** O rodapé, na tinta apagada do cartão: o glifo do modo e a data na
   *  Biblioteca, só a data nos Estudos. */
  footer: ReactNode;
  /** A linha que explica um casamento invisível da busca. Ver o cabeçalho. */
  hint?: ReactNode;
  /** O menu do canto. Ele fica ACIMA do véu do link, senão o véu o cobre e o
   *  menu deixa de abrir. */
  action?: ReactNode;
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

export function PostItNote({ colorKey, href, eyebrow, title, footer, hint, action }: Props) {
  const note = noteOf(colorKey);

  return (
    <li
      // `break-inside-avoid` é o que impede o masonry de CSS (`columns-2`) de
      // cortar um cartão ao meio na virada da coluna. `mb-4` e não `gap`: entre
      // colunas o vão é do `gap`, mas o vão VERTICAL num contexto de colunas
      // sai da margem do próprio item — e os dois andam JUNTOS, senão o mural
      // fica com vão maior num eixo que no outro e as colunas deixam de
      // parecer o mesmo mural.
      //
      // CARTÃO INTEIRO CLICÁVEL por "stretched link": quem carrega o destino é
      // o `<a>` do título, e é o `::after` dele que se estica até estas bordas.
      // Envolver o cartão num `<a>` seria mais simples e está errado: o menu de
      // contexto é um `<button>`, e botão dentro de link é HTML inválido e
      // armadilha de teclado. O `relative` daqui é o que dá ao `::after` uma
      // caixa para preencher.
      //
      // O retorno ao toque é um véu de PRETO por cima, igual nas quatro cores:
      // um véu branco clarearia o cartão escuro e lavaria os três claros, e
      // seriam quatro tratamentos onde basta um. `:active` alcança os
      // ancestrais do elemento acionado, é o que faz `group-active:` funcionar
      // a partir de um `<li>` e o que dá retorno no celular, onde `hover:` é
      // código morto (ver `src/shared/AGENTS.md`).
      className={`group relative mb-4 flex break-inside-avoid flex-col rounded-2xl p-4 ${note.bg} ${note.ring}`}
    >
      <div className="flex items-start gap-1">
        <NavLink
          href={href}
          spinner="overlay"
          // `gap-3` entre a moldura e o título, e não o respiro mínimo de
          // antes: são DUAS informações de naturezas diferentes (quem pregou,
          // sobre o quê), e coladas elas liam como uma linha de cabeçalho
          // quebrada ao meio. O vão é o que diz que a segunda começa algo novo.
          contentClassName="flex min-w-0 flex-col gap-3"
          // `static` derruba o `relative` que o `spinner="overlay"` põe no
          // link: sem isso o `::after` se mediria pelo próprio link e o alvo
          // pararia na linha do título. O `cn` do NavLink é tailwind-merge,
          // então a classe passada aqui vence a de lá. De brinde, o véu de
          // "carregando" do overlay passa a cobrir o cartão inteiro.
          //
          // O FOCO é `outline-current`, e a tinta do cartão desce até aqui
          // (`note.ink` no próprio link) só para alimentá-lo: um anel de cor
          // fixa some em três das quatro faces — branco nas claras, preto na
          // escura —, e o teclado é justamente quem não tem outra pista de onde
          // está. Com `currentColor` ele herda a tinta que já foi calibrada
          // contra aquele papel.
          className={`static flex min-w-0 flex-1 rounded-md outline-none after:absolute after:inset-0 after:rounded-2xl after:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current group-hover:after:bg-black/[0.06] group-active:after:bg-black/[0.12] ${note.ink}`}
        >
          {/* `font-light`, o MESMO peso da data. Os dois já usavam a mesma
              tinta, mas peso diferente é cor diferente aos olhos: a moldura
              saía mais escura que a data sem que nenhum token dissesse isso.
              As duas linhas são o mesmo tipo de informação — o entorno do
              título — e por isso têm de pesar igual. */}
          {eyebrow ? (
            <span className={`truncate text-[11px] font-light leading-none ${note.mute}`}>
              {eyebrow}
            </span>
          ) : null}
          {/* SEM BOLD. Num post-it o título é o próprio conteúdo, não a
              manchete de um bloco com resumo embaixo: o peso regular é o que
              faz a lista parecer um mural de anotações em vez de uma lista de
              resultados.

              **E o TAMANHO é quem faz a hierarquia no lugar do peso.** Sem
              negrito, 15px ficava no mesmo plano da moldura e da data, e o
              cartão lia como três linhas de metadado; a 17px o título volta a
              ser a coisa que se lê primeiro sem precisar engrossar.

              **Entrelinha 1,5, e não a apertada de manchete.** Numa coluna
              estreita um título quebra em três ou quatro linhas, e a 1,375 elas
              se colavam num bloco que se lê como parágrafo. O ar entre elas é o
              que devolve ao cartão a cara de anotação em vez de resultado de
              busca — mas 1,625 já era ar demais: o título se desmontava em
              linhas soltas que não liam como uma frase só. `text-pretty` evita
              a última linha com uma palavra só. */}
          <span
            className={`text-pretty text-[17px] font-normal leading-normal tracking-tight ${note.ink}`}
          >
            {title}
          </span>
        </NavLink>
        {action ? (
          // Acima do `::after` do link, senão o véu cobre o botão e o menu
          // deixa de abrir. `-mr-1 -mt-1` puxa o alvo de 32px para o canto sem
          // comer o padding do texto ao lado.
          <div className={`relative z-10 -mr-1 -mt-1 ${note.mute}`}>{action}</div>
        ) : null}
      </div>

      {hint ? (
        <span className={`mt-3 flex items-center gap-1.5 text-[11px] font-light ${note.mute}`}>
          {hint}
        </span>
      ) : null}

      {/* A data ANCORADA na base (`mt-auto`), com um respiro mínimo. No masonry
          os cartões de uma mesma faixa raramente têm a mesma altura, e uma data
          que flutua logo abaixo do título faz cada cartão terminar num lugar
          diferente. Presa embaixo, ela vira a linha de base do mural. */}
      <span className={`mt-6 inline-flex items-center gap-1.5 text-[11px] font-light ${note.mute}`}>
        {footer}
      </span>
    </li>
  );
}
