import { z } from "zod";
import { SummaryBlockSchema } from "./summary";

/**
 * O vocabulário do Biblo, a conversa que acontece dentro de uma sessão.
 *
 * Client-safe: é o que a gaveta desenha e o que a rota valida, e os dois
 * precisam do MESMO contrato — uma sugestão que o servidor aceita e o cliente
 * não sabe renderizar é um botão que não aparece, sem erro nenhum na tela.
 *
 * Desenho completo em `docs/biblo-implementacao.md`.
 */

/**
 * O que o Biblo oferece para entrar no texto.
 *
 * **É um `SummaryBlock`, e isso é a regra inteira virada em tipo.** Se o que
 * ele quer oferecer não couber nos oito tipos que o editor já desenha, não há
 * sugestão: a resposta fica na conversa e a pessoa copia. Um "bloco do Biblo"
 * seria um nono tipo que o `BlockRenderer`, o `Composer` e o
 * `WRITTEN_BLOCK_TYPES` teriam de aprender — ver o cabeçalho de
 * `domain/summary.ts` sobre o que acontece quando existe um tipo que só um
 * lado conhece.
 */
/**
 * Teto de um chip.
 *
 * 90 e não 48: os chips passaram a ser perguntas faladas ("E os marinheiros
 * junto a Jonas, o que pensavam da situação?"), e as telegráficas que cabiam em
 * 48 eram justamente o que se queria mudar. Acima disto deixa de ser pergunta e
 * vira parágrafo com ponto de interrogação, e a fileira de pastilhas do rodapé
 * vira um bloco de texto.
 *
 * **A folga entre 80 e 90 foi comprada com uma medição.** A `offer` passa por
 * este mesmo teto, e a primeira que o modelo escreveu tinha 84 caracteres:
 * quatro a mais que o limite de então. Ela era descartada em silêncio, e o
 * sintoma era o botão de oferta nunca aparecer — que se lê como "o prompt não
 * funcionou", e leva a mexer no lugar errado.
 */
export const BIBLO_MAX_CHIP_CHARS = 90;

export const BibloSuggestionSchema = z.object({
  /** O rótulo do botão, no vocabulário do usuário. */
  label: z.string().min(1).max(60),
  block: SummaryBlockSchema,
  /** Depois de qual bloco entrar. -1 = antes de todos. */
  afterIndex: z.number().int().min(-1),
});

export type BibloSuggestion = z.infer<typeof BibloSuggestionSchema>;

/**
 * O `afterIndex` que quer dizer "no fim do texto".
 *
 * O campo nasceu para o modelo APONTAR uma posição: ele vê os blocos numerados
 * e diz depois de qual o novo entra. Mas nem toda inserção vem do modelo — o
 * "+" de uma passagem e o "Adicionar ao resumo" de um trecho selecionado são a
 * PESSOA inserindo, e ali não há posição proposta por ninguém.
 *
 * O fim é a resposta certa para esses dois: quem coleta material enquanto
 * conversa está empilhando, não costurando — e mover um bloco dentro do editor
 * é um gesto, enquanto achar onde ele foi parar no meio do texto é uma busca.
 *
 * As duas pontas que consomem uma sugestão passam por `insertionIndex`
 * (`domain/summary.ts`), que grampeia o número ao tamanho da lista — então
 * "grande" é literalmente "o fim", sem caso especial aqui.
 *
 * **Mas o fim não é abaixo da CONCLUSÃO**, e por um tempo foi: a leitura só
 * grampeava ao tamanho da lista, e uma passagem adicionada pelo "+" entrava
 * depois do fecho. A regra que impede isso mora naquela função, e é por isso
 * que as duas telas a chamam em vez de cada uma calcular a sua.
 */
export const BIBLO_AT_END = Number.MAX_SAFE_INTEGER;

