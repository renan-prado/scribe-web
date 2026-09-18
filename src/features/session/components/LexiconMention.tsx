"use client";

import dynamic from "next/dynamic";
import { useMentionDialog } from "@/features/session/components/ChapterMention";
import { useLexiconNav } from "@/features/session/components/LexiconProvider";
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
 * Ela não usa o vocabulário de LINK (cor na letra + pontilhado), que é o da
 * referência bíblica ao lado: dois links de aparência idêntica e destinos
 * diferentes na mesma linha seria uma promessa só para duas coisas. **O que diz
 * que o nome abre algo é ele estar marcado**, porque a partir da migração 0063
 * não existe nome marcado sem cartão — a regra é aprendida no primeiro toque e
 * vale para o resto do produto. Ver `RichText`.
 *
 * No `hover` a faixa ENGROSSA (sobe de 82% para 74%) em vez de mudar de cor.
 * É a mesma tinta, um pouco mais de papel: o realce não vira um segundo estado
 * semântico, e no celular, onde não existe hover, nada se perde.
 *
 * ## A TINTA vem da categoria, e o componente não a conhece
 *
 * Azul é personagem, verde é lugar, e figura citada fica no cinza de sempre. O
 * porquê de cada uma dessas três decisões está no token, em `globals.css`, que
 * é onde toda cor deste repositório mora.
 *
 * Aqui só existe `var(--session-mention-wash)`, uma vez. Quem o reaponta é uma
 * regra CSS presa ao `data-mention` que o botão já escrevia nos dados — então
 * este arquivo continua com uma classe só, e mexer numa opacidade não é um
 * commit em dois lugares.
 *
 * ## DENTRO de um cartão, ela navega em vez de abrir outro
 *
 * Um cartão pode citar outros nomes do léxico — o do Timóteo fala de Paulo, de
 * Listra e de Éfeso —, e abrir um segundo diálogo por cima do primeiro empilha
 * duas caixas sem caminho de volta. Com o `LexiconNav` preenchido, a menção
 * troca o CONTEÚDO do cartão que já está aberto, e ele ganha um voltar.
 *
 * **E o próprio nome não é marcado.** Num cartão do Timóteo, "Timóteo" é texto:
 * marcá-lo ofereceria à pessoa um caminho para onde ela já está.
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
  const nav = useLexiconNav();

  // O próprio nome, dentro do próprio cartão: texto e nada mais.
  if (nav?.self === slug) return <>{text}</>;

  return (
    <>
      <button
        type="button"
        onClick={nav ? () => nav.go(slug) : dialog.show}
        data-mention={category}
        // O rótulo diz o que ACONTECE, não o que a palavra é: quem navega por
        // leitor de tela ouve uma lista de botões, e "Habacuque, personagem
        // bíblico" não distingue um botão de um trecho de texto em negrito.
        aria-label={`Sobre ${text}: ${LEXICON_CATEGORY_LABEL[category].toLowerCase()}`}
        className={MENTION_CLASSES}
      >
        {text}
      </button>
      {/* Sem `nav` a menção é dona do próprio diálogo; com ele, quem desenha é
          o cartão que já está aberto. */}
      {!nav && dialog.hasOpened ? (
        <LexiconCardDialog slug={slug} open={dialog.open} onOpenChange={dialog.setOpen} />
      ) : null}
    </>
  );
}
