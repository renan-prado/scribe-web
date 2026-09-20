/**
 * O que cada plano ENTREGA, numa lista só para a landing e para o diálogo de
 * compra.
 *
 * ## Por que este arquivo existe
 *
 * As duas telas descrevem a mesma coisa para a mesma pessoa, em dois momentos
 * dela: antes de criar a conta (`/#planos`) e na hora de assinar (o
 * `BillingDialog`, aberto pelo avatar, pelo `/profile` e pelo fim do presente
 * do Biblo). Cada uma tinha a SUA lista — a landing com estes tópicos, o
 * diálogo com outros, escritos noutro dia —, e quem lia os dois via dois
 * produtos parecidos em vez de um. Pior: só uma das duas era corrigida quando
 * o produto mudava, e foi assim que "Estudo aprofundado de cada sessão"
 * sobreviveu no diálogo meses depois de o estudo sair da interface.
 *
 * Aqui não mora preço nem crédito: nome, valor e franquia continuam em
 * `plans.ts`, e o texto abaixo descreve CAPACIDADE. A separação é a mesma que
 * `plans.ts` já faz com o Stripe: mudar uma frase daqui muda o que a pessoa LÊ,
 * nunca o que ela paga.
 *
 * ## Por que não dentro de `plans.ts`
 *
 * Porque o nome da funcionalidade paga sai de `lib/entitlements/features.ts`,
 * que por sua vez importa `plans.ts` para saber a ordem dos planos. Escrever
 * estas listas lá dentro fecharia o ciclo. Aqui em cima dos dois, não há ciclo
 * nenhum: `features.ts → plans.ts`, e este módulo lê os dois.
 *
 * ⚠️ **Cada linha é uma promessa que `lib/entitlements/features.ts` tem de
 * cumprir**, e o defeito já aconteceu nas duas direções: o card do Gratuito
 * prometeu "Gerar estudos" e o botão respondeu 403; depois o estudo saiu da
 * interface e os planos pagos continuaram vendendo o que ninguém encontrava do
 * lado de dentro, onde não há 403 para explicar. Ao mexer numa linha, confira o
 * catálogo.
 */

import type { PlanKey } from "@/features/billing/plans";
import { BIBLO_GIFT_MESSAGES } from "@/features/coins/pricing";
import { FEATURES } from "@/lib/entitlements/features";

export type PlanFeature = {
  label: string;
  /** `false` desenha a linha como AUSENTE: X apagado no lugar do check. */
  included: boolean;
  /**
   * A linha em NEGRITO, com o check verde: é o que aquele plano tem e o
   * Gratuito não.
   *
   * O destaque já foi do ÚLTIMO item, qualquer que ele fosse, e com isso o card
   * do Gratuito destacava o presente — que é uma coisa boa de dizer, e não é
   * uma razão para assinar. Aqui ele marca exatamente a resposta de "o que eu
   * ganho pagando?": as primeiras linhas são iguais nos três cards, e quem
   * compara de relance precisa que as diferentes saltem. Por definição, então,
   * NENHUMA linha do Gratuito é destacada.
   */
  featured?: boolean;
  /**
   * Põe o ROSTO do Biblo no lugar do check. Ele é a única coisa do produto com
   * cara, nome e primeira pessoa, e um nome escrito em texto corrido no meio de
   * linhas iguais não lembra disso ninguém: quem já conversou reconhece a cara
   * antes de ler a frase, e quem nunca conversou pergunta quem é.
   *
   * Cada tela desenha o rosto com o que pode: a landing usa o `BibloFace`, que
   * roda no servidor e não custa um byte de JS; o diálogo, que já é cliente,
   * usa o `BibloAvatar`. É o mesmo rosto, a mesma semente (ver `biblo-seed.ts`).
   *
   * **No Gratuito ele vai em `grayscale`**, e a regra que decide isso é
   * `featured`: no card em que o Biblo é um presente com fim, ele não pode ser
   * o ponto mais colorido dos três cards. A cor fica guardada para quem assina.
   */
  face?: boolean;
};

/**
 * O EDITOR, e ele é a base dos três cards porque é a base do produto.
 *
 * ## A linha que faltava, e o que ela conserta
 *
 * O card do Gratuito dizia "Editor inteligente e moderno" — a mesma frase dos
 * pagos, um adjetivo sobre uma ferramenta — e com isso a tela de planos
 * descrevia um produto que não é o nosso: um app de IA com uma amostra grátis.
 * A estratégia é a inversa, e ela é explícita: **o editor manual é grátis para
 * sempre, e o que se cobra é a IA.** Uma pessoa que escreve os próprios esboços
 * toda semana nunca vai pagar nada, e é isso que a faz ficar.
 *
 * Então a base virou duas linhas que dizem CAPACIDADE em vez de adjetivo, e o
 * Gratuito ganha a terceira, que é a promessa inteira em quatro palavras. Elas
 * são as PRIMEIRAS dos três cards de propósito: quem compara de relance lê o
 * topo, e o topo tem de dizer o que a pessoa leva sem pagar.
 *
 * ⚠️ **Cada uma destas linhas é uma promessa que o produto tem de cumprir.**
 * "Todas as ferramentas de texto" quer dizer TODAS: títulos, tópicos,
 * marca-texto, passagem bíblica, citação, destaque, conclusão. No dia em que um
 * bloco novo do editor nascer atrás de um `requireFeature`, esta linha passa a
 * mentir — e é a mentira pior de todas, porque não há 403 na tela de planos
 * para explicá-la.
 */
