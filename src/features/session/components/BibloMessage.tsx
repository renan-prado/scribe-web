"use client";

import { Check, Copy, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { RichText } from "@/features/session/components/RichText";
import type { BibloMessage as Message } from "@/lib/domain/biblo";
import { cn } from "@/lib/utils";
import { BibloAvatar, type BibloMood } from "@/shared/brand";

/**
 * Uma mensagem da conversa.
 *
 * **A resposta usa o `RichText` do resumo**, e isso não é reaproveitamento por
 * economia: é o que faz a referência bíblica no meio da prosa virar link e
 * abrir a NVI local, exatamente como no resumo e no estudo. O modelo escreve só
 * a REFERÊNCIA (o servidor apaga a que não existe, ver `biblo/answer.ts`), e
 * quem mostra o texto do versículo é sempre a Bíblia em disco. Em nenhum ponto
 * o modelo tem a caneta do texto bíblico.
 *
 * **"Copiar" e "Adicionar" têm o mesmo peso visual, de propósito.** Nem tudo
 * vira bloco: às vezes o parágrafo vai para o caderno, para o WhatsApp do
 * grupo, para um slide. Fazer do copiar o caminho de segunda classe seria
 * empurrar para dentro do texto o que a pessoa queria levar para fora.
 *
 * ## Os dois lados são BALÃO, e a cor de cada um é uma decisão
 *
 * A resposta do Biblo já foi texto solto ao lado de um avatar, e o que se lia
 * ali não era conversa: era um documento com uma carinha do lado. Hoje os dois
 * lados têm balão, e é o que faz o olho saber de quem é cada linha antes de
 * ler qualquer uma delas.
 *
 * | quem | superfície | canto aparado |
 * |---|---|---|
 * | Biblo | `--secondary`, o degrau de realce que o app já usa | superior esquerdo |
 * | quem pergunta | `--biblo-bubble-me`, o azul do rosto dele | inferior direito |
 *
 * **O canto aparado aponta para a origem da fala**, e é ele que faz um
 * retângulo arredondado virar balão: o do Biblo encosta no rosto dele, que está
 * em cima e à esquerda; o de quem pergunta encosta no canto de onde ela
 * escreveu. Um raio uniforme nos quatro cantos lê como cartão, não como fala.
 *
 * **O balão de quem pergunta já foi âmbar**, o da família da MOEDA, e âmbar
 * sobre fundo escuro lê como aviso: a própria pergunta da pessoa parecia algo
 * que precisava de atenção. O azul não carrega estado nenhum no produto, e
 * amarra a conversa ao personagem em vez de amarrá-la ao preço.
 *
 * ## A cascata de entrada não é digitação
 *
 * Sem streaming (`AGENTS.md`), a resposta chega INTEIRA de um quadro para o
 * outro, e um bloco de texto que simplesmente aparece não diz de onde veio. Os
 * parágrafos entram com `animate-biblo-in` e um atraso crescente **com teto**:
 * sem o teto, uma resposta de sete parágrafos faria a pessoa esperar por um
 * texto que já está em mãos — o defeito do streaming, copiado de graça por um
 * efeito que existe para o contrário.
 */

/** A cascata: o passo entre parágrafos e o teto dela. Ver o cabeçalho. */
const STAGGER_STEP_MS = 60;
const STAGGER_MAX_MS = 240;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          })
          // Área de transferência bloqueada (contexto inseguro, permissão
          // negada): o botão não confirma, e nada mais acontece. Um erro na
          // tela para um copiar que falhou custa mais atenção do que vale.
          .catch(() => {});
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-scriba-ink-soft transition-colors hover:bg-scriba-hairline/50 hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
    >
      {copied ? (
        <Check aria-hidden className="size-3.5" strokeWidth={2} />
      ) : (
        <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

const BLOCK_LABEL: Record<string, string> = {
  bibleQuote: "Passagem bíblica",
  highlight: "Frase de destaque",
  quote: "Citação",
  h2: "Subtítulo",
  conclusion: "Conclusão",
  example: "Exemplo",
  paragraph: "Parágrafo",
};

/**
 * O balão de quem pergunta.
 *
 * Exportado porque a pergunta OTIMISTA — a que aparece no instante do envio,
 * antes de existir linha no banco — é exatamente esta, sem id. Ver o cabeçalho
 * de `BibloDrawer`.
 *
 * `whitespace-pre-wrap` porque o campo aceita Shift+Enter: quebrar a pergunta
 * em duas linhas e vê-las coladas de volta é o app desfazendo o que a pessoa
 * acabou de fazer.
 */
export function BibloUserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-biblo-bubble-me px-3.5 py-2 text-[14px] text-biblo-bubble-me-ink leading-relaxed">
        {text}
      </p>
    </div>
  );
}