/**
 * ONDE a conversa está acontecendo, e é isso que decide o que o Biblo pode
 * FAZER além de falar.
 *
 * - `session`: dentro de um resumo (`/summary/:id`, `/summary/:id/edit`) ou ao lado
 *   de uma gravação. Há um documento na tela, e a porta para ele é a
 *   `suggestion` — um bloco, inserido onde o modelo apontou.
 * - `home`: a Biblioteca. Não há documento nenhum na tela, e é justamente por
 *   isso que aqui ele ganha FERRAMENTAS: criar um documento do zero, renomeá-lo
 *   e acrescentar conteúdo a ele. Uma sugestão de bloco não teria onde entrar.
 *
 * A separação existe para o prompt não oferecer o que a tela não sabe executar:
 * um `criarDocumento` respondido dentro do `/summary` seria uma ferramenta que
 * ninguém chama, gastando tokens de instrução em toda mensagem do produto.
 */
export const BIBLO_SURFACES = ["session", "home"] as const;

export type BibloSurface = (typeof BIBLO_SURFACES)[number];

/**
 * As FERRAMENTAS do Biblo: o que ele faz no aplicativo, e não só diz.
 *
 * ## Por que elas são um campo do contrato, e não `tool_calls` da OpenAI
 *
 * Porque a resposta do Biblo JÁ é um contrato JSON com seis campos, validado
 * por um schema cuja regra número um é que nenhum campo derruba a resposta (ver
 * `BibloReplySchema`). `tool_calls` seria um segundo canal de saída, com um
 * segundo caminho de erro, um segundo lugar onde o schema pode cair, e uma
 * segunda rodada de chamada ao modelo por ação — a OpenAI espera que a
 * ferramenta responda e a conversa continue. Tudo isso para entregar o mesmo
 * objeto que já cabe num campo do JSON que ele está escrevendo de qualquer
 * jeito.
 *
 * A troca, dita em voz alta: perdemos a validação de argumentos que o provedor
 * faria, e ganhamos a MESMA rede que o resto do contrato tem — ação
 * malformada é ação descartada, e a resposta continua chegando.
 *
 * ## As seis
 *
 * - `criarDocumento`: nasce um resumo escrito à mão (modo `manual`), com título
 *   e blocos. É a única das TRÊS de documento que cria alguma coisa.
 * - `editarTitulo`: troca o título do documento desta conversa.
 * - `adicionarBlocoDeConteudo`: acrescenta blocos ao fim dele.
 * - `iniciarGravacao`: leva para `/recording?auto=1` com o microfone já
 *   ligado — o MESMO parâmetro que o "Gravar" do `CreateDock` usa, e pela
 *   mesma razão: quem pediu já disse que quer gravar, um segundo toque para
 *   confirmar cobraria duas vezes pela mesma decisão.
 * - `importarVideoDoYoutube`: leva para `/import`, preenchendo o campo com
 *   o link quando a pessoa já disse qual é — o MESMO `?url=` que o
 *   compartilhar-com-o-Scriba usa (`docs/youtube.md` §9). O botão de lá
 *   continua sendo a única coisa que COBRA; este tool só abre a porta.
 * - `navegarPara`: troca de tela sem executar nada. Só existem DOIS destinos
 *   porque os outros três já têm ferramenta própria — gravar é
 *   `iniciarGravacao`, importar é `importarVideoDoYoutube`, escrever é
 *   `criarDocumento` — e duas portas para o mesmo lugar seriam a mesma
 *   escolha feita duas vezes.
 *
 * As três de documento só fazem sentido a segunda e a terceira DEPOIS da
 * primeira, e quem garante isso é o cliente: sem documento em mãos, elas são
 * descartadas com uma linha no log. As três novas não têm essa dependência —
 * gravar, importar e navegar não precisam de um documento na conversa.
 *
 * ## Por que `blocks` é uma LISTA
 *
 * Porque a `suggestion` é um bloco só, e isso é o teto dela por desenho — ela
 * oferece um parágrafo dentro de um texto que já existe. Uma ferramenta que
 * CRIA um documento entrega um documento: título, alguns parágrafos, uma lista,
 * uma conclusão. Pedir isso um bloco por mensagem seria cobrar seis mensagens
 * por um pedido só.
 */
