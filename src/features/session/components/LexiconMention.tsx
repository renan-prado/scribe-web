"use client";

import dynamic from "next/dynamic";
import { useMentionDialog } from "@/features/session/components/ChapterMention";
import { LEXICON_CATEGORY_LABEL, type LexiconCategory } from "@/lib/domain/lexicon";

/**
 * O nome próprio marcado no meio da prosa: "Habacuque", "Mar Vermelho",
 * "Bonhoeffer". Toca e abre o cartão.
 *
 * ## A faixa, e por que ela continua sendo uma faixa
 *
 * Ela começa em 82% da altura da linha: é um traço SOB as palavras, não um
 * bloco atrás delas. O glifo continua sobre o papel, então o contraste do
 * parágrafo não muda, e o `box-decoration-break` mantém a faixa inteira quando
 * um nome composto quebra entre duas linhas.
 *
 * O desenho é o mesmo de quando a marcação não abria nada, e isso é escolha. A
 * referência bíblica ao lado já usa o vocabulário de link (cor + pontilhado), e
 * dar o mesmo a um nome poria dois links de aparência idêntica e destinos
 * diferentes na mesma linha. **O que diz que o nome abre algo é ele estar
 * marcado**, porque a partir da migração 0063 não existe nome marcado sem
 * cartão: a regra é aprendida no primeiro toque e vale para o resto do
 * produto. Ver `RichText`.
 *
 * No `hover` a faixa ENGROSSA (sobe de 82% para 74%) em vez de mudar de cor.
 * É a mesma tinta, um pouco mais de papel: o realce não vira um segundo estado
 * semântico, e no celular, onde não existe hover, nada se perde.
 *
 * ## O diálogo entra por `dynamic`
 *
 * Mesma razão do `ChapterMention`, e o mesmo comentário vale inteiro: o
 * `BlockRenderer` é usado pela landing, e um import estático até aqui
 * arrastaria o Dialog do base-ui e o React Query para o bundle da primeira
 * página que um anônimo carrega. `ssr: false` porque não há nada a renderizar
 * no servidor antes de alguém clicar.
 */
const LexiconCardDialog = dynamic(
  () => import("@/features/session/components/LexiconCardDialog").then((m) => m.LexiconCardDialog),
  { ssr: false }
);

const MENTION_CLASSES = [
  "cursor-pointer font-medium text-scriba-ink-strong",
  "bg-[linear-gradient(transparent_82%,var(--session-mention-wash)_82%)]",
  "hover:bg-[linear-gradient(transparent_74%,var(--session-mention-wash)_74%)]",
  "[box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
  "rounded-[2px] transition-[background-image] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
].join(" ");

export function LexiconMention({
  slug,
  category,
  text,
}: {
  slug: string;
  category: LexiconCategory;
  /** O que o parágrafo escreveu, que pode ser um APELIDO ("Lutero"). */
  text: string;
}) {
  const dialog = useMentionDialog();

  return (
    <>
      <button
        type="button"
        onClick={dialog.show}
        data-mention={category}
        // O rótulo diz o que ACONTECE, não o que a palavra é: quem navega por
        // leitor de tela ouve uma lista de botões, e "Habacuque, personagem
        // bíblico" não distingue um botão de um trecho de texto em negrito.
        aria-label={`Sobre ${text}: ${LEXICON_CATEGORY_LABEL[category].toLowerCase()}`}
        className={MENTION_CLASSES}
      >
        {text}
      </button>
      {dialog.hasOpened ? (
        <LexiconCardDialog slug={slug} open={dialog.open} onOpenChange={dialog.setOpen} />
      ) : null}
    </>
  );
}
