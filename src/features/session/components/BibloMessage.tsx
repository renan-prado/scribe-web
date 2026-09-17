"use client";

import { Check, Copy, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { RichText } from "@/features/session/components/RichText";
import type { BibloMessage as Message } from "@/lib/domain/biblo";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";

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
 */

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

export function BibloMessageView({
  message,
  onAdd,
  onUndo,
  added,
}: {
  message: Message;
  /** `undefined` quando não há para onde inserir (a tela não sabe editar). */
  onAdd?: (message: Message) => void;
  onUndo?: (message: Message) => void;
  added: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-scriba-gold-soft px-3.5 py-2 text-[14px] text-scriba-gold-ink leading-relaxed">
          {message.content}
        </p>
      </div>
    );
  }

  const suggestion = message.suggestion;

  return (
    <div className="flex gap-2.5">
      <BibloAvatar size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="space-y-3 text-[14px] text-scriba-ink leading-relaxed">
          {message.content.split(/\n{2,}/).map((paragraph, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos de um texto imutável, a ordem é estável
            <p key={`p-${index}`}>
              <RichText>{paragraph}</RichText>
            </p>
          ))}
        </div>

        {suggestion && (
          <div className="mt-3 rounded-xl border border-scriba-hairline border-dashed p-3">
            <p className="text-[11px] text-scriba-ink-soft uppercase tracking-wide">
              {suggestion.block.type === "bibleQuote"
                ? "Passagem bíblica"
                : suggestion.block.type === "highlight"
                  ? "Frase de destaque"
                  : suggestion.block.type === "quote"
                    ? "Citação"
                    : suggestion.block.type === "h2"
                      ? "Subtítulo"
                      : suggestion.block.type === "conclusion"
                        ? "Conclusão"
                        : suggestion.block.type === "example"
                          ? "Exemplo"
                          : "Parágrafo"}
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

        <div className="mt-1 flex">
          <CopyButton text={message.content} />
        </div>
      </div>
    </div>
  );
}