export const BIBLO_ACTION_MAX_BLOCKS = 24;
export const BIBLO_ACTION_MAX_TITLE = 120;

const BibloActionBlockList = z.array(SummaryBlockSchema).min(1).max(BIBLO_ACTION_MAX_BLOCKS);

export const BibloActionSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("criarDocumento"),
    title: z.string().trim().min(1).max(BIBLO_ACTION_MAX_TITLE),
    /** A frase de "em poucas palavras". Opcional: nem todo pedido tem uma. */
    shortSummary: z.string().trim().max(600).optional(),
    blocks: BibloActionBlockList,
  }),
  z.object({
    tool: z.literal("editarTitulo"),
    title: z.string().trim().min(1).max(BIBLO_ACTION_MAX_TITLE),
  }),
  z.object({
    tool: z.literal("adicionarBlocoDeConteudo"),
    blocks: BibloActionBlockList,
  }),
  z.object({
    tool: z.literal("iniciarGravacao"),
  }),
  z.object({
    tool: z.literal("importarVideoDoYoutube"),
    /** O link, quando a pessoa já disse qual é. Sem ele a tela abre com o
     * campo vazio, do mesmo jeito que abriria pelo `CreateDock`. */
    url: z.string().trim().url().max(500).optional(),
  }),
  z.object({
    tool: z.literal("navegarPara"),
    /** Só os dois destinos sem ferramenta própria. Ver o cabeçalho acima. */
    destino: z.enum(["home", "perfil"]),
  }),
]);

export type BibloAction = z.infer<typeof BibloActionSchema>;

/**
 * A lista de ações, peneirada UMA A UMA.
 *
 * `z.array(BibloActionSchema).catch([])` derrubaria as boas junto com a ruim, e
 * a régua deste arquivo é a oposta: o que não couber sai, o que chegou inteiro
 * fica. Com duas ações numa resposta — criar o documento e já acrescentar um
 * bloco —, um erro de digitação na segunda não pode apagar a primeira.
 */
function parseActions(value: unknown): BibloAction[] {
  if (!Array.isArray(value)) return [];
  const out: BibloAction[] = [];
  for (const raw of value.slice(0, 4)) {
    const parsed = BibloActionSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * O JSON que UMA chamada ao modelo devolve: resposta, próximos chips, sugestão
 * e o fio.
 *
 * Os quatro saem juntos de propósito. Chips derivados do que acabou de ser dito
 * são o que faz a conversa andar sem a pessoa ter de escrever uma linha
 * (`biblo.md` §4), e pedi-los numa segunda chamada dobraria o custo de cada
 * mensagem para gerar três frases curtas.
 *
 * ## NENHUM CAMPO DERRUBA A RESPOSTA, e isto é o contrato inteiro
 *
 * A chamada já aconteceu e a moeda já foi debitada quando este schema roda:
 * recusar aqui não economiza nada, só transforma dinheiro gasto em *"Não
 * consegui responder agora"*. Todo campo tem, portanto, a sua rede — `.catch()`
 * ou um valor padrão —, e o ÚNICO erro fatal é a resposta vazia dos dois lados
 * (`answer` e `suggestion.block.text`), que é o caso em que não há literalmente
 * o que mostrar.
 *
 * A regra existe porque foi violada três vezes, e cada violação custou
 * respostas boas já pagas: `chips` com uma sugestão longa demais, `suggestion`
 * com o bloco solto no lugar do envelope, e `offer` com o objeto da sugestão
 * dentro. **Campo novo nasce com rede**, e a rede é parte do campo, não uma
 * melhoria posterior.
 */
/**
 * A oferta, quando ela chega como OBJETO em vez de frase.
 *
 * **Isto não é paranoia de tipo: foi a causa número um das falhas do Biblo em
 * produção.** Medido em 17/09/2026, cinco das nove perguntas sem resposta
 * daquele dia foram exatamente este deslize — o modelo devolveu em `offer` o
 * envelope da `suggestion`:
 *
 *     "offer": { "label": "Escreva um parágrafo sobre a humildade de Cristo",
 *                "block": { "type": "paragraph", "text": "" }, "afterIndex": 2 }
 *
 * O campo era `z.string()` sem rede, então o schema INTEIRO caía, e a pessoa
 * via *"Não consegui responder agora"* depois de a moeda já ter sido debitada
 * e de o modelo ter escrito uma resposta perfeitamente boa. O erro vinha do
 * próprio prompt, onde o bloco "O formato: { label, block, afterIndex }" ficava
 * logo abaixo do parágrafo que fala da `offer` — mas um prompt mais claro
 * reduz a frequência, nunca a zero, e é esta função que decide o que acontece
 * quando ele erra.
 *
 * O `label` é aproveitado em vez de descartado porque ele É a oferta: está na
 * voz certa, no tamanho certo, e jogá-lo fora tiraria da tela o único chip com
 * um destino. Qualquer outra forma vira `null`, que é "sem oferta" — o pior
 * caso de antes desta linha existir.
 */
function offerText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "label" in value) {
    const label = (value as { label?: unknown }).label;
    if (typeof label === "string") return label;
  }
  return null;
}

