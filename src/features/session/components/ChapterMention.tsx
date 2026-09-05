"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";

/**
 * A menção de capítulo do resumo — "Jonas 1" — como pastilha clicável que
 * abre o capítulo inteiro.
 *
 * Ela existe porque uma referência sem versículo não tem o que citar: o
 * pregador NARROU a passagem em vez de ler, então não há texto na transcrição,
 * e a moldura de citação do `bibleQuote` ficava aberta em volta de nada. A
 * pastilha é a mesma de dentro daquela moldura, de propósito — o que sai é a
 * caixa, não a identidade visual da referência.
 *
 * ## O diálogo entra por `dynamic`, e isso não é adorno
 *
 * `BlockRenderer` é um server component, e a LANDING o reusa exatamente por
 * isso (ver `app/AGENTS.md` e `src/shared/components/LandingMocks.tsx`). Um
 * import estático daqui até `ChapterDialog` arrastaria o Dialog do base-ui e o
 * React Query para o bundle da página que um anônimo carrega primeiro — que é
 * a regressão que aquele documento descreve em detalhe. Com `dynamic`, o
 * diálogo é um chunk à parte, buscado no primeiro clique.
 *
 * `ssr: false` pelo mesmo motivo: não há nada a renderizar no servidor antes
 * de alguém clicar.
 */
const ChapterDialog = dynamic(
  () => import("@/features/session/components/ChapterDialog").then((m) => m.ChapterDialog),
  { ssr: false }
);

/**
 * O par de estados que as duas menções compartilham.
 *
 * São DOIS, e não um: `hasOpened` decide se o diálogo EXISTE, `open` decide se
 * ele está aberto. Com um só, fechar desmontaria o componente no mesmo quadro
 * em que o base-ui começa a animar a saída, e o diálogo sumiria seco. Depois do
 * primeiro clique ele fica montado — fechado, mas montado.
 */
function useMentionDialog() {
  const [hasOpened, setHasOpened] = useState(false);
  const [open, setOpen] = useState(false);
  function show() {
    setHasOpened(true);
    setOpen(true);
  }
  return { hasOpened, open, setOpen, show };
}

export function ChapterMention({ reference }: { reference: string }) {
  const dialog = useMentionDialog();

  return (
    <>
      <button
        type="button"
        onClick={dialog.show}
        className="inline-flex items-center gap-2 rounded-full bg-scriba-ink-strong px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <BookGlyph className="size-3 border-background" />
        {reference}
      </button>
      {dialog.hasOpened ? (
        <ChapterDialog reference={reference} open={dialog.open} onOpenChange={dialog.setOpen} />
      ) : null}
    </>
  );
}

/**
 * A MESMA menção, mas no meio de um parágrafo — o que o `RichText` desenha
 * quando o anotador acha "João 3:16" dentro da prosa de um resumo ou estudo.
 *
 * Mora aqui, e não em arquivo próprio, porque divide o `dynamic()` acima: um
 * segundo `dynamic(() => import(ChapterDialog))` em outro módulo pediria o
 * mesmo chunk por dois caminhos.
 *
 * A pastilha da `ChapterMention` não serve aqui: ela é um BLOCO, com altura e
 * fundo sólido, e no meio de uma linha ela quebraria o ritmo da leitura a cada
 * citação. Uma referência dentro do texto continua sendo texto — muda a cor e
 * ganha o sublinhado pontilhado de "isto abre algo", que é o vocabulário de
 * link que o leitor já tem.
 */
export function InlineScripture({ reference, text }: { reference: string; text: string }) {
  const dialog = useMentionDialog();

  return (
    <>
      <button
        type="button"
        onClick={dialog.show}
        aria-label={`Abrir ${reference} na NVI`}
        className="cursor-pointer rounded-sm font-medium text-session-mention-ink underline decoration-dotted decoration-session-mention-ink/50 underline-offset-[3px] transition-colors hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {text}
      </button>
      {dialog.hasOpened ? (
        <ChapterDialog reference={reference} open={dialog.open} onOpenChange={dialog.setOpen} />
      ) : null}
    </>
  );
}