const EDITOR_FEATURES: PlanFeature[] = [
  { label: "Editor manual ilimitado", included: true },
  { label: "Todas as ferramentas de texto", included: true },
];

/**
 * O que a IA acrescenta. São as duas portas do `/home` que gastam moeda, e por
 * isso elas são a linha divisória do preço: existem nos três planos, e o que
 * muda entre eles é quanto se pode usá-las.
 */
const AI_FEATURES: PlanFeature[] = [
  { label: "Resumo automático", included: true },
  { label: "Importar do YouTube", included: true },
];

/**
 * O nome da funcionalidade paga sai do CATÁLOGO, e não daqui: é o mesmo rótulo
 * que o `/admin` mostra na matriz de features e o mesmo que a frase de upsell
 * usa. O `biblo_chat` é hoje o degrau pago, no `minPlan` em que o estudo estava.
 */
const BIBLO_FEATURE = FEATURES.biblo_chat.name;

/**
 * O Gratuito RECEBE, ele não é um plano capado.
 *
 * A linha do Biblo era um X, e o X estava errado por dois lados. Pelo lado do
 * fato: a conta gratuita ganha `BIBLO_GIFT_MESSAGES` conversas de verdade, sem
 * cartão e sem pedir nada, então quem não paga recebe MAIS do que o card
 * dizia. E pelo lado do tom: um X é a forma de dizer "você não tem", e é a
 * coisa errada a dizer a quem ainda nem entrou — a conversa com o Biblo é a
 * única chance de alguém descobrir por que valeria assinar.
 *
 * **E ele abre com o que NÃO acaba**: o editor manual, as ferramentas de texto
 * e a linha que diz a estratégia inteira, "Sem custo para sempre". Ela fica
 * logo abaixo das duas capacidades que qualifica, e não no fim do card, porque
 * é a frase que decide se alguém cria a conta — e porque é verdade: quem só
 * escreve nunca vai ver uma parede.
 *
 * **O que o Gratuito não tem continua dito, e com todas as letras**: a recarga
 * todo mês. Ela é a diferença de verdade entre não pagar e pagar, e é a ÚNICA
 * linha ausente do card, o que a deixa visível de relance em vez de escondida
 * numa lista mais curta. Ela fica no MEIO, onde é comparada com a mesma linha
 * dos outros dois, e o card termina no que a pessoa GANHA.
 */
const FREE_FEATURES: PlanFeature[] = [
  ...EDITOR_FEATURES,
  { label: "Sem custo para sempre", included: true },
  ...AI_FEATURES,
  { label: "Créditos que renovam todo mês", included: false },
  {
    label: `${BIBLO_GIFT_MESSAGES} mensagens grátis com o Biblo`,
    included: true,
    face: true,
  },
];

/**
 * A recarga é o que muda a relação com o produto: deixa de ser "tenho créditos
 * para gastar com cuidado" e passa a ser "gravo o culto de domingo".
 */
const RENEWAL_FEATURE: PlanFeature = {
  label: "Créditos novos todo mês",
  included: true,
  featured: true,
};

/** Sempre a ÚLTIMA linha dos três cards: é a única com rosto. */
const BIBLO_PAID_FEATURE: PlanFeature = {
  label: `${BIBLO_FEATURE}`,
  included: true,
  featured: true,
  face: true,
};

const PAID_FEATURES: PlanFeature[] = [
  ...EDITOR_FEATURES,
  ...AI_FEATURES,
  RENEWAL_FEATURE,
  BIBLO_PAID_FEATURE,
];

/**
 * O Estudioso é o Pessoal num RITMO maior, e é só isso que ele é.
 *
 * Os dois liberam exatamente as mesmas funcionalidades hoje
 * (`lib/entitlements/features.ts`: as duas features estão em
 * `minPlan: "pessoal"`), então a lista dele é a dos pagos mais o que a conta de
 * fato dá: cabe a semana inteira da igreja. **Uma exclusiva inventada aqui
 * seria promessa quebrada do lado de dentro**, onde não existe 403 para
 * explicá-la.
 */
const ESTUDIOSO_FEATURES: PlanFeature[] = [
  ...EDITOR_FEATURES,
  ...AI_FEATURES,
  RENEWAL_FEATURE,
  { label: "Uso diário sem preocupação", included: true, featured: true },
  { label: "Crie múltiplos esboços e aulas", included: true, featured: true },
  BIBLO_PAID_FEATURE,
];

/** A lista de um plano. É por aqui que a landing e o diálogo leem a mesma coisa. */
export const PLAN_FEATURES: Record<PlanKey, PlanFeature[]> = {
  free: FREE_FEATURES,
  pessoal: PAID_FEATURES,
  estudioso: ESTUDIOSO_FEATURES,
};
