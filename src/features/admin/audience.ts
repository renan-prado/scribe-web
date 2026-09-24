/**
 * Quem entra na conta: clientes, contas de Backoffice, ou os dois.
 *
 * CLIENT-SAFE, porque o seletor de `/admin/costs` é um componente cliente e
 * precisa do mesmo vocabulário do servidor. Ver a regra de fronteira no
 * `AGENTS.md` da raiz.
 *
 * ## Por que um recorte, e não um `where` escondido
 *
 * A conta de Backoffice (`profiles.is_internal`, migração 0073) existe porque
 * quem escreve o produto é também quem mais o usa, e o painel não tinha como
 * saber disso: 43% do custo de LLM medido em produção vinha de duas contas do
 * autor, e as duas únicas assinaturas "ativas" também. Custo por 1.000 moedas,
 * margem por ação e taxa de conversão são perguntas sobre MERCADO, e não
 * admitem o operador dentro da amostra.
 *
 * Mas apagar essas linhas de vez seria trocar um número errado por outro: o
 * dólar dos testes saiu da conta da OpenAI do mesmo jeito, e "quanto me custa
 * por mês testar o meu próprio produto" é uma pergunta legítima que só estas
 * contas respondem. Por isso é um RECORTE, com os três valores à mão, e não
 * uma exclusão permanente.
 *
 * `clients` é o padrão em toda tela que decide preço. O engano seguro aqui é
 * medir a menos e ir conferir; medir a mais é a conta boa demais que ninguém
 * investiga.
 */

export const ADMIN_AUDIENCES = ["clients", "internal", "all"] as const;
export type AdminAudience = (typeof ADMIN_AUDIENCES)[number];

export const DEFAULT_ADMIN_AUDIENCE: AdminAudience = "clients";

export function isAdminAudience(value: unknown): value is AdminAudience {
  return typeof value === "string" && (ADMIN_AUDIENCES as readonly string[]).includes(value);
}

/** O valor válido, ou o padrão. Para ler `?audience=` sem repetir a guarda. */
export function parseAdminAudience(value: unknown): AdminAudience {
  return isAdminAudience(value) ? value : DEFAULT_ADMIN_AUDIENCE;
}

export const ADMIN_AUDIENCE_LABEL: Record<AdminAudience, string> = {
  clients: "Clientes",
  internal: "Backoffice",
  all: "Todas",
};

/**
 * A frase que a tela mostra quando o recorte NÃO é o padrão.
 *
 * Existe porque um total recortado é indistinguível de um total inteiro
 * olhando para o número: sem dizer o que ficou de fora, "custo de IA
 * R$ 12,40" é a mesma tela nos três casos.
 */
export const ADMIN_AUDIENCE_NOTE: Record<AdminAudience, string | null> = {
  clients: null,
  internal:
    "Só as contas de Backoffice: o que custa testar o próprio produto. Não é custo de atender cliente.",
  all: "Clientes e Backoffice somados. A margem daqui inclui os testes internos e não é preço de mercado.",
};

/** Decide se uma linha entra no recorte. Um lugar só, servidor e cliente. */
export function audienceIncludes(audience: AdminAudience, isInternal: boolean): boolean {
  if (audience === "all") return true;
  return audience === "internal" ? isInternal : !isInternal;
}
