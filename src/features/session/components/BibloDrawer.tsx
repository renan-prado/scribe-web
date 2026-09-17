"use client";

import { ArrowUp, MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoinsStore } from "@/features/coins/store";
import {
  BibloBubble,
  BibloMessageView,
  BibloUserBubble,
} from "@/features/session/components/BibloMessage";
import { BibloSelection } from "@/features/session/components/BibloSelection";
import { ListeningDots } from "@/features/session/components/skeletons";
import {
  BIBLO_AT_END,
  BIBLO_MAX_QUESTION_CHARS,
  type BibloAllowance,
  type BibloConversation,
  type BibloDenial,
  type BibloMessage,
  type BibloSuggestion,
  type BibloTurn,
} from "@/lib/domain/biblo";
import type { SummaryBlock } from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";

const log = createLogger("biblo");

/** Uma pausa. Só a coreografia da conversa a usa — ver `THINKING_BEAT_MS`. */
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * O campo de digitar cresce com o texto, até SEIS linhas.
 *
 * Ele era `rows={1}` fixo: quem escrevia uma pergunta de três linhas via a
 * primeira sumir por cima enquanto digitava a terceira, e reler o que se
 * escreveu virava rolar um campo de uma linha. O teto existe porque a gaveta
 * tem altura fixa (85dvh no celular), e um campo sem limite come a conversa
 * que a pessoa está lendo para responder; passando de seis linhas ele rola por
 * dentro, que é onde uma pergunta já deixou de ser pergunta — o teto duro
 * continua sendo `BIBLO_MAX_QUESTION_CHARS`.
 *
 * As três constantes andam JUNTAS com o `className` do `<textarea>`: a altura é
 * calculada em pixels aqui e o `leading-6`/`py-2.5` de lá é o que a torna
 * verdadeira. Mexeu num, confira o outro — a conta silenciosamente erra por
 * uma linha se `leading` mudar.
 */
/**
 * A BATIDA entre a pergunta aparecer e o "Pensando…" aparecer.
 *
 * As duas coisas aconteciam no MESMO quadro, e é isso que tirava a conversa da
 * conversa: ninguém começa a pensar antes de a outra pessoa terminar de falar.
 * A pausa não custa nada a ninguém — a requisição sai no instante zero, o que
 * espera é só o indicador.
 */
const THINKING_BEAT_MS = 400;

/**
 * O tempo MÍNIMO que o "Pensando…" fica na tela antes de a resposta entrar.
 *
 * Com a batida acima, o piso da conversa inteira é 1,1s. Hoje ele quase nunca
 * pega: uma resposta real leva de 3,7 a 4,8 segundos (medido, ver
 * `docs/biblo-implementacao.md` §9). Ele existe para o dia em que pegar — um
 * modelo mais rápido, uma resposta curta — e para o "Pensando…" nunca ser um
 * lampejo de 200ms, que é pior do que não ter indicador nenhum.
 *
 * **É o único atraso que o usuário PAGA**, e por isso é curto e tem teto fixo:
 * ele nunca adia uma resposta que demorou, só uma que chegou cedo demais.
 */
const THINKING_MIN_MS = 700;

const COMPOSER_MAX_LINES = 6;
/** `leading-6` = 1,5rem. */
const COMPOSER_LINE_PX = 24;
/** `py-2.5` nas duas pontas. */
const COMPOSER_PADDING_PX = 20;
const COMPOSER_MAX_PX = COMPOSER_MAX_LINES * COMPOSER_LINE_PX + COMPOSER_PADDING_PX;