export const BibloReplySchema = z.object({
  /**
   * A pergunta estava FORA DO TERRITÓRIO, e a resposta é a recusa gentil.
   *
   * Código JavaScript, receita de miojo, tradução de e-mail, lição de casa e a
   * tentativa de trocar as instruções do Biblo. O território inteiro está
   * escrito no prompt, e ele é uma pergunta — "isso ajuda a entender, pregar ou
   * escrever o texto na tela?" —, nunca uma lista de assuntos: um Biblo que
   * recusa Nietzsche porque Nietzsche não está na Bíblia falha justamente no
   * trabalho de quem prega. Ver `O TERRITÓRIO` em `prompts/biblo.ts`.
   *
   * **Ele existe para o SERVIDOR, não para a tela.** A recusa é uma resposta
   * como outra qualquer na gaveta; o que o campo faz é fechar as duas portas do
   * documento (`suggestion` e `offer`), que de outro modo abrem sozinhas — o
   * prompt manda oferecer na dúvida, e `verifySuggestion` preenche bloco de
   * prosa vazio com a resposta. Sem esta bandeira, *"aqui eu só falo de
   * Bíblia"* ganha um "Adicionar este parágrafo" embaixo, e um toque distraído
   * põe a recusa no resumo de alguém.
   *
   * `.catch(false)` pela régua do arquivo: uma bandeira malformada não derruba
   * uma resposta já cobrada. O pior caso é o de antes desta linha existir.
   */
  offtopic: z.boolean().default(false).catch(false),
  /**
   * **Vazia é aceita aqui, e resolvida no servidor** — não derruba a resposta.
   *
   * Ela era `.min(1)`, o último campo fatal do contrato, e cobrava caro pelo
   * privilégio: perguntado "insere no resumo um parágrafo sobre a diferença
   * entre as duas parábolas", o modelo escrevia o parágrafo DENTRO de
   * `suggestion.block.text` e mandava `answer: ""` — o pedido foi atendido, o
   * texto existe, e mesmo assim o `POST` respondia `unparseable` **depois de
   * debitar as duas moedas**. E acontecia justamente no pedido mais valioso da
   * conversa, o de pôr algo no documento.
   *
   * Quem decide o que fazer com o vazio é `generateBibloAnswer`: havendo texto
   * na sugestão, ele VIRA a resposta (os dois campos são o mesmo trecho, um
   * para ler e outro para inserir). Vazio dos dois lados, aí sim não há
   * resposta, e aí sim é erro.
   */
  answer: z.string().default("").catch(""),
  /**
   * Os chips, **aparados em vez de recusados**.
   *
   * Eles eram `.max(48)` e o schema inteiro caía quando um passava disso: uma
   * resposta boa, já paga e já cobrada, era descartada porque uma sugestão de
   * próxima pergunta tinha três palavras a mais. Chip é decoração; a resposta é
   * o produto. O que não couber sai da lista, e a resposta chega.
   *
   * (Foi exatamente o que aconteceu quando o prompt passou a pedir perguntas em
   * voz de gente, mais longas que as telegráficas de antes.)
   */
  chips: z
    .array(z.string())
    .default([])
    .catch([])
    .transform((list) =>
      list
        .map((chip) => chip.trim())
        .filter((chip) => chip.length > 0 && chip.length <= BIBLO_MAX_CHIP_CHARS)
        .slice(0, 4)
    ),
  /**
   * **`.catch(null)` e não só `.nullable()`**: uma sugestão malformada vira
   * "sem sugestão", e não a perda da resposta inteira.
   *
   * Foi medido: pedindo `text` vazio, o modelo às vezes devolve o BLOCO no
   * lugar do envelope (`{type, text}` em vez de `{label, block, afterIndex}`).
   * Sem o `catch`, esse deslize derrubava o schema todo e a pessoa perdia —
   * já cobrada — uma resposta que estava correta. Mesma régua dos chips.
   */
  suggestion: BibloSuggestionSchema.nullable().catch(null).default(null),
  /**
   * A OFERTA de escrever um trecho, na voz de quem pede: "Escreve um parágrafo
   * sobre isso". `null` quando a resposta não daria texto para o documento.
   *
   * **Ela tem campo próprio porque, dentro de `chips`, ela simplesmente não
   * acontecia.** Os chips são pedidos como perguntas ("escreva-os como ELA
   * perguntaria"), e uma oferta não é uma pergunta: com quatro vagas e uma
   * instrução de pergunta, o modelo enchia as quatro de perguntas e a oferta
   * nunca saía — medido, três rodadas seguidas. Um campo que precisa ser
   * preenchido ou dito nulo é a diferença entre pedir e obter.
   *
   * O servidor a junta a `chips` antes de gravar (ver `biblo/answer.ts`): a
   * oferta é uma pastilha que se toca como as outras, e separá-la na tela
   * seria um segundo mecanismo para o mesmo gesto.
   *
   * **`z.unknown()` e não `z.string()`, e é a correção de um defeito caro**:
   * ver o cabeçalho de `offerText` logo acima. Este campo era o último do
   * contrato sem rede, e derrubava a resposta inteira — já paga — quando o
   * modelo escrevia aqui o objeto da sugestão.
   */
  offer: z
    .unknown()
    .transform(offerText)
    .catch(null)
    .transform((text) => {
      const trimmed = text?.trim() ?? "";
      return trimmed.length > 0 && trimmed.length <= BIBLO_MAX_CHIP_CHARS ? trimmed : null;
    }),
  /**
   * A passagem que a pessoa precisa ter DIANTE DOS OLHOS para acompanhar esta
   * resposta — "Lucas 19:11-27" —, e `null` quando a resposta não gira em torno
   * de um trecho.
   *
   * **Tem campo próprio pela mesma razão que a `offer` tem**, e a medição foi a
   * mesma. O prompt pede que a referência a ser MOSTRADA fique sozinha numa
   * linha (é o que o `BibloPassage` reconhece na tela), com exemplo do formato
   * e uma seção explicando por quê. Duas rodadas seguidas o modelo escreveu
   * "Ela aparece em Lucas 19:11-27 e fala de..." no meio da frase: correto pelo
   * contrato de sempre, e sem a passagem na tela, que é o que se queria.
   *
   * Uma instrução sobre ONDE pôr um texto disputa com o hábito de escrever
   * prosa, e perde. Um campo separado não disputa com nada. O servidor a
   * encaixa na resposta (ver `splicePassage` em `biblo/answer.ts`), depois de
   * conferi-la contra a NVI — o modelo continua sem a caneta do texto bíblico.
   */
  passage: z
    .string()
    .nullable()
    .default(null)
    .catch(null)
    .transform((text) => {
      const trimmed = text?.trim() ?? "";
      return trimmed.length > 0 && trimmed.length <= 60 ? trimmed : null;
    }),
  /**
   * O fio: o que já foi conversado ANTES da janela que vai ao modelo,
   * reescrito a cada resposta. É a memória de uma conversa longa sem o custo
   * de reler a conversa longa — ver a janela deslizante em
   * `docs/biblo-implementacao.md` §1.4.
   *
   * Cortado, e não recusado, pelo mesmo motivo dos chips: o fio é memória
   * nossa, e um fio comprido demais não é razão para a pessoa perder a
   * resposta que pagou.
   */
  thread: z
    .string()
    .default("")
    .catch("")
    .transform((text) => text.slice(0, 600)),
  /**
   * O que o Biblo vai FAZER no aplicativo, além de responder. Vazio na
   * esmagadora maioria das mensagens, e sempre vazio fora da superfície `home`
   * — quem apaga é o servidor, não o prompt (ver `generateBibloAnswer`).
   *
   * `z.unknown()` com peneira manual, e não `z.array(BibloActionSchema)`: a
   * régua do arquivo é que nenhum campo derruba uma resposta já paga, e uma
   * ação malformada não pode levar junto a prosa nem a outra ação que veio
   * certa. Ver `parseActions`.
   */
  actions: z.unknown().transform(parseActions).catch([]),
});

