/**
 * O que o teste fechado da Play Store PROMETE, nas duas pontas.
 *
 * Client-safe de propósito: a página `/tester` anuncia o número e o servidor
 * emite o presente com ele. Um valor redigitado na copy é a forma mais rápida
 * de o produto prometer 150 e entregar 100, sem erro nenhum na tela.
 *
 * **O presente não é creditado no cadastro, é PENDENTE.** Ele nasce como uma
 * linha de `coin_gifts` (migração 0077) e vira saldo no toque em "Resgatar",
 * no cartão da Biblioteca. Cortesia creditada em silêncio é cortesia que
 * ninguém percebe ter recebido, e esta existe para ser percebida por quem
 * topou testar uma versão instável.
 *
 * **Elas se SOMAM às de boas-vindas** (`INITIAL_COIN_BALANCE`), não as
 * substituem: a conta de um testador nasce com as 50 de todo mundo e encontra
 * o presente esperando na primeira tela.
 */

/** O tamanho do presente de quem entrou pelo teste fechado. */
export const TESTER_GIFT_COINS = 150;

/** O título do cartão, o que a pessoa lê antes de decidir tocar. */
export const TESTER_GIFT_TITLE = "Obrigado por testar o Scriba";

/**
 * A mensagem de dentro do cartão. Ela diz de onde o presente veio, porque um
 * presente sem procedência no meio de um app novo parece defeito.
 */
export const TESTER_GIFT_MESSAGE =
  "Você entrou na primeira turma de testadores do Scriba no Android. Estas moedas são por isso, e são suas para gravar as primeiras pregações. Se algo der errado, conte pelo WhatsApp: o retorno dos testadores é o que decide o que será corrigido primeiro.";
