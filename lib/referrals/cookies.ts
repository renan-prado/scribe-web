/**
 * Cookies de indicação, nome, prazo e opções em um lugar só, para os DOIS
 * programas: o de parceiros (`/r/<slug>`) e o "Indique a um amigo"
 * (`/i/<codigo>`).
 *
 * Mora em `lib/referrals/` e não em `lib/partners/` justamente porque é
 * compartilhado: o cookie é UM só, e quem chega por um link de amigo depois de
 * ter clicado no link de um parceiro (ou vice-versa) tem uma atribuição só,
 * a última. Duas famílias de cookies dariam duas atribuições vivas ao mesmo
 * tempo e uma regra de precedência para alguém escrever errado depois.
 *
 * Client-safe de propósito: os NOMES e o formato são compartilhados entre as
 * rotas de link, o `/auth/callback` e a server action do campo de código. O
 * que NÃO é compartilhado é a leitura do cookie de atribuição: ele é
 * `httpOnly`, e nenhum código de navegador o toca.
 *
 * Por que `httpOnly` num dado tão inócuo quanto "quem indicou": ele decide
 * para quem vai dinheiro (a comissão, as moedas) e quantas moedas a conta nova
 * ganha. Um cookie legível por JS convidaria a duas coisas ruins, um
 * `document.cookie` espalhado pela UI, e a tentação de "só ler pra mostrar na
 * tela", que é como um valor de servidor vira estado de cliente sem ninguém
 * decidir isso.
 */

import { normalizeReferralCode } from "@/lib/referrals/economics";

/**
 * Indicação ativa. O valor é `<id>.<origem>[.<programa>]`, ver
 * `encodeRef`/`decodeRef` no fim deste arquivo.
 */
export const REF_COOKIE = "scriba_ref";

/**
 * 30 dias. É a janela de atribuição descrita em docs/parceiros.md e
 * docs/indicacao.md, quem abriu o link tem esse prazo para criar a conta e
 * ainda contar para quem indicou.
 */
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * "Esta visita veio da página de parceiros." Vale `1`, não carrega id nenhum,
 * porque não há o que identificar: o programa é um só.
 *
 * **É um cookie SEPARADO do `scriba_ref`, e a separação é a decisão.** O
 * `scriba_ref` decide para quem vai DINHEIRO (comissão, moedas de quem indica),
 * é exclusivo por conta e tem regra de precedência entre dois programas.
 * Este aqui decide só se uma conta nova ganha um brinde de cortesia. Enfiar os
 * dois no mesmo cookie faria a atribuição de pagamento disputar espaço com uma
 * promoção, e um bug aqui passaria a poder desviar comissão, que é exatamente
 * o que a separação impede.
 *
 * Mesma janela de 30 dias do `scriba_ref`: quem leu a página, foi pensar e
 * voltou na semana seguinte é o comportamento esperado, não a exceção.
 *
 * `httpOnly` como os outros, quem escreve é a rota `/parceiros/entrar`, quem
 * lê é a tela de entrada (server component) e o `/auth/callback`. Nenhum código
 * de navegador o toca.
 */
export const PROSPECT_COOKIE = "scriba_prospect";
export const PROSPECT_COOKIE_MAX_AGE = REF_COOKIE_MAX_AGE;

/**
 * Marca de visita recente, usada só para deduplicar o contador de cliques.
 * Guarda o slug para que abrir o link de DOIS parceiros no mesmo dia conte
 * um único para cada um, em vez de o segundo ser engolido pelo primeiro.
 */
export const VISIT_COOKIE = "scriba_visit";

/** 24h: a janela de deduplicação do contador de visitas únicas. */
export const VISIT_COOKIE_MAX_AGE = 24 * 60 * 60;

/**
 * A PISTA, e o único cookie desta família legível por JavaScript.
 *
 * Existe por causa de uma invariante da landing page: `app/page.tsx` é
 * ESTÁTICA, e ler cookie ali dentro a torna dinâmica, `no-store`,
 * `X-Vercel-Cache: MISS`, HTML remontado na origem a cada visita anônima (ver
 * "Landing page" em `app/AGENTS.md`). O selo "indicado por Fulano" no hero,
 * então, é montado DEPOIS, no cliente.
 *
 * Sem esta pista, esse componente teria de perguntar ao servidor "existe
 * indicação?" em toda visita à LP, para 99% das vezes ouvir "não". Com ela,
 * só quem realmente veio por um link paga a requisição.
 *
 * **Ela não carrega nome, foto nem código de propósito.** É um `1`. Quem
 * responde quem indicou continua sendo o cookie `httpOnly`, lido no servidor,
 * é isso que impede o cenário que o cabeçalho acima descreve: dois valores
 * para a mesma coisa, divergindo, e a tela mostrando um padrinho diferente do
 * que seria de fato creditado.
 */
export const REF_HINT_COOKIE = "scriba_ref_hint";

