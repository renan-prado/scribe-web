/**
 * Cookies do programa de parceiros — nome, prazo e opções em um lugar só.
 *
 * Client-safe de propósito: os NOMES e o formato são compartilhados entre a
 * rota `/r/<slug>`, o `/auth/callback` e a server action do campo de código.
 * O que NÃO é compartilhado é a leitura: os dois cookies são `httpOnly`, e
 * nenhum código de navegador toca neles.
 *
 * Por que `httpOnly` num dado tão inócuo quanto "quem indicou": ele decide
 * para quem vai dinheiro (a comissão) e quantas moedas a conta nova ganha.
 * Um cookie legível por JS convidaria a duas coisas ruins — um `document.cookie`
 * espalhado pela UI, e a tentação de "só ler pra mostrar na tela", que é como
 * um valor de servidor vira estado de cliente sem ninguém decidir isso.
 */

/**
 * Indicação ativa. O valor é `<slug>.<origem>` — ver `encodeRef`/`decodeRef`
 * no fim deste arquivo.
 */
export const REF_COOKIE = "scriba_ref";

/**
 * 30 dias. É a janela de atribuição descrita em docs/parceiros.md — quem
 * abriu o link tem esse prazo para criar a conta e ainda contar para o
 * parceiro.
 */
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Marca de visita recente, usada só para deduplicar o contador de cliques.
 * Guarda o slug para que abrir o link de DOIS parceiros no mesmo dia conte
 * um único para cada um, em vez de o segundo ser engolido pelo primeiro.
 */
export const VISIT_COOKIE = "scriba_visit";

/** 24h: a janela de deduplicação do contador de visitas únicas. */
export const VISIT_COOKIE_MAX_AGE = 24 * 60 * 60;

/**
 * `sameSite: "lax"` é REQUISITO, não preferência.
 *
 * O login é OAuth do Google: o navegador sai do nosso domínio e volta numa
 * navegação de terceiro. Com `strict`, o cookie não é enviado nessa volta —
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
 * Normaliza um slug vindo de URL ou de campo digitado.
 *
 * Espelha o `check` de `partners.slug_format` da migração 0029: minúsculas,
 * `[a-z0-9-]`, de 3 a 32 caracteres, sem começar nem terminar em hífen.
 * Validar aqui evita uma ida ao banco para toda bobagem que aparecer na URL —
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
 * `link` — a pessoa abriu `/r/<slug>`.
 * `code` — a pessoa digitou o código na tela de entrada.
 *
 * A distinção não muda nada no dinheiro (as duas atribuem igual), mas é o
 * único jeito de responder "o link ou o código converte melhor?" — pergunta
 * que decide o que o parceiro deve divulgar. Sem gravar isso no momento da
 * indicação, o dado não existe depois.
 */
export type ReferralSource = "link" | "code";

/**
 * Serializa slug + origem num valor de cookie só.
 *
 * Um cookie em vez de dois porque os dois campos nascem e morrem juntos: são
 * escritos no mesmo instante e apagados no mesmo instante (no /auth/callback,
 * assim que a atribuição vira permanente em `profiles`). Dois cookies
 * poderiam divergir — um expirando antes do outro, um sobrevivendo a um
 * clear parcial — e não há leitura que precise de um sem o outro.
 *
 * O separador é `.` porque o formato do slug (`[a-z0-9-]`) não o admite, então
 * o split nunca é ambíguo.
 */
export function encodeRef(slug: string, source: ReferralSource): string {
  return `${slug}.${source}`;
}

/**
 * Lê o par gravado por `encodeRef`. Devolve `null` quando o valor não é
 * utilizável — cookie de uma versão anterior, valor truncado, slug fora do
 * formato. Um valor sem origem reconhecível é tratado como `link`, que é o
 * caminho majoritário e o padrão seguro.
 */
export function decodeRef(raw: string | null | undefined): {
  slug: string;
  source: ReferralSource;
} | null {
  if (typeof raw !== "string") return null;
  const dot = raw.lastIndexOf(".");
  const slug = normalizeSlug(dot === -1 ? raw : raw.slice(0, dot));
  if (!slug) return null;
  const tail = dot === -1 ? "" : raw.slice(dot + 1);
  return { slug, source: tail === "code" ? "code" : "link" };
}
