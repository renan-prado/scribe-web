/**
 * Os endereços das gavetas da Biblioteca, escritos UMA vez.
 *
 * ## Por que uma constante e não a string solta
 *
 * Estas URLs deixaram de ser detalhe de implementação: elas são o CONTRATO
 * entre a web e o aplicativo. Quando o menu for nativo, abrir a busca é o
 * aplicativo apontar o WebView para `/home/search` — não há função a chamar,
 * não há evento a mandar, é a URL e mais nada. Um endereço desses digitado em
 * cinco arquivos é um endereço que um dia diverge em um deles, e o sintoma
 * seria um botão que não abre nada, sem erro na tela.
 *
 * ## Por que `/home/search` e não `/search`
 *
 * Porque a gaveta é da BIBLIOTECA, e o endereço diz isso. Uma rota
 * interceptada (`@modal/(.)search`) daria `/search` na barra de endereço, com
 * a Biblioteca montada atrás e invisível na URL — e, num F5, a busca em página
 * CHEIA, sem a Biblioteca. É o desenho certo para o `/admin`, onde a ficha de
 * uma sessão é conteúdo que se manda por link; é o errado aqui, onde a gaveta
 * só faz sentido sobre o acervo. Estas são rotas PARALELAS (`@overlay`): o
 * endereço se soma ao da tela de baixo, e `/home/search` aberto direto monta a
 * Biblioteca com a busca por cima, igualzinho ao que o toque no botão faz.
 */

export const HOME_HREF = "/home";

/** A busca global, por cima da Biblioteca. */
export const HOME_SEARCH_HREF = "/home/search";

/** A conversa com o Biblo, por cima da Biblioteca. */
export const HOME_CHAT_HREF = "/home/chat";