/**
 * A gaveta: a conversa por cima do conteúdo, com o resumo atrás.
 *
 * **Ela não é uma tela nova, e o resumo continua visível de propósito**: quem
 * está lendo uma resposta sobre o versículo 14 precisa poder olhar o versículo
 * 14. No celular ela sobe do rodapé (de onde o botão está); no desktop entra
 * pela lateral.
 *
 * **Nada aqui mostra preço.** Não há "1 moeda", não há contador de mensagens,
 * não há barra de progresso do presente. O que a pessoa gastou ela vê no saldo,
 * como em qualquer outra ação do produto — ver `docs/creditos-na-tela.md`. O
 * único número que esta tela conhece é o `remaining` do presente, e ele existe
 * para dizer UMA linha de agradecimento na última mensagem, não para contar.
 *
 * ## A pergunta entra antes da rede (`asking`)
 *
 * A pergunta aparecia junto com a resposta, quatro segundos depois de enviada,
 * e nesses quatro segundos a tela não tinha registro nenhum do que a pessoa
 * fez: o campo esvaziava e nada acontecia. Num chat isso é o app parecendo ter
 * perdido a mensagem, e a reação de quem usa é mandar de novo.
 *
 * `asking` é a pergunta enviada que ainda não tem linha no banco. Ela é a única
 * coisa desta conversa que **não precisa de servidor para ser verdade**: quem
 * escreveu foi a pessoa, e o que o servidor devolve depois é só o id dela. Nos
 * três caminhos de falha ela sai da lista e volta para o campo, onde pode ser
 * reenviada — o otimismo termina onde a certeza termina.
 *
 * ## A rolagem tem TRÊS destinos
 *
 * Ao abrir uma conversa que já existia, o fim da lista, sem animação. Ao
 * enviar, o fim da lista de novo. Ao receber, o **início do balão da resposta**
 * — porque parar no fim de uma resposta de três parágrafos deixa a primeira
 * linha meia tela acima, e a pessoa tem de subir para começar a ler o que
 * acabou de pedir.
 *
 * ## Três portas para o documento, e só uma passa pelo modelo
 *
 * A `suggestion` é a dele. O **"+"** de uma passagem e o **trecho selecionado**
 * são da pessoa, e entram pelo mesmo `onInsert` — um segundo canal até o texto
 * seria uma segunda regra de posição, de desfazer e de salvamento. Ver
 * `BibloAddButton`, `BibloSelection` e `BIBLO_AT_END`.
 */

const DENIAL_COPY: Record<BibloDenial, { text: string; cta?: { label: string; href: string } }> = {
  // O agradecimento, não o aviso de limite. A diferença entre as duas frases
  // não é cosmética: uma fecha a porta, a outra diz que foi bom.
  gift_exhausted: {
    text: "Espero ter ajudado nestas primeiras conversas. O Biblo continua com você nos planos Pessoal e Estudioso.",
    cta: { label: "Ver os planos", href: "/assinar" },
  },
  insufficient_balance: {
    text: "Seus créditos acabaram.",
    cta: { label: "Adicionar créditos", href: "/assinar" },
  },
  disabled: { text: "O Biblo está em manutenção. Volte daqui a pouco." },
  revoked: { text: "O Biblo não está disponível nesta conta." },
};

/**
 * Quantos pixels o ponteiro precisa andar para o gesto deixar de ser um clique.
 *
 * Abaixo disto é a tremida da mão de quem clica, e tratá-la como arrasto faria
 * o chip não responder ao toque.
 */
const DRAG_SLOP_PX = 4;

