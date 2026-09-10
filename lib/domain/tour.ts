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

export const TOUR_KEYS = [
  "feed",
  "recordings",
  "studies",
  "summary",
  "study",
  "capture_live",
  "capture_audio",
  "capture_transcribe",
] as const;

export type TourKey = (typeof TOUR_KEYS)[number];

export function isTourKey(value: unknown): value is TourKey {
  return typeof value === "string" && (TOUR_KEYS as readonly string[]).includes(value);
}

/**
 * As três telas de captura têm tours SEPARADOS, e não um só parametrizado
 * pelo modo.
 *
 * Elas se parecem antes de começar, o botão grande no meio e nada mais, e
 * prometem coisas diferentes: o Ao Vivo enche a tela de cartões durante a
 * pregação, o Áudio não mostra nada e entrega um resumo no fim, a Transcrição
 * entrega o texto e só. Uma chave única gastaria a explicação do Ao Vivo na
 * primeira vez que alguém gravasse em modo transcrição, e o cartão que ele
 * nunca viu continuaria sem explicação para sempre.
 */
export const TOURS: Record<TourKey, TourDefinition> = {
  feed: {
    version: 1,
    label: "Início",
    steps: [
      {
        id: "welcome",
        title: "Bem-vindo ao Scriba",
        body: "Em um minuto eu mostro o que tem em cada tela. Dá para pular a qualquer momento e rever tudo depois, no seu perfil.",
      },
      {
        id: "reflection",
        anchor: '[data-tour="feed-reflection"]',
        title: "Sua última gravação, em uma frase",
        body: "O centro do que foi dito, para você lembrar sem reler tudo. Toque em Relembrar para abrir o resumo completo.",
      },
      {
        id: "entries",
        anchor: '[data-tour="feed-entries"]',
        title: "O que volta para você",
        body: "Trechos para reler, lembretes e frases marcantes que o Scriba separou das suas pregações. A lista cresce a cada gravação.",
      },
      {
        id: "record",
        anchor: '[data-tour="nav-record"]',
        title: "Gravar",
        body: "É por aqui que tudo começa. Você escolhe o modo antes de iniciar, e cada um tem um preço por minuto.",
      },
    ],
  },

  recordings: {
    version: 1,
    label: "Biblioteca",
    steps: [
      {
        id: "intro",
        title: "Tudo o que você já ouviu",
        body: "Cada gravação e cada vídeo importado fica aqui, agrupado por período. Nada é apagado sozinho.",
      },
      {
        id: "unfinished",
        anchor: '[data-tour="recordings-unfinished"]',
        title: "Gravações em aberto",
        body: "Sessões que nunca foram encerradas ficam nesta faixa. Você pode voltar para elas ou apagá-las, e trechos pendentes no aparelho são reenviados ao abrir a sessão.",
      },
      {
        id: "import",
        anchor: '[data-tour="recordings-import"]',
        title: "Importar do YouTube",
        body: "Cole o link de uma pregação e o Scriba trabalha sobre a legenda do vídeo: resumo, estudo e cards, sem gravar nada. São 30 moedas por vídeo, de até 2 horas.",
      },
      {
        id: "search",
        anchor: '[data-tour="collection-search"]',
        title: "Busque pelo que foi dito",
        body: "A busca não olha só o título: ela procura no autor, no local, nos versículos e dentro da própria pregação.",
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
        body: "Aqui ficam o texto bruto, os cartões que apareceram durante a gravação, o reprocessamento do resumo e o aviso de erro, se o Scriba escrever algo que não foi dito.",
      },
      {
        id: "followups",
        anchor: '[data-tour="summary-followups"]',
        title: "O que volta depois",
        body: "Trechos para reler, lembretes e frases marcantes desta pregação. Eles aparecem no seu Início nos próximos dias.",
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

  capture_live: {
    version: 1,
    label: "Gravação ao vivo",
    steps: [
      {
        id: "button",
        anchor: '[data-tour="record-button"]',
        title: "Toque para começar",
        body: "Deixe o aparelho com a tela virada para quem prega, o mais perto possível. Distância e eco são o que mais atrapalham a transcrição.",
      },
      {
        id: "live",
        title: "Durante a pregação",
        body: "A tela vai se encher sozinha: versículos citados, ideias que apareceram e ecos de outras pregações suas. Nada é reescrito, o conteúdo só cresce.",
      },
      {
        id: "stop",
        title: "Ao encerrar",
        body: "O resumo é gerado sobre tudo o que foi dito e a sessão abre sozinha. São 7 moedas por minuto iniciado, e você pode pausar quando quiser.",
      },
    ],
  },

  capture_audio: {
    version: 1,
    label: "Gravação de áudio",
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
        body: "Neste modo o Scriba só escuta e transcreve, sem cartões durante a pregação. É o modo de quem quer prestar atenção, não olhar o celular.",
      },
      {
        id: "stop",
        title: "Ao encerrar",
        body: "O resumo é gerado sobre tudo o que foi dito e a sessão abre sozinha. São 5 moedas por minuto iniciado.",
      },
    ],
  },

  capture_transcribe: {
    version: 1,
    label: "Transcrição",
    steps: [
      {
        id: "button",
        anchor: '[data-tour="record-button"]',
        title: "Toque para começar",
        body: "Deixe o aparelho com a tela virada para quem prega, o mais perto possível. Distância e eco são o que mais atrapalham a transcrição.",
      },
      {
        id: "text",
        title: "Só o texto, e é o mais barato",
        body: "Este modo não passa por nenhum modelo de resumo: você recebe a transcrição, e nada além dela. São 3 moedas por minuto iniciado.",
      },
      {
        id: "later",
        title: "E se você mudar de ideia",
        body: "Depois de salva, a transcrição oferece um botão para gerar o resumo por 15 moedas. Escolher este modo agora não fecha a porta.",
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
