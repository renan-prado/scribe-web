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
 * **A barra do topo não aparece aqui, e não precisa: ela está na tela de
 * verdade.** A casca (o avatar, o saldo) é do layout de `(barra)`, e o conteúdo
 * da tela — título, voltar, lupa — é do `layout.tsx` deste segmento, que este
 * arquivo NÃO substitui: `loading.tsx` envolve a página, nunca o layout irmão.
 * Foi para isso que a `TopBar` saiu da `page.tsx`; enquanto ela estava lá, o vão
 * da barra ficava vazio durante este esqueleto e a lupa piscava a cada chegada.
 * Desenhar um osso por cima dela seria fingir que falta o que está ali.
 */
export default function LibraryLoading() {
  return (
    // A MESMA caixa da `page.tsx`: o esqueleto e a lista aparecem um atrás do
    // outro, e qualquer diferença entre os dois faz o mural saltar no instante
    // em que ele chega. (A folga acima é do `AppHeaderShell`, que sobrevive ao
    // esqueleto — ver o cabeçalho deste arquivo.)
    <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col gap-6 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <LibrarySkeleton />
    </main>
  );
}
