"use client";

import { ArrowUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoinsStore } from "@/features/coins/store";
import { BibloMessageView } from "@/features/session/components/BibloMessage";
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
import { BibloAvatar } from "@/shared/brand";

const log = createLogger("biblo");

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

  // Rola para o fim a cada mensagem nova. `behavior: "smooth"` de propósito:
  // um salto seco esconde que algo chegou.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pending` não é lido pelo efeito, e é dependência de propósito. O "Pensando…" é uma LINHA A MAIS no fim da lista: ele muda a altura do conteúdo sem mudar o número de mensagens, e sem ele a pergunta recém-enviada fica meia tela acima do rodapé até a resposta chegar.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [conversation?.messages.length, pending]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pending) return;

      setDraft("");
      setPending(true);
      setFailed(false);
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
            setDraft(question);
            setConversation((prev) =>
              prev
                ? { ...prev, allowance: { kind: "denied", reason: body.reason as BibloDenial } }
                : prev
            );
            return;
          }
          setDraft(question);
          setFailed(true);
          return;
        }

        const turn = body as BibloTurn;
        if (typeof turn.balance === "number") setBalance(turn.balance);
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
      <header className="flex items-center gap-2.5 border-scriba-hairline border-b px-4 py-3">
        <BibloAvatar mood={pending ? "thinking" : "idle"} size={30} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] text-scriba-ink">Biblo</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar a conversa"
          className="inline-flex size-8 items-center justify-center rounded-full text-scriba-ink-soft transition-colors hover:bg-scriba-hairline/50 hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
        >
          <X aria-hidden className="size-4.5" strokeWidth={1.75} />
        </button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {conversation === null && !failed && (
          <p className="text-[13px] text-scriba-ink-mute">Abrindo a conversa…</p>
        )}

        {conversation && messages.length === 0 && (
          <div className="flex gap-2.5">
            <BibloAvatar size={28} className="mt-0.5" />
            <p className="min-w-0 flex-1 text-[14px] text-scriba-ink leading-relaxed">
              {conversation.opening.greeting}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <BibloMessageView
            key={message.id}
            message={message}
            onAdd={onInsert ? handleAdd : undefined}
            onUndo={onRemove ? handleUndo : undefined}
            added={addedIds.has(message.id)}
          />
        ))}

        {pending && (
          <div className="flex gap-2.5">
            <BibloAvatar mood="thinking" size={28} className="mt-0.5" />
            <p className="mt-1 text-[13px] text-scriba-ink-mute">Pensando…</p>
          </div>
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
              className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-scriba-surface px-3.5 py-2.5 text-[14px] text-scriba-ink placeholder:text-scriba-ink-mute focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-scriba-ink-mute"
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
