import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ImportAction, RecordAction, WriteAction } from "../components/CreateActions";
import { SearchTrigger } from "../components/SearchTrigger";
import { TopBar } from "../components/TopBar";
import { HOME_SEARCH_HREF } from "../lib/overlay-routes";

/**
 * O título da aba, no LAYOUT e não na página: ele vale para `/home` e para as
 * duas gavetas, e metadata exportada de um slot paralelo não é lida (a de
 * `children` é a que conta, e em `/home/search` o `children` é o
 * `default.tsx`, que não exporta nenhuma). No layout a herança resolve os três
 * endereços de uma vez.
 */
export const metadata: Metadata = { title: "Biblioteca" };

/**
 * A metade da barra que é da Biblioteca, e a razão de ela ter saído da página.
 *
 * **A barra do app é partida em duas** — a casca com o avatar, no layout de
 * `(shell)`, e o conteúdo da tela, que chega lá por portal (ver `TopBar` e
 * `AppHeaderShell`). A segunda metade morava na `page.tsx`, e aí está o defeito
 * que este arquivo conserta: `loading.tsx` envolve a PÁGINA num `<Suspense>`,
 * nunca o layout do mesmo segmento. Enquanto o esqueleto estava na tela, a
 * página não estava montada, o portal dela não existia, e o vão da barra ficava
 * VAZIO — o avatar continuava lá, porque é do layout de cima, e o título, o
 * voltar e a lupa sumiam e voltavam. Era esse o piscar da lupa ao ir do
 * `/summary` para cá.
 *
 * No layout ela sobrevive ao esqueleto pela mesma regra que preserva o avatar,
 * um degrau abaixo. **Rota nova com `loading.tsx` põe a `TopBar` no layout do
 * segmento**, não na página; sem `loading.tsx` tanto faz, porque ali o router
 * segura a tela anterior inteira até a nova estar pronta.
 *
 * **A busca não precisa mais de estado nenhum aqui: ela é um ENDEREÇO.** O
 * `SearchTrigger` é um link para `/home/search`, e quem desenha o diálogo é o
 * slot `@overlay` abaixo. Ela já foi um `SearchScope` deste layout e depois um
 * `open: true` mandado para a `GlobalSearchStore`; o porquê da terceira forma
 * está em `lib/overlay-routes.ts`.
 *
 * ## O slot `@overlay`: o que pousa POR CIMA da Biblioteca
 *
 * `children` é o acervo; `overlay` é a gaveta da vez — a busca
 * (`/home/search`), a conversa com o Biblo (`/home/chat`), ou o disco que abre
 * a segunda quando não há nenhuma aberta (`@overlay/page.tsx`).
 *
 * **São rotas PARALELAS e não interceptadas**, e a diferença é justamente o
 * que se quer aqui: uma interceptada mascararia a URL (`/search`, com a
 * Biblioteca atrás e invisível no endereço) e mostraria a busca em página
 * CHEIA num F5. Com o slot, `/home/search` aberto direto monta a Biblioteca
 * com a busca por cima — o mesmo resultado do toque no botão, que é o que
 * torna a URL um comando confiável para quem estiver do outro lado dela.
 *
 * Os dois slots precisam de um `default.tsx` cada, para a carga dura em que o
 * Next não tem estado anterior de slot para recuperar; ver os dois arquivos.
 */
export default function BibliotecaLayout({
  children,
  overlay,
}: {
  children: ReactNode;
  overlay: ReactNode;
}) {
  return (
    <>
      <TopBar
        title="Biblioteca"
        /* A ordem da barra: Importar, Gravar, LUPA, Escrever, avatar. A busca
           entra no meio das portas de criação, e não antes nem depois delas,
           porque é o que reparte a fileira em dois pares — quatro discos
           seguidos mais o avatar viram uma régua de cinco botões iguais em que
           nada se acha sem ler os ícones um a um. O `gap-3` é o da `TopBar` e
           vale para todos: um vão menor entre os chips de criar faria a lupa no
           meio ler como intrusa. */
        trailing={
          <>
            <ImportAction />
            <RecordAction />
            <SearchTrigger href={HOME_SEARCH_HREF} />
            <WriteAction />
          </>
        }
      />
      {children}
      {overlay}
    </>
  );
}