export type BibloReply = z.infer<typeof BibloReplySchema>;

export type BibloRole = "user" | "assistant";

/** Como UMA mensagem do usuário foi paga. Espelha o check da migração 0062. */
export type BibloBilling = "gift" | "coins";

/** Uma mensagem, como a gaveta a recebe. */
export type BibloMessage = {
  id: string;
  role: BibloRole;
  content: string;
  chips: string[];
  suggestion: BibloSuggestion | null;
  /**
   * O slug da entrada do léxico cuja IMAGEM acompanha esta resposta, e `null`
   * na esmagadora maioria delas (migração 0065).
   *
   * **É o slug, não o cartão**, e a diferença importa: a gaveta busca a imagem
   * pelo mesmo caminho que o resumo usa quando alguém toca num nome
   * (`/api/lexicon/:slug`, cacheado por sessão no React Query), então reler uma
   * conversa de vinte mensagens não carrega vinte cartões pelo fio. O texto do
   * cartão já está na resposta, em prosa — quem escolheu foi o servidor, ver
   * `entityForAnswer` em `biblo/answer.ts`.
   */
  entitySlug: string | null;
  createdAt: string;
};

/**
 * O que a pessoa pode fazer agora, decidido no servidor.
 *
 * `remaining` só existe no `gift`, e é de propósito: é o único caso em que a
 * gaveta precisa saber que há um fim chegando, para dizer a linha gentil na
 * última mensagem. **Quem paga não recebe número nenhum** — não há nada que a
 * gaveta pudesse fazer com ele além de mostrá-lo, e mostrá-lo é exatamente o
 * que o desenho evita (ver `docs/creditos-na-tela.md`).
 */
