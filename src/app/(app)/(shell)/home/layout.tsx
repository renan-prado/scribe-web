import type { ReactNode } from "react";
import { ImportAction, RecordAction, WriteAction } from "../components/CreateActions";
import { SearchTrigger } from "../components/SearchTrigger";
import { TopBar } from "../components/TopBar";

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
 * **A busca não precisa mais de um `SearchScope` aqui.** Ela é a
 * `GlobalSearchDialog`, montada uma vez em `(shell)/layout.tsx`; o
 * `SearchTrigger` só manda `open: true` para a `GlobalSearchStore`, sem estado
 * nenhum para dividir com a página.
 */
export default function BibliotecaLayout({ children }: { children: ReactNode }) {
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
            <SearchTrigger />
            <WriteAction />
          </>
        }
      />
      {children}
    </>
  );
}
