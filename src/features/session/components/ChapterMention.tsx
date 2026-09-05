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

export function ChapterMention({ reference }: { reference: string }) {
  // DOIS estados, e não um: `hasOpened` decide se o diálogo EXISTE, `open`
  // decide se ele está aberto. Com um só, fechar desmontaria o componente no
  // mesmo quadro em que o base-ui começa a animar a saída, e o diálogo sumiria
  // seco. Depois do primeiro clique ele fica montado — fechado, mas montado.
  const [hasOpened, setHasOpened] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setHasOpened(true);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-scriba-ink-strong px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <BookGlyph className="size-3 border-background" />
        {reference}
      </button>
      {hasOpened ? (
        <ChapterDialog reference={reference} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