export type BibloAllowance =
  | { kind: "coins" }
  | { kind: "gift"; remaining: number }
  | { kind: "denied"; reason: BibloDenial };

export type BibloDenial =
  /** Kill switch: fora para todo mundo, inclusive para o presente. */
  | "disabled"
  /** A conta gratuita usou as mensagens de presente. Reversível assinando. */
  | "gift_exhausted"
  /** Um override do admin revogou para esta pessoa. */
  | "revoked"
  /** Sem saldo. Reversível comprando créditos. */
  | "insufficient_balance";

/** Resposta de `GET /api/biblo?sessionId=`. */
export type BibloConversation = {
  messages: BibloMessage[];
  /** O cumprimento e os chips da abertura, quando a conversa está vazia. */
  opening: { greeting: string; chips: string[] };
  allowance: BibloAllowance;
};

/** Resposta de `POST /api/biblo`. */
export type BibloTurn = {
  /** A pergunta, já gravada. */
  question: BibloMessage;
  answer: BibloMessage;
  allowance: BibloAllowance;
  /** Saldo depois do débito, para a store de moedas não ter de reperguntar. */
  balance: number | null;
  /**
   * O que fazer no aplicativo depois de mostrar a resposta.
   *
   * **Elas não são gravadas na mensagem, e a ausência é escolha.** Uma ação é
   * um acontecimento, não um conteúdo: executada, o que sobra dela é o
   * DOCUMENTO, que está no acervo e é durável. Guardá-las no `biblo_messages`
   * pediria uma coluna e uma migração para reexibir, ao reabrir a conversa, o
   * aviso de uma coisa que já aconteceu.
   */
  actions: BibloAction[];
};

