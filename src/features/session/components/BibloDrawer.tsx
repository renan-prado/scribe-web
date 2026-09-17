"use client";

import { ArrowUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoinsStore } from "@/features/coins/store";
import {
  BibloBubble,
  BibloMessageView,
  BibloUserBubble,
} from "@/features/session/components/BibloMessage";
import {
  BIBLO_MAX_QUESTION_CHARS,
  type BibloAllowance,
  type BibloConversation,
  type BibloDenial,
  type BibloMessage,
  type BibloSuggestion,
  type BibloTurn,
} from "@/lib/domain/biblo";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";

const log = createLogger("biblo");

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
 * ## A rolagem tem DOIS destinos
 *
 * Ao enviar, o fim da lista. Ao receber, o **início do balão da resposta** —
 * porque parar no fim de uma resposta de três parágrafos deixa a primeira linha
 * meia tela acima, e a pessoa tem de subir para começar a ler o que acabou de
 * pedir.
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

function Chips({
  chips,
  onPick,
  disabled,
}: {
  chips: string[];
  onPick: (chip: string) => void;
  disabled: boolean;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="rounded-full border border-scriba-hairline px-3 py-1.5 text-[12px] text-scriba-ink-soft transition-colors hover:border-scriba-ink-mute hover:text-scriba-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function BibloDrawer({
  sessionId,
  onClose,
  onThinking,
  onInsert,
  onRemove,
}: {
  sessionId: string;
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

  // Enquanto a pergunta esta no ar, o fim da lista e o lugar certo: a pergunta
  // recem-enviada e o "Pensando..." sao as duas ultimas coisas, e a pessoa quer
  // ver as duas. `behavior: "smooth"` de proposito, um salto seco esconde que
  // algo aconteceu.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !asking) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [asking]);

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
      try {
        const res = await fetch("/api/biblo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, text: question }),
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
        setPending(false);
        onThinking(false);
      }
    },
    [pending, sessionId, onThinking, setBalance]
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
        "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-3xl"
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
          botão flutuante sai da tela enquanto ela está aberta. */}
      <div className="flex items-center justify-between py-2 pr-2 pl-4">
        <span
          className="font-semibold text-[15px] text-scriba-ink-soft leading-none"
          style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
        >
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

      <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-1 pb-4">
        {conversation === null && !failed && (
          <p className="text-[13px] text-scriba-ink-mute">Abrindo a conversa…</p>
        )}

        {conversation && messages.length === 0 && (
          <BibloBubble>{conversation.opening.greeting}</BibloBubble>
        )}

        {messages.map((message) => (
          <BibloMessageView
            key={message.id}
            message={message}
            onAdd={onInsert ? handleAdd : undefined}
            onUndo={onRemove ? handleUndo : undefined}
            added={addedIds.has(message.id)}
            animate={message.id === arrivedId}
          />
        ))}

        {asking && <BibloUserBubble text={asking} />}

        {pending && (
          <BibloBubble mood="thinking">
            <span className="text-[13px] text-scriba-ink-mute">Pensando…</span>
          </BibloBubble>
        )}

        {failed && (
          <p className="text-[13px] text-scriba-rose">
            Não consegui responder agora. Tente de novo.
          </p>
        )}
      </div>

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
