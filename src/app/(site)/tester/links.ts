/**
 * Os três endereços do teste fechado, num lugar só.
 *
 * Eles aparecem em duas páginas (`/tester` e `/tester/install`) e dentro dos
 * mockups da segunda, que reproduzem as telas para as quais eles levam. Um
 * `applicationId` redigitado num dos lados é um link que leva para a ficha de
 * outro app, e o sintoma no aparelho de quem segue a instrução é "não
 * encontrado", indistinguível de "o Google ainda não liberou para você".
 */

/** O `applicationId` do app Android. É ele que a ficha da loja resolve. */
export const ANDROID_PACKAGE = "cc.scriba.app";

/** A página do convite: é aqui que se aceita ser testador. */
export const TESTING_OPT_IN_URL = `https://play.google.com/apps/testing/${ANDROID_PACKAGE}`;

/** A ficha do app, que só existe para quem já aceitou o convite. */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Como o app se chama na loja durante o teste.
 *
 * Um app em teste fechado carrega o sufixo da TRILHA no nome, e a trilha é
 * de quem baixa, não do app: quem está na lista interna lê "(acesso
 * antecipado interno)", e quem entra pelo teste fechado, que é todo mundo
 * que chega por estas páginas, lê o que está escrito aqui. Mostrar o nome da
 * trilha errada no mockup é ensinar a pessoa a procurar um app que ela nunca
 * vai encontrar.
 */
export const PLAY_APP_TITLE = "Scriba (acesso antecipado)";

/** O nome do desenvolvedor, como a loja o mostra debaixo do título. */
export const PLAY_DEVELOPER = "Scriba inc.";