/**
 * A fileira de sugestões: UMA linha que rola de lado.
 *
 * **Ela era `flex-wrap`, e virou uma parede.** Enquanto os chips eram
 * telegramas de seis palavras, dois cabiam por linha; quando passaram a ser
 * perguntas faladas (ver `prompts/biblo.ts`), cada um ficou quase da largura da
 * tela, quebrou em duas linhas e o conjunto tomou metade da gaveta — empurrando
 * para fora justamente a resposta que as sugestões comentam.
 *
 * Uma linha que rola custa altura FIXA, não importa quantos chips venham nem
 * quão longos sejam. O preço é que o quarto e o quinto ficam fora da tela, e é
 * por isso que a OFERTA vem primeiro (ver `biblo/answer.ts`): numa fileira que
 * rola, "último" quer dizer "invisível".
 *
 * O `-mx-4 px-4` sangra a fileira até as bordas da gaveta: sem isso a rolagem
 * pararia 16px antes de cada lado e o último chip pareceria cortado por um vão
 * em vez de continuar.
 *
 * ## Sem barra de rolagem, e com arrasto no lugar dela
 *
 * A barra esteve aqui e saiu: sob uma fileira de 32px ela pesa mais do que
 * informa, e no Chromium do Windows vinha com as setas de `<`/`>` de brinde
 * (a receita para desligá-las ficou registrada em `globals.css`). Quem diz que
 * há mais coisa à direita é a pastilha cortada na borda, e o cursor de mão
 * aberta.
 *
 * O dedo já empurrava a fileira; com mouse, arrastar com o botão esquerdo faz o
 * mesmo. **Só com mouse** (`pointerType`): no toque o navegador rola
 * nativamente, e somar a nossa conta à dele faria a fileira andar o dobro.
 *
 * ## A CAPTURA SÓ ACONTECE DEPOIS QUE O GESTO VIRA ARRASTO
 *
 * Esta é a linha mais importante do arquivo, e ela custou um clique que não
 * funcionava: **`setPointerCapture` redireciona o `click`.** Capturado o
 * ponteiro, o `pointerdown` e o `pointerup` passam a ter a FILEIRA como alvo, e
 * o navegador dispara o clique no ancestral comum dos dois — a fileira. O
 * `onClick` da pastilha nunca roda. Capturar no `pointerdown`, que é o que todo
 * exemplo de arrastar-para-rolar faz, quebra portanto todos os cliques.
 *
 * Aqui a captura espera o ponteiro andar mais que `DRAG_SLOP_PX`. Um clique
 * nunca chega lá, então ele não passa por nada disto: sem captura, sem
 * `preventDefault`, sem `stopPropagation` — o caminho do clique é o de um
 * `<button>` comum. E o arrasto de verdade captura, o que de quebra já resolve
 * a metade do problema que o `swallowClick` resolvia.
 *
 * ## O defeito da PRIMEIRA tentativa, e as três travas contra ele
 *
 * Havia um arrasto aqui antes, e ele tinha outro defeito: o `pointerup` não
 * desfazia o estado do arrasto — de propósito, porque o `click` vem depois dele
 * e precisava saber que houve arrasto — e a partir daí **todo movimento do
 * mouse sobre a fileira a rolava, sem botão pressionado**.
 *
 * A causa era uma só: um estado que significava DUAS coisas ("estou
 * arrastando" e "houve arrasto"), e que por isso não podia ser limpo na hora
 * certa. Agora são dois campos, e o arrasto morre por três caminhos
 * independentes:
 *
 * 1. `pointerup` e `pointercancel` zeram `drag` — o caminho normal;
 * 2. `pointerdown` zera os dois antes de qualquer guarda, então um gesto novo
 *    nunca herda o anterior;
 * 3. `event.buttons === 0` no `pointermove` desarma sozinho um arrasto que
 *    ficou vivo porque o `pointerup` não chegou (o botão soltou fora da
 *    janela, um diálogo do navegador comeu o evento). **É esta que fecha
 *    exatamente o buraco de antes**, e ela vale mesmo que as outras duas
 *    falhem.
 */