/**
 * `sameSite: "lax"` é REQUISITO, não preferência.
 *
 * O login é OAuth do Google: o navegador sai do nosso domínio e volta numa
 * navegação de terceiro. Com `strict`, o cookie não é enviado nessa volta,
 * ou seja, ele sumiria exatamente no `/auth/callback`, que é o único momento
 * em que ele importa. `lax` envia em navegação de topo, que é o caso aqui.
 */
export function refCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  } as const;
}

/**
 * As opções da PISTA: idênticas às de cima menos o `httpOnly`, que é o ponto
 * inteiro dela. Uma função separada, e não um parâmetro booleano, para que
 * `httpOnly: false` nunca apareça como argumento num call site que era para
 * estar gravando o cookie de atribuição.
 */
export function refHintCookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  } as const;
}

/**
 * Normaliza um slug de PARCEIRO vindo de URL ou de campo digitado.
 *
 * Espelha o `check` de `partners.slug_format` da migração 0029: minúsculas,
 * `[a-z0-9-]`, de 3 a 32 caracteres, sem começar nem terminar em hífen.
 * Validar aqui evita uma ida ao banco para toda bobagem que aparecer na URL,
 * e, no campo de código, permite dizer "código inválido" antes do submit.
 *
 * Devolve `null` quando não é um slug possível. Note que `null` significa
 * "impossível", não "inexistente": quem decide se o parceiro existe é o
 * banco.
 */
export function normalizeSlug(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) return null;
  return slug;
}

/**
 * Origem da indicação, preservada até o cadastro.
 *
 * `link`, a pessoa abriu `/r/<slug>` ou `/i/<codigo>`.
 * `code`, a pessoa digitou o código na tela de entrada.
 *
 * A distinção não muda nada no dinheiro (as duas atribuem igual), mas é o
 * único jeito de responder "o link ou o código converte melhor?", pergunta
 * que decide o que o parceiro deve divulgar. Sem gravar isso no momento da
 * indicação, o dado não existe depois.
 */
export type ReferralSource = "link" | "code";

/**
 * Qual dos dois programas indicou. Decide qual função de atribuição o
 * `/auth/callback` chama, e, por consequência, quem recebe o quê.
 */
export type ReferralProgram = "partner" | "friend";

/** Marcador de programa dentro do valor do cookie. */
const PROGRAM_TOKEN: Record<ReferralProgram, string> = { partner: "p", friend: "f" };

/**
 * Serializa identificador + origem + programa num valor de cookie só.
 *
 * Um cookie em vez de três porque os campos nascem e morrem juntos: são
 * escritos no mesmo instante e apagados no mesmo instante (no /auth/callback,
 * assim que a atribuição vira permanente em `profiles`). Cookies separados
 * poderiam divergir, um expirando antes do outro, um sobrevivendo a um
 * clear parcial, e não há leitura que precise de um sem o outro.
 *
 * O separador é `.` porque nenhum dos dois formatos de identificador
 * (`[a-z0-9-]` do slug, `[a-hjkmnp-z2-9]` do código) o admite, então o split
 * nunca é ambíguo.
 *
 * **O sufixo de programa é OPCIONAL na leitura, e isso é compatibilidade, não
 * desleixo:** quando o programa de amigos nasceu havia cookies de 30 dias
 * vivos por aí no formato antigo `<slug>.<origem>`. Um valor sem sufixo é
 * parceiro, que era o único programa que existia quando ele foi gravado.
 */
export function encodeRef(
  id: string,
  source: ReferralSource,
  program: ReferralProgram = "partner"
): string {
  return `${id}.${source}.${PROGRAM_TOKEN[program]}`;
}

export type DecodedRef =
  | { program: "partner"; slug: string; source: ReferralSource }
  | { program: "friend"; code: string; source: ReferralSource };

/**
 * Lê o valor gravado por `encodeRef`. Devolve `null` quando ele não é
 * utilizável, valor truncado, identificador fora do formato do programa que
 * ele declara. Uma origem irreconhecível é tratada como `link`, que é o
 * caminho majoritário e o padrão seguro.
 *
 * O identificador é validado contra o formato do PROGRAMA declarado: um código
 * de amigo tem 7 caracteres de um alfabeto restrito, um slug de parceiro tem
 * de 3 a 32 e admite hífen. Sem essa checagem, um cookie adulterado à mão
 * mandaria um slug para a função de atribuição de amigo, que responderia
 * `unknown_code` de qualquer forma, mas depois de uma ida ao banco que não
 * precisava acontecer.
 */
export function decodeRef(raw: string | null | undefined): DecodedRef | null {
  if (typeof raw !== "string") return null;

  const parts = raw.split(".");
  if (parts.length < 2) return null;

  const [id, rawSource, rawProgram] = parts;
  const source: ReferralSource = rawSource === "code" ? "code" : "link";
  const program: ReferralProgram = rawProgram === PROGRAM_TOKEN.friend ? "friend" : "partner";

  if (program === "friend") {
    const code = normalizeReferralCode(id);
    return code ? { program, code, source } : null;
  }

  const slug = normalizeSlug(id);
  return slug ? { program, slug, source } : null;
}
