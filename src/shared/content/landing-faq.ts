import { formatCoins, PLANS } from "@/lib/billing/plans";
import { COIN_COSTS, INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";

/**
 * Perguntas frequentes da landing page.
 *
 * Mora fora de `app/page.tsx` porque tem DOIS consumidores que precisam dizer
 * exatamente a mesma coisa: a seção visível e o JSON-LD `FAQPage`
 * (`LandingJsonLd`). O Google trata rich result cuja resposta estruturada não
 * bate com o texto da página como spam estrutural, e a punição é a página
 * inteira perder o snippet, não só o bloco divergente.
 *
 * Os números saem de `lib/coins/pricing.ts` e `lib/billing/plans.ts`, pela
 * mesma razão que os preços dos planos: a LP não tem números próprios. Um "5
 * créditos por minuto" digitado aqui continuaria no ar meses depois de a
 * tabela mudar, e ainda apareceria no resultado de busca.
 */

export type FaqItem = {
  question: string;
  /** Texto puro: vai para o JSON-LD como está. Sem markup, sem link. */
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "O que é o Scriba?",
    answer:
      "O Scriba é um app que transcreve pregações, estudos bíblicos e mensagens da igreja enquanto eles acontecem. Durante a mensagem ele reconhece os versículos citados e destaca as frases principais; ao final, entrega um resumo organizado com a ideia central, os pontos principais, as passagens lidas e aplicações para a semana.",
  },
  {
    question: "Para quem o Scriba foi feito?",
    answer:
      "Para quem ouve e deseja retornar na mensagem. Membros da igreja, alunos da EBD, estudantes de teologia e qualquer pessoa que acompanhe pregações e queira revisá-las depois.",
  },
  {
    question: "Preciso instalar algum aplicativo?",
    answer:
      "Não, necessariamente. O Scriba roda no navegador do celular ou do computador. Porém, indicamos adicioná-lo à tela inicial e abrir como um app comum para desfrutar melhor dos recursos oferecidos.",
  },
  {
    question: "Como funciona a transcrição?",
    answer:
      "Você inicia a gravação e deixa o celular captando o áudio. Uma IA dedicada entende o que está sendo dito e transforma em um texto organizado.",
  },
  {
    question: "O que acontece com o áudio gravado?",
    answer:
      "O áudio não é salvo em nossos servidores: ficamos apenas o texto da transcrição e o resumo, dentro da sua conta e visíveis só para você. Cada gravação pode ser apagada quando você quiser.",
  },
  {
    question: "Quanto custa usar o Scriba?",
    answer: `A conta começa com ${INITIAL_COIN_BALANCE} créditos grátis, sem cartão. Cada minuto gravado consome créditos conforme o modo escolhido: ${COIN_COSTS.liveMinute} no modo ao vivo, com feed e resumo, ${COIN_COSTS.audioOnlyMinute} no modo somente áudio e ${COIN_COSTS.transcriptMinute} no modo somente transcrição. Os planos mensais recarregam a conta a partir de ${formatCoins(PLANS.pessoal.coins)} créditos por mês, e o que sobra acumula para o mês seguinte.`,
  },
  {
    question: "O Scriba funciona sem internet?",
    answer:
      "Não. A transcrição é feita nos nossos servidores, então é preciso conexão durante a gravação. Depois de salvo, o resumo pode ser lido a qualquer momento.",
  },
];
