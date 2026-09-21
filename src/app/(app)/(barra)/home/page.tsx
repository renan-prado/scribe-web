import type { Metadata } from "next";
import { BibloHomeDock } from "@/features/session/components/BibloHomeDock";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_LIST_MS } from "@/features/tour/config";
import { CreateDock } from "./CreateDock";
import { LibraryBrowser } from "./LibraryBrowser";

export const metadata: Metadata = { title: "Biblioteca" };

/**
 * O Início do v2: a lista de tudo que a pessoa gravou ou importou, agrupada por
 * mês, com busca atrás da lupa, e o botão de criar no rodapé.
 *
 * O layout segue os prints em `public/prints/new-release/`: barra do topo,
 * blocos por mês, botão flutuante. E o CARTÃO agora segue junto — é um mural de
 * POST-ITS de duas colunas (ver `LibraryNote`), com autor, título e data, e
 * nada mais. A troca que a tela propõe deixou de ser só de ordem: o acervo é a
 * primeira tela, criar é o botão que flutua sobre ele, e cada sessão é uma
 * anotação colorida em vez de uma ficha.
 *
 * **Esta página não vai mais ao banco, e é a mudança que importa.** Ela chegou a
 * ter duas consultas, depois uma — `listSessions()` no render —, e agora
 * nenhuma. Enquanto ela existia, cada abertura do app e cada volta para a
 * Biblioteca a refaziam do zero, com a tela em esqueleto até a resposta chegar;
 * num WebView, que o sistema mata a toda hora, isso é o dia inteiro. A lista
 * agora é lida do IndexedDB pelo `LibraryBrowser` e revalidada atrás (ver
 * `features/session/query.ts`), e o que sobra aqui é a moldura.
 *
 * (A consulta que saiu ANTES dessa buscava quais sessões já tinham estudo, para
 * uma pastilha que o post-it não mostra. O princípio é o mesmo nos dois cortes:
 * consulta que alimenta tela que não existe, ou que existe guardada no
 * aparelho, não aparece como bug — aparece como latência.)
 *
 * **A barra do topo e o `SearchScope` moram no `layout.tsx` deste segmento**, e
 * não aqui: o `loading.tsx` envolve a página, nunca o layout, e com a barra na
 * página o vão dela ficava vazio durante o esqueleto — a lupa piscava a cada
 * chegada. O porquê inteiro está no cabeçalho de lá.
 *
 * A busca em si continua no cliente (`LibraryBrowser`); o provider só precisa
 * envolver os dois lados, o botão lá em cima e a lista aqui.
 *
 * A largura trava em 1024px, e o mural ganha colunas junto (ver
 * `LibraryBrowser`): a tela nasceu de um print de celular, e esticada sem teto
 * num monitor viravam cartões de 1400px com três palavras em cada. O teto
 * sozinho não bastaria — 1024px em duas colunas dá post-its de meia tela, que é
 * o mesmo defeito num tamanho menor.
 *
 * **No desktop as três portas de criação sobem para a BARRA** (`CreateActions`),
 * e o `+` do rodapé some. Por isso a folga de baixo é mobile-only: sem o dock
 * não há o que desviar, e o vão viraria um buraco no fim da lista. Ver
 * `CreateDock`.
 */
export default function V2HomePage() {
  return (
    <>
      {/* A folga de baixo é a altura da barra de criar mais o inset do iPhone:
          sem ela o último cartão da lista para debaixo dela e não há rolagem
          que o traga inteiro para a luz. Ver `CreateDock`.

          A de CIMA não está aqui, e não é esquecimento: ela é a mesma em toda
          tela do app e mora no `pb-4` do `AppHeaderShell`, junto da barra que
          ela separa do conteúdo. Esteve aqui por um commit, só no celular, e o
          problema era geral — o mesmo aperto acontecia no desktop e nas outras
          seis telas. */}
      <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col gap-6 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <LibraryBrowser nowIso={new Date().toISOString()} />
      </main>
      <CreateDock />
      {/* O Biblo na Biblioteca é o único que ESCREVE um documento em vez de
          sugerir um bloco: aqui não há texto na tela para receber sugestão.
          Ver `BibloHomeDock`. */}
      <BibloHomeDock />
      {/* A apresentação da Biblioteca, e a primeira que qualquer pessoa vê: é
          aqui que se cai ao entrar. Ver `src/features/tour/AGENTS.md`. */}
      <TourTrigger tour="library" delayMs={TOUR_DELAY_LIST_MS} />
    </>
  );
}
