"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitFeedback } from "@/features/feedback/lib/api";
import {
  FEEDBACK_RATING_EMOJI,
  FEEDBACK_RATING_LABEL,
  FEEDBACK_RATINGS,
  FEEDBACK_SURFACE_INTRO,
  FEEDBACK_TOPIC_QUESTION,
  type FeedbackRating,
  type FeedbackSurface,
  type FeedbackTopic,
  MAX_FEEDBACK_COMMENT_CHARS,
} from "@/lib/domain/feedback";
import { cn } from "@/lib/utils";

const PRIMARY_BUTTON = cn(
  "inline-flex h-9 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-5 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] transition-colors",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30",
  "disabled:cursor-not-allowed disabled:opacity-70"
);

const GHOST_BUTTON = cn(
  "inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-medium text-scriba-ink-soft transition-colors",
  "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/30",
  "disabled:cursor-not-allowed disabled:opacity-60"
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: FeedbackSurface;
  topics: readonly FeedbackTopic[];
  /** Ausente no feedback do /profile, que não nasce de pergunta nossa. */
  promptId?: string;
  /** Chamado depois de um envio gravado, hoje, para agradecer e fechar. */
  onSubmitted?: () => void;
};

/**
 * A janela que pergunta a nota.
 *
 * Três decisões desenham tudo o que ela é, e todas vêm da mesma restrição: a
 * pessoa acabou de gerar um resumo e quer LER o resumo, a pergunta é uma
 * interrupção, e uma interrupção que custa caro não é respondida, é fechada.
 *
 * 1. **A nota é um toque, e o texto é opcional.** Quatro chips grandes num
 *    grid resolvem a janela em um gesto. O campo de texto fica abaixo, sem
 *    obrigação nenhuma, quem tem uma frase escreve, quem não tem já
 *    respondeu. Nas três janelas AUTOMÁTICAS ele só entra depois da primeira
 *    nota; no /profile ele já vem aberto, porque lá a pessoa clicou em "Dar
 *    feedback" justamente para escrever. Ver `selfInitiated`.
 * 2. **Só o primeiro tópico começa visível quando há dois.** No modo Ao Vivo
 *    são duas perguntas; mostrá-las juntas faz a janela parecer um
 *    formulário. A segunda entra assim que a primeira é respondida, e o
 *    "enviar" só acende quando as duas têm nota.
 * 3. **Fechar é sempre gratuito, e "Agora não" é um botão de verdade.** Uma
 *    janela cujo único caminho de saída é responder ensina a pessoa a não ler
 *    a próxima; e há mais duas depois desta.
 *
 * O agradecimento não é uma tela nova: é o mesmo corpo, substituído, e a
 * janela fecha sozinha. Um "obrigado!" que exige mais um clique é a piada de
 * pedir feedback sobre o excesso de cliques.
 */
