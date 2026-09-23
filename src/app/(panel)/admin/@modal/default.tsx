/**
 * O estado VAZIO do slot `@modal`.
 *
 * Um slot paralelo precisa ter o que renderizar em toda rota do painel, e na
 * esmagadora maioria delas a resposta é "nada": só `(.)sessions/[id]` e
 * `(.)users/[id]` o preenchem, e só quando a navegação partiu de dentro do
 * painel. Sem este arquivo o Next não sabe o que pôr aqui numa carga dura de
 * `/admin/costs` e responde 404 na tela inteira — o modo mais confuso possível
 * de uma rota que existe parecer que não existe.
 *
 * `null` e não um fragmento: o layout renderiza `{modal}` solto, e um nó vazio
 * não deve ocupar linha de flex nenhuma.
 */
export default function AdminModalDefault() {
  return null;
}