function Chips({
  chips,
  onPick,
  disabled,
}: {
  chips: string[];
  onPick: (chip: string) => void;
  disabled: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // "Estou arrastando AGORA". Em `ref` e não em estado: muda a cada
  // `pointermove` e nada na tela depende do valor.
  const drag = useRef<{ startX: number; startLeft: number; captured: boolean } | null>(null);
  // "O gesto que acabou foi um arrasto" — separado do de cima porque vive mais
  // que ele: o `click` só chega depois do `pointerup`. Foi juntar os dois num
  // campo só que criou o defeito descrito no cabeçalho.
  const swallowClick = useRef(false);

  if (chips.length === 0) return null;

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (row?.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  return (
    <div
      ref={rowRef}
      className="scroll-row -mx-4 flex cursor-grab select-none gap-1.5 overflow-x-auto px-4 active:cursor-grabbing"
      onPointerDown={(event) => {
        drag.current = null;
        swallowClick.current = false;
        const row = rowRef.current;
        if (event.pointerType !== "mouse" || event.button !== 0 || !row) return;
        // Nada a arrastar quando tudo já cabe: sem isto, um clique numa fileira
        // curta viraria um arrasto de zero pixel com cara de travada.
        if (row.scrollWidth <= row.clientWidth) return;
        // Note que NÃO se captura o ponteiro aqui: enquanto isto for um
        // clique, ele tem de seguir o caminho normal até a pastilha. Ver o
        // cabeçalho.
        drag.current = { startX: event.clientX, startLeft: row.scrollLeft, captured: false };
      }}
      onPointerMove={(event) => {
        const row = rowRef.current;
        if (!drag.current || !row) return;
        if (event.buttons === 0) {
          drag.current = null;
          return;
        }
        const dx = event.clientX - drag.current.startX;
        if (!drag.current.captured) {
          // Ainda pode ser um clique: não rola nada e não captura nada. Três
          // pixels de rolagem não se veem, e a captura antes da hora é o que
          // matava o clique.
          if (Math.abs(dx) <= DRAG_SLOP_PX) return;
          drag.current.captured = true;
          swallowClick.current = true;
          // Agora sim: é a captura que faz o arrasto continuar quando o
          // ponteiro sai da fileira — o caso normal, porque ela tem 32px de
          // altura.
          row.setPointerCapture(event.pointerId);
        }
        row.scrollLeft = drag.current.startLeft - dx;
      }}
      onPointerUp={endDrag}
      onPointerCancel={(event) => {
        endDrag(event);
        swallowClick.current = false;
      }}
      // Na CAPTURA, antes de o clique chegar à pastilha: é aqui que o arrasto
      // que terminou sobre um chip deixa de virar uma pergunta enviada.
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="shrink-0 cursor-[inherit] whitespace-nowrap rounded-full border border-scriba-hairline px-3 py-1.5 text-[12px] text-scriba-ink-soft transition-colors hover:border-scriba-ink-mute hover:text-scriba-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function BibloDrawer({
  sessionId,
  ensureSession,
  onClose,
  onThinking,
  onInsert,
  onRemove,
}: {
  sessionId: string;
  /** Ver `BibloDock`. Ausente onde a sessão já existe (`/summary/:id`). */
  ensureSession?: () => Promise<string | null>;
  onClose: () => void;
  /** Avisa o botão flutuante para ele pensar junto, com a gaveta fechada. */
  onThinking: (thinking: boolean) => void;
  /**
   * Insere a sugestão no texto. `undefined` quando a tela não sabe editar —
   * aí a conversa continua servindo, só sem o "Adicionar".
   */
  onInsert?: (suggestion: BibloSuggestion) => void;
  onRemove?: (suggestion: BibloSuggestion) => void;
}) {
  const [conversation, setConversation] = useState<BibloConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  // Separado do `pending`: aquele é "a requisição está no ar" e governa o que
  // fica desabilitado (tem de ser imediato, senão dois cliques mandam duas
  // perguntas); este é só o balão do "Pensando…", que entra uma batida depois.
  const [showThinking, setShowThinking] = useState(false);
  const [failed, setFailed] = useState(false);
  // A pergunta enviada que ainda nao tem linha no banco. Ver o cabecalho.
  const [asking, setAsking] = useState<string | null>(null);
  // O id da ultima resposta que CHEGOU nesta sessao de tela. So ela anima, e
  // so ate ela e que a rolagem sobe.
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const setBalance = useCoinsStore((s) => s.setBalance);

  useEffect(() => {
    let alive = true;
    fetch(`/api/biblo?sessionId=${sessionId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: BibloConversation) => {
        if (alive) setConversation(body);
      })
      .catch((error: unknown) => {
        log.error("não consegui abrir a conversa", { error: String(error) });
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Ao ABRIR uma conversa que já existia, o fim da lista.
  //
  // A gaveta abria no COMEÇO, que é o começo de uma conversa de semanas atrás:
  // quem reabre quer a última coisa que foi dita, não a primeira — e os chips
  // do rodapé são os da última resposta, então a tela mostrava o fim da conversa
  // embaixo e o início dela em cima, dois pontos do fio ao mesmo tempo.
  //
  // Sem `smooth`, ao contrário das outras duas rolagens: aqui não houve evento
  // nenhum para acompanhar, este é o lugar onde a lista NASCE. Uma animação
  // subindo a conversa inteira no instante da abertura anuncia um movimento que
  // ninguém fez.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !conversation || conversation.messages.length === 0) return;
    list.scrollTop = list.scrollHeight;
  }, [conversation]);

  // Enquanto a pergunta esta no ar, o fim da lista e o lugar certo: a pergunta
  // recem-enviada e o "Pensando..." sao as duas ultimas coisas, e a pessoa quer
  // ver as duas. `behavior: "smooth"` de proposito, um salto seco esconde que
  // algo aconteceu.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `showThinking` não é LIDO pelo efeito, e é dependência de propósito — o "Pensando…" é uma LINHA A MAIS que chega uma batida depois da pergunta, e sem ela o balão nasceria abaixo da dobra numa conversa que já rolava.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !asking) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [asking, showThinking]);

  // Quando a resposta chega, o fim da lista e o lugar ERRADO: numa resposta de
  // tres paragrafos o rodape dela fica na tela e a primeira linha, meia tela
  // acima, e a pessoa tem de subir para comecar a ler. A rolagem para no INICIO
  // do balao, que e onde a leitura comeca.
  //
  // `getBoundingClientRect` e nao `offsetTop`: `offsetTop` e medido contra o
  // ancestral POSICIONADO, e a lista nao e um. Sem posicionar a lista so para
  // este calculo, a conta relativa entre os dois retangulos e a que nao mente.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !arrivedId) return;
    const answer = list.querySelector<HTMLElement>(`[data-biblo-answer="${arrivedId}"]`);
    if (!answer) return;
    const top =
      list.scrollTop + answer.getBoundingClientRect().top - list.getBoundingClientRect().top;
    // A folga de 12px e a mesma do padding da lista: encostar o balao no topo
    // faz ele parecer cortado.
    list.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
  }, [arrivedId]);

  // A altura acompanha o conteúdo. `auto` primeiro porque `scrollHeight` nunca
  // ENCOLHE sozinho: sem zerar antes, apagar uma linha deixaria o campo do
  // tamanho que ele teve na maior vez.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `draft` não é LIDO aqui — quem tem o texto é o DOM —, e é exatamente por isso que ele precisa estar na lista: é o único sinal de que o conteúdo mudou e a altura precisa ser remedida.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pending) return;

      setDraft("");
      setPending(true);
      setFailed(false);
      // A pergunta entra na tela AGORA, antes de a rede saber dela. Ela e a
      // unica coisa desta conversa que nao precisa de servidor nenhum para ser
      // verdade: a pessoa acabou de escreve-la.
      setAsking(question);
      onThinking(true);

      const startedAt = Date.now();
      const beat = window.setTimeout(() => setShowThinking(true), THINKING_BEAT_MS);
      try {
        // O texto na tela vai para o banco ANTES da pergunta. Na primeira ela
        // cria a linha (sem ela o POST responderia 404); nas seguintes ela é o
        // que faz o Biblo ler no servidor o que a pessoa está vendo, e não o
        // texto de duas frases atrás. Ver `escrever/Composer.tsx`.
        const id = ensureSession ? await ensureSession() : sessionId;
        if (!id) {
          // O salvamento falhou (rede). Perguntar assim mesmo cobraria por uma
          // resposta sobre um texto que o servidor não tem.
          setAsking(null);
          setDraft(question);
          setFailed(true);
          return;
        }

        const res = await fetch("/api/biblo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: id, text: question }),
        });
        const body = (await res.json().catch(() => ({}))) as Partial<BibloTurn> & {
          error?: string;
          reason?: BibloDenial;
        };

        if (!res.ok) {
          // 402/403 não são falha: são a resposta de "não dá mais". O rodapé
          // troca de estado e a pergunta volta para o campo, para a pessoa não
          // perder o que escreveu.
          if (body.reason) {
            setAsking(null);
            setDraft(question);
            setConversation((prev) =>
              prev
                ? { ...prev, allowance: { kind: "denied", reason: body.reason as BibloDenial } }
                : prev
            );
            return;
          }
          setAsking(null);
          setDraft(question);
          setFailed(true);
          return;
        }

        const turn = body as BibloTurn;
        if (typeof turn.balance === "number") setBalance(turn.balance);
        // A ordem importa: a linha real entra na lista no MESMO render em que o
        // balao otimista sai, senao a pergunta pisca.
        // A espera pelo piso acontece AQUI, com a resposta já em mãos: o que
        // se segura é a entrada dela na tela, nunca a chamada.
        const elapsed = Date.now() - startedAt;
        const floor = THINKING_BEAT_MS + THINKING_MIN_MS;
        if (elapsed < floor) await sleep(floor - elapsed);

        setAsking(null);
        setArrivedId(turn.answer.id);
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, turn.question, turn.answer],
                allowance: turn.allowance,
              }
            : prev
        );
      } catch (error) {
        log.error("não consegui enviar", { error: String(error) });
        setAsking(null);
        setDraft(question);
        setFailed(true);
      } finally {
        window.clearTimeout(beat);
        setShowThinking(false);
        setPending(false);
        onThinking(false);
      }
    },
    [pending, sessionId, ensureSession, onThinking, setBalance]
  );

  const allowance: BibloAllowance = conversation?.allowance ?? { kind: "coins" };
  const blocked = allowance.kind === "denied";
  const messages = conversation?.messages ?? [];
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
  const chips = lastAnswer ? lastAnswer.chips : (conversation?.opening.chips ?? []);

  const handleAdd = (message: BibloMessage) => {
    if (!message.suggestion || !onInsert) return;
    onInsert(message.suggestion);
    setAddedIds((prev) => new Set(prev).add(message.id));
  };

  // As inserções que NÃO vêm do modelo: o "+" de uma passagem e o trecho
  // selecionado. Elas viram a mesma `BibloSuggestion` que o resto do caminho já
  // sabe inserir e desfazer — um segundo canal até o documento seria uma
  // segunda regra de posição, de desfazer e de salvamento. O que muda é só o
  // `afterIndex`: aqui não há posição proposta, e o fim é a resposta certa
  // (ver `BIBLO_AT_END`).
  const insertBlock = (block: SummaryBlock) => {
    onInsert?.({ label: "Adicionar ao resumo", block, afterIndex: BIBLO_AT_END });
  };
  const removeBlock = (block: SummaryBlock) => {
    onRemove?.({ label: "Adicionar ao resumo", block, afterIndex: BIBLO_AT_END });
  };

  const handleUndo = (message: BibloMessage) => {
    if (!message.suggestion || !onRemove) return;
    onRemove(message.suggestion);
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.delete(message.id);
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Conversa com o Biblo"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl bg-scriba-paper shadow-[0_-8px_40px_var(--scriba-shadow)] ring-1 ring-scriba-hairline",
        "animate-v2-rec-in",
        // No desktop ela é uma coluna à direita, de altura cheia: ali há espaço
        // ao lado do texto, e cobrir o rodapé de uma tela larga esconderia o
        // resumo em vez de ficar ao lado dele.
        "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-(--biblo-drawer-w) md:rounded-none md:rounded-l-3xl"
      )}
    >
      {/* O cabeçalho, do tamanho do que ele tem a dizer.

          Ele tinha o rosto do Biblo, o nome dele e um fio embaixo. O ROSTO
          saiu: ele se repete em cada balão de resposta, e ali ele faz
          trabalho — diz de quem é a fala. Em cima, ao lado do nome, ele só
          repetia. O fio saiu junto: o que separa esta linha da conversa é o
          espaço.

          **O nome ficou, na Poppins da marca, e com MAIÚSCULA.** A caixa baixa
          é do logotipo do `ScribaLogo`, onde "scriba" é a marca; aqui a palavra
          é o nome de alguém com quem se conversa, e nome de gente começa com
          maiúscula. É também o que impede a gaveta de abrir sem dizer o que ela
          é — a conversa pode estar vazia, e um × sozinho no canto não é
          cabeçalho, é um botão perdido.

          O fechar nunca foi redundante: sem ele a gaveta não fecha, porque o
          botão flutuante sai da tela enquanto ela está aberta.

          **O balão de conversa ao lado do nome NÃO é o rosto de volta.** O
          rosto foi tirado daqui porque ele tem trabalho a fazer três linhas
          abaixo, em cada resposta, e repeti-lo em cima confunde quem é quem
          numa gaveta que pode estar vazia. Este glifo diz outra coisa: não
          QUEM fala, mas O QUE isto é — uma conversa. É a mesma função do
          microfone no gravador e do livro na pastilha de referência, e é o que
          dá ao cabeçalho a mesma anatomia das outras telas do app.

          Ele é `aria-hidden`: o nome ao lado já diz tudo, e um segundo rótulo
          faria o leitor de tela anunciar "conversa Biblo". */}
      <div className="flex items-center justify-between py-2 pr-2 pl-4">
        <span
          className="inline-flex items-center gap-2 font-semibold text-[15px] text-scriba-ink-soft leading-none"
          style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
        >
          <MessageCircle aria-hidden className="size-4" strokeWidth={1.75} />
          Biblo
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar a conversa"
          className="inline-flex size-10 items-center justify-center rounded-full text-scriba-ink-soft transition-colors hover:bg-scriba-hairline/50 hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
        >
          <X aria-hidden className="size-4.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* A abertura, no MEIO da gaveta e sem frase.

          Era "Abrindo a conversa…" no canto superior esquerdo: uma linha de
          texto solta no alto de uma área vazia, que lê como uma mensagem sem
          balão — justamente o que a gaveta inteira não é. Os três pontos são o
          gesto que qualquer um reconhece num chat, e ficam onde o olho já está:
          no centro.

          **O `py-16` é o que faz ele existir.** `flex-1` reparte a altura que
          SOBRA, e a gaveta não tem altura própria: `max-h-[85dvh]` só põe um
          teto, quem dá a altura é o conteúdo. Com um filho sem altura
          intrínseca não sobrava nada para repartir, e no celular a gaveta abria
          rasa, com os três pontos espremidos debaixo do cabeçalho. O padding dá
          a ela mais ou menos a altura do cumprimento que está chegando — então
          a gaveta abre do tamanho certo e não pula quando o texto entra.

          `items-center` continua fazendo o trabalho no desktop, onde a coluna é
          de altura cheia e aí sim sobra espaço para centrar dentro. */}
      {conversation === null && !failed ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-16">
          <ListeningDots label="Abrindo a conversa" className="pt-0" />
        </div>
      ) : (
        <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-1 pb-4">
          {conversation && messages.length === 0 && (
            <BibloBubble>{conversation.opening.greeting}</BibloBubble>
          )}

          {messages.map((message) => (
            <BibloMessageView
              key={message.id}
              message={message}
              onAdd={onInsert ? handleAdd : undefined}
              onUndo={onRemove ? handleUndo : undefined}
              onAddBlock={onInsert ? insertBlock : undefined}
              onRemoveBlock={onRemove ? removeBlock : undefined}
              added={addedIds.has(message.id)}
              animate={message.id === arrivedId}
            />
          ))}

          {asking && <BibloUserBubble text={asking} />}

          {showThinking && (
            <BibloBubble mood="thinking">
              <span className="text-[13px] text-scriba-ink-mute">Pensando…</span>
            </BibloBubble>
          )}

          {/* O aviso de falha, LEGÍVEL.
              `--scriba-rose` (#3A2321) é a SUPERFÍCIE vermelha — o fundo de um
              cartão de erro —, e estava aqui como cor de TEXTO: vermelho quase
              preto sobre o papel escuro da gaveta, que é onde a mensagem some
              justamente na hora em que ela precisa ser lida. A tinta da família
              é `--scriba-rose-body` (#D9A9A4), a mesma que o resto do app usa
              para corpo de texto em vermelho. */}
          {failed && (
            <p className="text-[13px] text-scriba-rose-body">
              Não consegui responder agora. Tente de novo.
            </p>
          )}
        </div>
      )}

      <BibloSelection
        listRef={listRef}
        onAdd={onInsert ? (text) => insertBlock({ type: "paragraph", text }) : undefined}
      />

      <div className="space-y-3 border-scriba-hairline border-t px-4 pt-3 pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]">
        {!blocked && <Chips chips={chips} onPick={send} disabled={pending} />}

        {allowance.kind === "gift" && allowance.remaining === 0 && (
          <p className="text-[12px] text-scriba-ink-soft leading-relaxed">
            Espero ter ajudado nestas primeiras conversas — foram por nossa conta.
          </p>
        )}

        {blocked ? (
          <div className="space-y-2 pb-1">
            <p className="text-[13px] text-scriba-ink-soft leading-relaxed">
              {DENIAL_COPY[allowance.reason].text}
            </p>
            {DENIAL_COPY[allowance.reason].cta && (
              <a
                href={DENIAL_COPY[allowance.reason].cta?.href}
                className="inline-flex items-center rounded-full bg-[image:var(--scriba-cta)] px-4 py-2 font-medium text-[13px] text-scriba-cta-ink scriba-cta"
              >
                {DENIAL_COPY[allowance.reason].cta?.label}
              </a>
            )}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, BIBLO_MAX_QUESTION_CHARS))}
              onKeyDown={(event) => {
                // Enter envia, Shift+Enter quebra linha — a mesma convenção do
                // editor de blocos (`escrever/Composer.tsx`).
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              placeholder="Pergunte alguma coisa…"
              aria-label="Sua pergunta"
              className="flex-1 resize-none overflow-y-auto rounded-2xl bg-scriba-surface px-3.5 py-2.5 text-[14px] text-scriba-ink leading-6 placeholder:text-scriba-ink-mute focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-scriba-ink-mute"
            />
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              aria-label="Enviar"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-scriba-ink text-scriba-paper transition disabled:opacity-40 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
            >
              <ArrowUp aria-hidden className="size-5" strokeWidth={2} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