export function FeedbackDialog({
  open,
  onOpenChange,
  surface,
  topics,
  promptId,
  onSubmitted,
}: Props) {
  const [ratings, setRatings] = useState<Partial<Record<FeedbackTopic, FeedbackRating>>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Cada abertura começa limpa. Uma nota antiga na tela faria a pessoa achar
  // que já respondeu, e um agradecimento antigo, que a pergunta não é séria.
  useEffect(() => {
    if (!open) return;
    setRatings({});
    setComment("");
    setSubmitting(false);
    setDone(false);
  }, [open]);

  // Fecha sozinha depois do agradecimento. Ver o cabeçalho.
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => onOpenChange(false), 1600);
    return () => window.clearTimeout(timer);
  }, [done, onOpenChange]);

  // A segunda pergunta só aparece depois de a primeira ter nota, e as
  // anteriores continuam na tela para a pessoa poder mudar de ideia.
  const answeredCount = topics.filter((t) => ratings[t]).length;
  const visibleTopics = topics.slice(0, Math.min(answeredCount + 1, topics.length));
  const complete = answeredCount === topics.length;
  const remaining = MAX_FEEDBACK_COMMENT_CHARS - comment.length;

  /**
   * A janela do /profile foi ABERTA pela pessoa; as outras três a
   * interrompem. É a diferença que decide o que aparece de saída.
   *
   * Nas automáticas o campo de texto só entra depois da primeira nota, com
   * ele aberto, a janela chega parecendo formulário, e o que se quer da
   * maioria é o toque. Aqui é o oposto: quem clicou em "Dar feedback" clicou
   * para ESCREVER, e esconder a caixa atrás de um chip é fazer a pessoa
   * procurar o que ela veio usar.
   */
  const selfInitiated = surface === "general";
  const showComment = selfInitiated || answeredCount > 0;

  async function handleSubmit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    const ok = await submitFeedback({
      promptId,
      answers: topics.map((topic) => ({
        topic,
        // `complete` garante que todos têm nota; o non-null é só o compilador.
        rating: ratings[topic] as FeedbackRating,
      })),
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);
    // Mesmo quando a rede falha, a janela agradece e some. Insistir com um
    // erro cobraria da pessoa o conserto de um problema nosso, num diálogo em
    // que ela estava nos fazendo um favor.
    setDone(true);
    if (ok) onSubmitted?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden className="coin-hex block size-3.5 flex-none bg-scriba-yellow" />
            {done ? "Obrigado!" : "Como foi para você?"}
          </DialogTitle>
          <DialogDescription>
            {done
              ? "Sua resposta chegou aqui. É assim que o Scriba melhora."
              : FEEDBACK_SURFACE_INTRO[surface]}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex items-center gap-3 rounded-2xl bg-scriba-green-soft px-4 py-3.5">
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-scriba-green text-background">
              <Check aria-hidden className="size-4" />
            </span>
            <p className="text-sm leading-snug text-scriba-green-ink">
              Anotado. Pode continuar de onde parou.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {visibleTopics.map((topic) => (
              <fieldset key={topic} className="flex flex-col">
                {/* `mb-3` no lugar de um `gap` no fieldset, e não é preferência:
                    a legend de um fieldset é a "rendered legend" do CSS, ela
                    sai do fluxo normal para ser posicionada na borda de cima da
                    caixa, então NENHUM `gap` do container flex a alcança. Com
                    `gap-2.5` no fieldset, a pergunta ficava colada nos chips e o
                    espaço só aparecia entre os chips. Margem na própria legend é
                    o que o navegador honra. */}
                <legend className="mb-3 text-[13px] font-medium leading-snug text-scriba-ink-strong">
                  {FEEDBACK_TOPIC_QUESTION[topic]}
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FEEDBACK_RATINGS.map((rating) => {
                    const selected = ratings[topic] === rating;
                    return (
                      <button
                        key={rating}
                        type="button"
                        aria-pressed={selected}
                        disabled={submitting}
                        onClick={() => setRatings((prev) => ({ ...prev, [topic]: rating }))}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[12px] font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scriba-blue/40",
                          "disabled:cursor-not-allowed disabled:opacity-60",
                          selected
                            ? "bg-scriba-blue-soft text-scriba-blue-ink ring-2 ring-scriba-blue"
                            : "bg-scriba-surface text-scriba-ink-soft ring-1 ring-scriba-hairline hover:bg-scriba-blue-soft/50"
                        )}
                      >
                        <span aria-hidden className="text-lg leading-none">
                          {FEEDBACK_RATING_EMOJI[rating]}
                        </span>
                        {FEEDBACK_RATING_LABEL[rating]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {/* Ver `showComment`: aberto de saída no /profile, depois da
                primeira nota nas três janelas automáticas. */}
            {showComment ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="feedback-comment"
                  className="text-[12px] font-medium text-scriba-ink-soft"
                >
                  {/* "Mais alguma coisa?" pressupõe que algo já foi dito, e no
                      /profile a caixa é a PRIMEIRA coisa da janela, ali a
                      pergunta seria sobre um contexto que não existe. */}
                  {selfInitiated ? "O que você quer nos contar?" : "Quer contar mais alguma coisa?"}{" "}
                  <span className="font-light text-scriba-ink-mute">(opcional)</span>
                </label>
                <textarea
                  id="feedback-comment"
                  className={cn(
                    "min-h-20 w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none",
                    "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                  value={comment}
                  maxLength={MAX_FEEDBACK_COMMENT_CHARS}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    selfInitiated
                      ? "O que está funcionando bem? O que atrapalha? O que falta?"
                      : "O que funcionou bem? O que atrapalhou?"
                  }
                  disabled={submitting}
                />
                <span
                  className={cn(
                    "self-end text-[11px] tabular-nums",
                    remaining <= 20 ? "text-scriba-cream-accent" : "text-scriba-ink-mute"
                  )}
                >
                  {remaining} caracteres restantes
                </span>
              </div>
            ) : null}
          </div>
        )}

        {done ? null : (
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className={GHOST_BUTTON}
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!complete || submitting}
              className={PRIMARY_BUTTON}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar"
              )}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
