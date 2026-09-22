/**
 * As regras da senha, num lugar só, e client-safe.
 *
 * O formulário precisa delas para avisar ANTES de mandar, e a server action
 * precisa delas para recusar de verdade. Duas constantes diferentes nos dois
 * lados é a receita de um campo que aceita na tela e falha no servidor, ou
 * pior, o contrário: a tela barra uma senha que o banco aceitaria.
 *
 * **O piso é 8 e não 6.** Seis é o default do Supabase, que também aceita
 * senha sem nenhum outro critério. Aqui a conta guarda sermões inteiros,
 * saldo em moedas e, para quem assina, um vínculo com o Stripe; oito
 * caracteres é o mínimo que ainda não é atrito. Quem quiser apertar mais
 * mexe no painel do Supabase (Authentication → Policies) E nesta constante,
 * nessa ordem: o servidor de auth é quem recusa de fato.
 *
 * **O teto é 72 por causa do bcrypt**, que é o algoritmo do GoTrue: ele
 * ignora tudo além do 72º BYTE, então uma senha maior daria a impressão de
 * ser mais forte do que é, e um gerenciador de senhas que emitisse 100
 * caracteres teria os 28 finais descartados em silêncio. Recusar é mais
 * honesto que truncar.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Tamanho máximo de um endereço de e-mail (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;
