/**
 * O número de WhatsApp do pré-cadastro de testador, nas DUAS pontas.
 *
 * Client-safe de propósito: o formulário (`/tester`) precisa mascarar
 * enquanto se digita e a rota (`/api/tester/signup`) precisa normalizar antes
 * de gravar. São a mesma regra, e duas cópias dela é a promessa de que um dia
 * a tela aceita um número que o servidor recusa — com a pessoa lendo um erro
 * genérico sobre um campo que, na tela dela, está preenchido corretamente.
 *
 * **Guardamos o número em E.164 sem o `+`** (`5511987654321`), que é a forma
 * que o `wa.me` consome: o link para o qual este campo existe é
 * `https://wa.me/<este valor>`. Formatar é trabalho de quem MOSTRA, nunca de
 * quem guarda.
 *
 * **O país é assumido como Brasil (55) quando não vem escrito**, e isso é uma
 * decisão de produto, não um descuido: o app é pt-BR, o teste fechado é de
 * igrejas brasileiras, e obrigar a digitar `+55` num formulário de duas
 * linhas cobra de todo mundo por um caso que ainda não aconteceu. Um número
 * que já traga outro DDI passa inteiro.
 */

/** O que o placeholder do campo mostra. Um número brasileiro, com DDD. */
export const WHATSAPP_PLACEHOLDER = "(11) 98765-4321";

/** Só os dígitos, no máximo 15 (o teto do E.164). */
function digits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 15);
}

/**
 * A máscara do campo, aplicada a cada tecla.
 *
 * Ela trabalha sobre a parte NACIONAL — se a pessoa colar um número com `55`
 * na frente, o prefixo é mostrado separado em vez de virar "(55) 11987…",
 * que é o erro clássico de máscara brasileira e faz o campo parecer quebrado
 * justo para quem colou um número certo.
 */
export function maskWhatsapp(raw: string): string {
  const all = digits(raw);
  const foreign = all.length > 11 && !all.startsWith("55");
  if (foreign) return `+${all}`;

  const hasCountry = all.length > 11 && all.startsWith("55");
  const national = hasCountry ? all.slice(2) : all;
  const prefix = hasCountry ? "+55 " : "";

  if (national.length <= 2) return prefix + (national ? `(${national}` : "");
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  // O corte do hífen depende do tamanho: celular tem 9 dígitos depois do DDD
  // (5+4), fixo tem 8 (4+4). Enquanto se digita o nono, o corte anda sozinho.
  const split = rest.length > 8 ? 5 : rest.length > 4 ? rest.length - 4 : rest.length;
  const head = rest.slice(0, split);
  const tail = rest.slice(split);
  return `${prefix}(${ddd}) ${head}${tail ? `-${tail}` : ""}`;
}

/**
 * O valor que vai para o banco, ou `null` se o que foi digitado não é um
 * número que se consiga chamar.
 *
 * A parte nacional brasileira tem 10 (fixo) ou 11 (celular) dígitos com DDD.
 * Números com outro DDI passam pela regra frouxa do E.164 (8 a 15 dígitos),
 * porque validar plano de numeração do mundo inteiro aqui seria fingir uma
 * precisão que não temos.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const all = digits(raw);
  if (all.length < 10) return null;

  // A parte nacional brasileira, venha o `55` escrito ou não. `null` aqui
  // quer dizer "isto não é um número do Brasil".
  const national = all.length <= 11 ? all : all.startsWith("55") ? all.slice(2) : null;

  if (national !== null) {
    if (national.length < 10 || national.length > 11) return null;
    // DDD válido começa em 11. Sem esta linha, `0800…` e um número digitado
    // com o zero da operadora na frente passariam como celular.
    if (Number.parseInt(national.slice(0, 2), 10) < 11) return null;
    return `55${national}`;
  }

  // Outro país: a regra frouxa do E.164, que é tudo o que dá para afirmar
  // sem carregar o plano de numeração do mundo inteiro.
  return all.length <= 15 ? all : null;
}

/** Como o número aparece para quem o lê de volta (confirmação, painel). */
export function formatWhatsapp(e164: string): string {
  if (!e164.startsWith("55")) return `+${e164}`;
  const national = e164.slice(2);
  if (national.length < 10) return `+${e164}`;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
