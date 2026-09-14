/**
 * O vocabulário dos tours: quais existem, o que cada um diz, e em que versão.
 *
 * Client-safe de propósito, é o mesmo módulo que o servidor usa para decidir
 * se ainda há tour a mostrar e que o navegador usa para desenhar o balão. Não
 * importe nada de `server-only` aqui.
 *
 * A regra do produto, em uma frase: **uma vez por pessoa, por tela.** A tabela
 * `user_tours` (0051) tem a chave primária `(user_id, tour)` exatamente por
 * isso, e o cabeçalho dela explica por que não é uma flag só de onboarding.
 *
 * ## O passo sem âncora não é um passo pela metade
 *
 * `anchor` é opcional. Quem tem âncora recorta o elemento na tela e fala sobre
 * ele; quem não tem aparece centralizado e fala sobre a TELA. O segundo tipo
 * existe porque a primeira coisa a dizer numa tela quase nunca está num botão:
 * "isto aqui é o resumo do que você gravou" não tem onde ser apontado, e
 * fingir que tem obrigaria a inventar um alvo.
 *
 * ## Passo cuja âncora não existe é DESCARTADO, não é erro
 *
 * Metade dos alvos é condicional: a faixa "Em aberto" da Biblioteca só existe
 * para quem tem gravação inacabada, o botão de gerar estudo some para quem já
 * gerou. Um tour que travasse no alvo ausente seria um tour que só funciona na
 * conta de quem o escreveu. Some o passo, o resto corre; se não sobrar passo
 * nenhum, o tour não roda E NÃO É MARCADO como visto, ele espera a tela ter o
 * que mostrar.
 *
 * ## `version`: subir é interromper todo mundo de novo
 *
 * Ver `supabase/migrations/0051_user_tours.sql`. Consertar uma vírgula não
 * sobe versão. Acrescentar um passo sobre um botão novo sobe.
 */

/** O seletor é o contrato entre o passo e a tela. Ver `data-tour` nas páginas. */
export type TourStep = {
  /** Estável, aparece no log e no controle de passo abandonado. */
  id: string;
  /**
   * Seletor CSS do alvo. Ausente = passo centralizado, sobre a tela inteira.
   *
   * A convenção é `[data-tour="…"]`; qualquer seletor vale, e quando ele casa
   * com mais de um elemento vence o primeiro VISÍVEL (o header do desktop e a
   * barra do celular desenham o mesmo botão, um deles está sempre oculto).
   */
  anchor?: string;
  title: string;
  body: string;
};

export type TourDefinition = {
  /** Sobe SÓ quando os passos mudam de conteúdo. Ver acima. */
  version: number;
  /** Como o tour se chama no /profile. */
  label: string;
  steps: readonly TourStep[];
};

export const TOUR_KEYS = ["library", "recording", "summary", "studies", "study"] as const;

export type TourKey = (typeof TOUR_KEYS)[number];

export function isTourKey(value: unknown): value is TourKey {
  return typeof value === "string" && (TOUR_KEYS as readonly string[]).includes(value);
}

/**
 * **Eram oito chaves, e cinco delas descreviam telas que não existem mais.**
 * `feed` era o Início; `recordings` era a Biblioteca antes de ela virar a
 * primeira tela; e `capture_live`, `capture_audio` e `capture_transcribe` eram
 * os três modos de gravação, que viraram um. As chaves novas não reaproveitam
 * os nomes antigos de propósito: quem viu a apresentação do `recordings` viu
 * OUTRA tela, e mostrá-la de novo é o certo, não um bug. As linhas velhas
 * ficam em `user_tours` sem chave correspondente, inertes.
 */
