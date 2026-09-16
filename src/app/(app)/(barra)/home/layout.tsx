import type { ReactNode } from "react";
import { ImportAction, RecordAction, WriteAction } from "../components/CreateActions";
import { SearchToggle } from "../components/SearchScope";
import { TopBar } from "../components/TopBar";
import { LibrarySearchScope } from "./LibrarySearchScope";

/**
 * A metade da barra que é da Biblioteca, e a razão de ela ter saído da página.
 *
 * **A barra do app é partida em duas** — a casca com o avatar, no layout de
 * `(barra)`, e o conteúdo da tela, que chega lá por portal (ver `TopBar` e
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
 * O `SearchScope` veio junto e não tinha escolha: ele é o estado que a lupa
 * (aqui) e a lista (na página) dividem, então precisa envolver os dois. O
 * `?busca=1` que ele lia de `searchParams` passou para o cliente, ver
 * `LibrarySearchScope`.
 */
export default function BibliotecaLayout({ children }: { children: ReactNode }) {
  return (
    <LibrarySearchScope>
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
            <SearchToggle />
            <WriteAction />
          </>
        }
      />
      {children}
    </LibrarySearchScope>
  );
}
