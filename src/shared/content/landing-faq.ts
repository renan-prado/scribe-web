import { formatCoins, PLANS } from "@/features/billing/plans";
import { BIBLO_GIFT_MESSAGES, COIN_COSTS, INITIAL_COIN_BALANCE } from "@/features/coins/pricing";

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
      "O Scriba é o bloco de notas inteligente do cristão. Ele faz três coisas: grava uma pregação, uma aula da EBD ou um estudo e devolve a anotação organizada (ideia central, pontos principais, passagens lidas, frases marcantes e aplicações para a semana); deixa você escrever a anotação você mesmo ou importá-la de um vídeo do YouTube; e conversa com você sobre a Bíblia pelo Biblo, sem sair do texto.",
  },
  {
    question: "Para quem o Scriba foi feito?",
    answer:
      "Para quem ouve e deseja retornar na mensagem. Membros da igreja, alunos da EBD, estudantes de teologia e qualquer pessoa que acompanhe pregações e queira revisá-las depois.",
  },
  {
    question: "Preciso gravar para usar o Scriba?",
    answer:
      "Não. São três caminhos para o mesmo resumo: gravar pelo microfone do celular, colar o link de um vídeo do YouTube (e, se a pregação estiver no meio de uma transmissão longa, importar só o trecho) ou escrever você mesmo, num editor com os mesmos blocos do resumo gerado. Escrever à mão não consome créditos.",
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
    question: "Quem é o Biblo?",
    answer: `O Biblo é a conversa que fica dentro de cada resumo, e também dentro do editor. Ele chega sabendo o que está na tela e já sugere o que perguntar: o contexto da passagem, quem era o personagem, outras passagens sobre o mesmo tema. O que servir você envia para o seu texto com um toque. Ele faz parte dos planos ${PLANS.pessoal.name} e ${PLANS.estudioso.name}, e na conta gratuita as primeiras ${BIBLO_GIFT_MESSAGES} mensagens são por nossa conta.`,
  },
  {
    question: "O que acontece com o áudio gravado?",
    answer:
      "O áudio não é salvo em nossos servidores: ficam apenas o texto da transcrição e o resumo, dentro da sua conta e visíveis só para você. Cada gravação pode ser apagada quando você quiser.",
  },
  {
    question: "Quanto custa usar o Scriba?",
    answer: `A conta começa com ${INITIAL_COIN_BALANCE} créditos grátis, sem cartão. Cada minuto gravado consome ${COIN_COSTS.recordingMinute} créditos, transcrição e resumo incluídos, e importar um vídeo do YouTube custa ${COIN_COSTS.youtubeImport} créditos, cobrados uma vez. Escrever o resumo você mesmo não consome nada. Os planos mensais recarregam a conta a partir de ${formatCoins(PLANS.pessoal.coins)} créditos por mês, e o que sobra acumula para o mês seguinte.`,
  },
  {
    question: "O Scriba funciona sem internet?",
    answer:
      "Não. A transcrição é feita nos nossos servidores, então é preciso conexão durante a gravação. Depois de salvo, o resumo pode ser lido a qualquer momento.",
  },
];
