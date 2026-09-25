/**
 * O que o slot `@overlay` desenha quando a URL não casa nenhuma das gavetas —
 * numa carga DURA, onde o Next não tem estado anterior de slot para recuperar.
 *
 * Sem este arquivo, um `/home/qualquer-coisa` que exista no slot `children` e
 * não aqui responderia 404 na tela inteira, que é o jeito mais confuso de uma
 * rota que existe parecer que não existe. Hoje não há nenhuma, mas a próxima
 * página filha da Biblioteca não deveria precisar saber disso.
 *
 * `null`, e não um fragmento: o layout renderiza `{overlay}` solto, e um nó
 * vazio não deve ocupar linha de flex nenhuma.
 */
export default function HomeOverlayDefault() {
  return null;
}