/** Teto do que a pessoa pode digitar. Uma pergunta não é um texto. */
export const BIBLO_MAX_QUESTION_CHARS = 500;

/**
 * O recado falado: fala em vez de digitar, o texto cai no CAMPO.
 *
 * `POST /api/biblo/voice` cobra, transcreve e devolve o texto — nunca escreve
 * na conversa. Quem grava a mensagem de verdade continua sendo `POST
 * /api/biblo`, quando a pessoa envia o texto que voltou. Ver
 * `docs/biblo-implementacao.md` §14.
 */

/**
 * Teto de duração de UM recado falado, em ms.
 *
 * **É o que torna `bibloVoiceMessage` um preço FIXO defensável.** Sem teto o
 * custo de STT de uma mensagem não tem limite superior, o mesmo buraco em que
 * `reprocessSummary` esteve a 5 moedas. Com 60s o pior caso é conhecido antes
 * da chamada. O CLIENTE encerra a gravação sozinho ao alcançar o teto; o
 * servidor tem o dele por trás, um teto de BYTES (`MAX_VOICE_FILE_BYTES` na
 * rota) calibrado para a mesma duração, porque decodificar o áudio para medir
 * a duração de verdade exigiria um binário que o runtime do Next não tem.
 */
export const BIBLO_VOICE_MAX_MS = 60_000;

/**
 * Por que uma tentativa de recado falado não virou texto no campo.
 *
 * **Não tem `gift_exhausted`, e a ausência é a regra, não um esquecimento.**
 * O presente (`BIBLO_GIFT_MESSAGES`) cobre só a mensagem digitada — dez
 * recados falados custariam R$ 0,38 do R$ 1,00 que `INITIAL_COIN_BALANCE` já
 * dá de graça, e a voz é a única ação do Biblo que exige plano pago desde a
 * primeira tentativa. `"plan"` é essa recusa: a mesma que `evaluateFeature`
 * devolve para `biblo_chat` numa conta gratuita, sem o desvio para o
 * presente que `resolveBibloAllowance` abre para o texto.
 */
export type BibloVoiceDenial =
  /** Kill switch: fora para todo mundo. */
  | "disabled"
  /** Um override do admin revogou para esta pessoa. */
  | "revoked"
  /** Conta gratuita: a voz não tem presente, só o plano libera. */
  | "plan"
  /** Sem saldo. Reversível comprando créditos. */
  | "insufficient_balance";

export type BibloVoiceAllowance = { kind: "coins" } | { kind: "denied"; reason: BibloVoiceDenial };

/** Resposta de `POST /api/biblo/voice`. */
export type BibloVoiceTurn =
  | { ok: true; text: string; balance: number | null }
  | { ok: false; error: "biblo_voice_not_available"; reason: BibloVoiceDenial }
  | { ok: false; error: string };