/**
 * O balão do Biblo, vazio, com o rosto ao lado.
 *
 * Exportado porque o cumprimento da abertura e o "Pensando…" são a mesma
 * moldura sem resposta atrás: três cópias do par avatar + balão desencontrariam
 * na primeira mudança de raio, de cor ou de espaçamento.
 */
export function BibloBubble({
  children,
  mood = "idle",
}: {
  children: React.ReactNode;
  /**
   * `thinking` no balão do "Pensando…". Com o cabeçalho fora, este rosto é o
   * único sinal DENTRO da gaveta de que a resposta está a caminho — o outro é
   * o botão flutuante, que só se vê com a gaveta fechada.
   */
  mood?: BibloMood;
}) {
  return (
    <div className="flex gap-2.5">
      <BibloAvatar mood={mood} size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5 text-[14px] text-scriba-ink leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export function BibloMessageView({
  message,
  onAdd,
  onUndo,
  added,
  animate = false,
}: {
  message: Message;
  /** `undefined` quando não há para onde inserir (a tela não sabe editar). */
  onAdd?: (message: Message) => void;
  onUndo?: (message: Message) => void;
  added: boolean;
  /**
   * Só a resposta que ACABOU de chegar anima. Reabrir a gaveta amanhã é ler
   * uma conversa guardada, e ver dez respostas antigas entrando em cascata
   * seria o app fingindo que elas estão chegando agora.
   */
  animate?: boolean;
}) {
  if (message.role === "user") return <BibloUserBubble text={message.content} />;

  const suggestion = message.suggestion;
  const paragraphs = message.content.split(/\n{2,}/);

  return (
    <div className="flex gap-2.5">
      <BibloAvatar size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {/* `data-biblo-answer` é o que a gaveta procura para rolar até o INÍCIO
            desta resposta. Ver o efeito de rolagem em `BibloDrawer`. */}
        <div
          data-biblo-answer={message.id}
          className="max-w-[92%] rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5"
        >
          <div className="space-y-3 text-[14px] text-scriba-ink leading-relaxed">
            {paragraphs.map((paragraph, index) => (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos de um texto imutável, a ordem é estável
                key={`p-${index}`}
                className={cn(animate && "animate-biblo-in")}
                style={
                  animate
                    ? { animationDelay: `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms` }
                    : undefined
                }
              >
                <RichText>{paragraph}</RichText>
              </p>
            ))}
          </div>

          {suggestion && (
            <div className="mt-3 rounded-xl border border-scriba-hairline border-dashed p-3">
              <p className="text-[11px] text-scriba-ink-soft uppercase tracking-wide">
                {BLOCK_LABEL[suggestion.block.type] ?? "Parágrafo"}
              </p>
              <p className="mt-1 text-[13px] text-scriba-ink leading-relaxed">
                {suggestion.block.type === "bibleQuote"
                  ? suggestion.block.reference
                  : suggestion.block.text}
              </p>
              {onAdd && (
                <button
                  type="button"
                  onClick={() => (added ? onUndo?.(message) : onAdd(message))}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[12px] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute",
                    added
                      ? "bg-scriba-hairline/60 text-scriba-ink-soft hover:text-scriba-ink"
                      : "bg-scriba-ink text-scriba-paper hover:brightness-110"
                  )}
                >
                  {added ? (
                    <>
                      <Undo2 aria-hidden className="size-3.5" strokeWidth={1.75} />
                      Remover
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden className="size-3.5" strokeWidth={2} />
                      {suggestion.label}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-1 flex">
          <CopyButton text={message.content} />
        </div>
      </div>
    </div>
  );
}