export const TOURS: Record<TourKey, TourDefinition> = {
  library: {
    version: 1,
    label: "Biblioteca",
    steps: [
      {
        id: "welcome",
        title: "Bem-vindo ao Scriba",
        body: "Em um minuto eu mostro o que tem em cada tela. Dá para pular a qualquer momento e rever tudo depois, no seu perfil.",
      },
      {
        id: "intro",
        title: "Tudo o que você já ouviu",
        body: "Cada gravação e cada vídeo importado fica aqui, agrupado por mês. Nada é apagado sozinho.",
      },
      {
        id: "search",
        anchor: '[data-tour="collection-search"]',
        title: "Busque pela sua biblioteca",
        body: "Procure por quem pregou, pelo local, por um versículo ou por uma frase que foi dita.",
      },
      {
        id: "record",
        anchor: '[data-tour="record-dock"]',
        title: "Gravar",
        body: "É por aqui que tudo começa. São 5 moedas por minuto iniciado, e a transcrição e o resumo já estão nesse preço.",
      },
    ],
  },

  recording: {
    version: 1,
    label: "Gravação",
    steps: [
      {
        id: "button",
        anchor: '[data-tour="record-button"]',
        title: "Toque para começar",
        body: "Deixe o aparelho com a tela virada para quem prega, o mais perto possível. Distância e eco são o que mais atrapalham a transcrição.",
      },
      {
        id: "quiet",
        title: "A tela fica quieta de propósito",
        body: "O Scriba só escuta enquanto a pregação corre. É o modo de quem quer prestar atenção, não olhar o celular.",
      },
      {
        id: "stop",
        title: "Ao encerrar",
        body: "O áudio sobe inteiro, de uma vez, e o resumo é gerado sobre tudo o que foi dito. Se algo der errado no envio, a gravação fica guardada no aparelho e você pode tentar de novo.",
      },
    ],
  },

  summary: {
    version: 1,
    label: "Resumo salvo",
    steps: [
      {
        id: "intro",
        title: "O resumo da sua gravação",
        body: "Os pontos centrais da pregação, organizados. Ele foi gerado uma vez, sobre a transcrição inteira, quando você encerrou.",
      },
      {
        id: "header",
        anchor: '[data-tour="summary-header"]',
        title: "Título, autor e local são seus",
        body: "Toque em qualquer um deles para corrigir. O Scriba tenta preencher sozinho, e nem sempre acerta o nome de quem pregou.",
      },
      {
        id: "deepen",
        anchor: '[data-tour="deepen"]',
        title: "O estudo desta pregação",
        body: "Daqui sai o estudo teológico completo: contexto, tese e desdobramentos. É um por sessão, e depois de pronto este mesmo botão leva de volta a ele.",
      },
      {
        id: "menu",
        anchor: '[data-tour="session-menu"]',
        title: "Transcrição e mais opções",
        body: "Aqui ficam o texto bruto, o reprocessamento do resumo e o aviso de erro, se o Scriba escrever algo que não foi dito.",
      },
    ],
  },

  studies: {
    version: 1,
    label: "Estudos",
    steps: [
      {
        id: "intro",
        title: "Estudos teológicos",
        body: "A partir de qualquer resumo você pode pedir um estudo: contexto da passagem, tese central e desdobramentos. Ele é gerado uma vez por sessão e mora aqui.",
      },
      {
        id: "search",
        anchor: '[data-tour="collection-search"]',
        title: "Busque por tema ou versículo",
        body: "Serve para reencontrar aquele estudo do qual você só lembra de um trecho.",
      },
    ],
  },

  study: {
    version: 1,
    label: "Estudo pronto",
    steps: [
      {
        id: "intro",
        title: "Seu estudo está pronto",
        body: "Ele foi escrito sobre a pregação inteira, não sobre o resumo. Leia com calma: é para estudo, não para consulta rápida.",
      },
      {
        id: "thesis",
        anchor: '[data-tour="study-thesis"]',
        title: "A tese central",
        body: "Se você só puder ler uma coisa, leia esta. O resto do estudo desenvolve o que está escrito aqui.",
      },
      {
        id: "menu",
        anchor: '[data-tour="study-menu"]',
        title: "Refazer o estudo",
        body: "Se o resultado não ficou bom, dá para gerar de novo por aqui. O estudo anterior é substituído.",
      },
    ],
  },
};

/** O mapa que o layout entrega ao navegador: tour → versão já vista. */
export type TourSeenMap = Partial<Record<TourKey, number>>;

/**
 * A pergunta do cliente antes de qualquer requisição: "esta pessoa ainda deve
 * ver este tour?".
 *
 * Ela é feita nos DOIS lados. Aqui ela evita uma chamada de rede em toda
 * visita de quem já viu tudo, que é a esmagadora maioria; no servidor
 * (`lib/db/tours.ts`) ela é refeita porque é lá que ela vale, duas abas
 * abertas na mesma tela chegam juntas nesta função com a mesma resposta.
 */
export function shouldRunTour(seen: TourSeenMap, tour: TourKey): boolean {
  const seenVersion = seen[tour];
  if (seenVersion === undefined) return true;
  return seenVersion < TOURS[tour].version;
}
