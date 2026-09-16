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
 * ## Passo que ABRE o que vai explicar
 *
 * A regra de cima tem uma exceção, e ela é o menu de criar do celular: as três
 * portas do produto moram atrás de um `+` que nasce fechado, e um passo que
 * esperasse encontrá-las na tela seria descartado em toda visita. `reveal` é o
 * pedido do passo à tela — "abra isto antes" —, e quem sabe abrir escuta (ver
 * `features/tour/lib/reveal.ts`).
 *
 * ## `version`: subir é interromper todo mundo de novo
 *
 * Ver `supabase/migrations/0051_user_tours.sql`. Consertar uma vírgula não
 * sobe versão. Acrescentar um passo sobre um botão novo sobe.
 */

/**
 * O que um passo é capaz de pedir que a tela abra antes de falar dele.
 *
 * É uma lista fechada de propósito: cada nome aqui tem, do outro lado, um
 * componente que o escuta. Um nome sem ouvinte é um passo que aponta para o
 * vazio, e a lista curta é o que torna óbvio, ao ler, quais são os pares.
 */
export const TOUR_REVEALS = ["create-dock"] as const;

export type TourReveal = (typeof TOUR_REVEALS)[number];

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
  /**
   * Pede à tela que abra algo ANTES deste passo, e o mantém aberto enquanto ele
   * durar. Ver `TOUR_REVEALS` acima e `features/tour/lib/reveal.ts`.
   *
   * Um passo com `reveal` não é descartado por o alvo não estar na tela na hora
   * em que o tour é montado — é exatamente esse o caso que ele existe para
   * resolver. Ver `resolveSteps`.
   */
  reveal?: TourReveal;
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
    /**
     * **2 porque o tour passou a explicar as TRÊS portas de criação**, uma por
     * passo, e não mais uma linha sobre o botão que as esconde. Isso é
     * exatamente o caso que a `version` existe para cobrir: quem viu a v1 viu
     * um tour que não contava que escrever e importar existem, e o produto
     * inteiro está nessas três palavras.
     *
     * **E nenhum dos balões diz preço, nem o da gravação, que na v1 dizia.** Um
     * balão por porta abriria lugar para os três — mas o que o tour tem a
     * ensinar na primeira tela é que as três portas EXISTEM e o que cada uma
     * faz. Preço é a segunda pergunta, e ela tem onde ser respondida na hora em
     * que nasce: o saldo mora na barra, e o débito é anunciado no caminho de
     * cada porta. Três tabelas de preço no primeiro minuto de alguém é a
     * conversa de vendas antes da demonstração.
     */
    version: 2,
    label: "Biblioteca",
    steps: [
      {
        /**
         * O "Bem-vindo" e o "o que é esta tela" eram dois passos, e viraram um.
         * O tour ganhou três passos sobre as portas de criação, e sete balões
         * na primeira tela da vida de alguém é uma parede; os dois que se
         * juntaram diziam a mesma coisa em dois fôlegos, e juntos ainda plantam
         * os três verbos que os últimos passos vão desenvolver.
         */
        id: "welcome",
        title: "Bem-vindo ao Scriba",
        body: "Esta é a sua Biblioteca: toda pregação que você gravar, escrever ou importar fica guardada aqui.",
      },
      {
        /**
         * O alvo é a LUPA do cabeçalho (`SearchToggle`), e não a barra de
         * busca: a barra só é montada depois do clique nela, e enquanto este
         * passo apontou para `[data-tour="collection-search"]` ele foi
         * descartado em TODA visita, sem erro nenhum na tela. Vale para as
         * duas listas — os Estudos passaram a esconder a barra atrás da lupa
         * como a Biblioteca sempre fez, e o passo de lá mudou de alvo junto.
         *
         * O conserto não sobe a `version`: o passo é o mesmo passo, escrito no
         * primeiro dia, que nunca chegou a aparecer. Subir a versão aqui
         * reabriria o "Bem-vindo ao Scriba" na cara de toda a base para
         * mostrar um balão sobre uma lupa.
         */
        id: "search",
        anchor: '[data-tour="library-search"]',
        title: "Busque pela sua biblioteca",
        body: "A lupa procura por quem pregou, pelo local, por um versículo ou por uma frase que foi dita na pregação.",
      },
      {
        /**
         * **Este passo é do CELULAR, e some no desktop de propósito.**
         * `[data-tour="create-dock"]` é o `+` do rodapé, que é `md:hidden`; no
         * desktop as três portas já estão abertas na barra do topo, e um passo
         * dizendo "elas estão atrás deste botão" descreveria uma tela que não
         * está ali. Ele se apaga sozinho, pela regra de sempre: alvo ausente,
         * passo descartado (ver `features/tour/lib/anchors.ts`).
         *
         * Ele NÃO leva `reveal`, e é isso que faz a sequência funcionar: aqui o
         * painel ainda está fechado e o holofote recorta o `+`; no "Próximo" o
         * painel abre e o balão passa a apontar para dentro dele. A pessoa vê o
         * menu nascer do botão de que acabaram de lhe falar, em vez de ouvir
         * que ele existe.
         */
        id: "create",
        anchor: '[data-tour="create-dock"]',
        title: "Tudo começa por aqui",
        body: "Atrás deste botão estão as três portas do Scriba. Vou mostrar uma a uma.",
      },
      {
        /**
         * Daqui até o fim, os três alvos existem DUAS vezes — no painel do
         * `CreateDock`, no celular, e nos chips da barra do topo, no desktop
         * (`(app)/(barra)/components/CreateActions.tsx`). Um dos dois está sempre em
         * `display: none`, e `resolveAnchor` fica com o visível, então os
         * mesmos três passos servem às duas larguras sem um `if` de tamanho de
         * tela em lugar nenhum.
         *
         * O `reveal` é o que abre o painel no celular e o mantém aberto pelos
         * três passos (ver `features/tour/lib/reveal.ts`). No desktop ele não
         * tem efeito nenhum: o dock inteiro é `md:hidden`, e quem escuta o
         * pedido está dentro dele.
         */
        id: "create-record",
        anchor: '[data-tour="create-record"]',
        reveal: "create-dock",
        title: "Gravar",
        body: "Deixe o aparelho gravando durante a pregação. No fim, o Scriba transcreve tudo e escreve o resumo para você.",
      },
      {
        id: "create-write",
        anchor: '[data-tour="create-write"]',
        reveal: "create-dock",
        title: "Escrever",
        body: "Escreva um resumo você mesmo, use nosso editor para organizar os pontos centrais de alguma reflexão ou pregação, e o Scriba guarda para você.",
      },
      {
        id: "create-import",
        anchor: '[data-tour="create-import"]',
        reveal: "create-dock",
        title: "Importar do YouTube",
        body: "Cole o link de um vídeo do YouTube e o Scriba transforma em transcrição e resumo.",
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
      /**
       * Havia aqui um passo sobre o "Gerar estudo" (`[data-tour="deepen"]`). O
       * botão saiu da interface com o modo estudo, e o passo saiu junto: um
       * passo de âncora ausente é descartado em silêncio (ver
       * `features/tour/lib/anchors.ts`), então deixá-lo não quebraria nada —
       * seria só uma linha de configuração descrevendo um botão que a pessoa
       * não tem como encontrar.
       */
      /**
       * A TRANSCRIÇÃO saiu deste passo junto com o item do menu: ela é o
       * segundo slide da tela agora, a um deslize do resumo (ver
       * `SummaryDeck`). O passo continua sendo o mesmo — "o que mora atrás dos
       * três pontinhos" —, dizendo o que sobrou lá dentro, e por isso a
       * `version` não sobe: subi-la reabriria o tour inteiro na cara de toda a
       * base para trocar uma frase.
       */
      {
        id: "menu",
        anchor: '[data-tour="session-menu"]',
        title: "As opções do resumo",
        body: "Aqui ficam o reprocessamento do resumo, o aviso de erro (se o Scriba escrever algo que não foi dito) e a exclusão. Para ler o texto bruto da pregação, deslize o resumo para o lado.",
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
        /**
         * A LUPA, pela mesma razão do passo irmão na Biblioteca: a barra
         * (`[data-tour="collection-search"]`) agora nasce fechada aqui também,
         * e um passo ancorado nela seria descartado em silêncio.
         *
         * Trocar o alvo NÃO sobe a `version`: é o mesmo passo, dizendo a mesma
         * coisa, apontando para onde a busca passou a morar. Subir a versão
         * reabriria o tour inteiro dos Estudos na cara de toda a base.
         */
        id: "search",
        anchor: '[data-tour="studies-search"]',
        title: "Busque por tema ou versículo",
        body: "A lupa procura pelo estudo do qual você só lembra de um trecho — por tema, por autor ou por um versículo.",
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
