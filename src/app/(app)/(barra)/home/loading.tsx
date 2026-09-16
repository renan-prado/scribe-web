import { LibrarySkeleton } from "./LibraryBrowser";

/**
 * O esqueleto da Biblioteca enquanto o servidor monta a página.
 *
 * **Ele não desenha mais nada próprio: é o mesmo `LibrarySkeleton` da lista.**
 * Havia dois — um cartão com borda e linhas de resumo aqui, um mural de
 * post-its lá — e eles aparecem um atrás do outro: primeiro esta casca,
 * enquanto o segmento carrega, depois o da lista, enquanto o acervo vem do
 * disco. Duas anatomias em sequência leem como a tela se refazendo duas vezes.
 *
 * **E esta espera encolheu.** A página lia `listSessions()` no render, então
 * este arquivo cobria uma ida ao banco; hoje ela não vai ao banco (ver
 * `page.tsx`), e o que sobra aqui é o tempo de o segmento chegar.
 *
 * **A barra do topo não aparece, e não precisa.** Ela mora no layout de
 * `(barra)` e SOBREVIVE à navegação: já está na tela, inteira e de verdade,
 * enquanto esta lista carrega. Desenhar um osso por cima dela seria fingir que
 * falta o que está ali.
 */
export default function LibraryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col gap-6 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <LibrarySkeleton />
    </main>
  );
}
