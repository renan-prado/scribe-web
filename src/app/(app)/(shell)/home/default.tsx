/**
 * O que o slot `children` desenha quando o Next não sabe em que página ele
 * estava: a mesma Biblioteca da `page.tsx`, e é o ponto todo do arquivo.
 *
 * Numa carga DURA de `/home/search` ou `/home/chat` — o endereço colado, o F5,
 * o aplicativo apontando o WebView — o Next casa o slot `@overlay` com a
 * gaveta e fica sem resposta para o `children`, que não tem segmento nenhum
 * naquela URL. Sem este arquivo a resposta seria 404 na tela inteira; com ele,
 * é o acervo, exatamente como numa navegação de dentro do app.
 *
 * É esse arquivo, e não o slot, que cumpre "abrir `/home/search` direto tem que
 * mostrar a Biblioteca com a busca aberta".
 *
 * Um `export { default } from "./page"` e não uma cópia: duas listas de
 * Biblioteca divergiriam no primeiro ajuste, e a divergência só apareceria no
 * caminho que ninguém testa à mão, que é justamente a carga dura.
 */
export { default } from "./page";
