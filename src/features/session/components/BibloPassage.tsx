"use client";

import { useState } from "react";
import { BibloAddButton } from "@/features/session/components/BibloAddButton";
import { ChapterMention } from "@/features/session/components/ChapterMention";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import { formatPassageRange, parseVerseReference } from "@/lib/domain/reference";
import type { SummaryBlock } from "@/lib/domain/summary";

/**
 * A passagem ABERTA dentro da conversa: a referência que o Biblo deixou
 * sozinha numa linha vira o texto da NVI ali mesmo, entre o parágrafo que a
 * apresenta e o que a comenta.
 *
 * ## Por que ela existe
 *
 * O Biblo explicava a parábola das dez minas e escrevia "Lucas 19" — um link,
 * e nada mais. Quem conversa sobre um texto bíblico quer VER o texto bíblico;
 * obrigar um toque, um diálogo por cima da conversa e um voltar para ler três
 * versículos é pedir que a pessoa saia da conversa para acompanhá-la. Numa
 * conversa sobre a Bíblia, mostrar a passagem é o padrão, não o extra.
 *
 * ## Dentro do balão, e não num balão próprio
 *
 * A ideia natural é "um balão, os versículos, outro balão". Ela é a certa
 * VISUALMENTE, e é o que se vê: parágrafo, passagem, parágrafo. Mas fatiar a
 * resposta em três mensagens custaria caro em todo o resto — uma mensagem é uma
 * linha no banco, é o que o "Copiar" copia, é onde a sugestão se prende e é o
 * âncora da rolagem até o início da resposta. Três balões seriam três de tudo
 * isso para uma fala só. Aqui a resposta continua sendo UMA, e o respiro vem do
 * painel, que tem superfície própria dentro do balão.
 *
 * ## O modelo continua sem a caneta do texto bíblico
 *
 * Ele escreve a REFERÊNCIA; o versículo vem da NVI em disco, por `/api/verse`,
 * exatamente como no resumo e no estudo (ver a regra 1 do prompt e
 * `biblo/answer.ts`). Este componente não muda essa invariante — ele só mostra
 * mais cedo o que já era buscado no clique.
 *
 * Referência que não resolve fica como a PASTILHA sozinha, que é clicável e
 * abre o capítulo: uma faixa inventada vira uma menção, nunca um erro na cara
 * de quem lê.
 */

/**
 * Quantos versículos aparecem antes do "mostrar o resto".
 *
 * Lucas 19:11-27 tem dezessete, e dezessete versículos dentro de um balão de
 * chat é a mesma parede de texto que este trabalho inteiro existe para
 * desmanchar. Seis é o que cabe sem a conversa sumir da tela — o suficiente
 * para reconhecer o trecho e decidir se quer o resto.
 */
const VISIBLE_VERSES = 6;

export function BibloPassage({
  reference,
  onAdd,
  onRemove,
}: {
  reference: string;
  /**
   * Leva a passagem para o resumo, como bloco `bibleQuote`. `undefined` na tela
   * que não sabe editar — o cartão continua lá, só sem o "+".
   */
  onAdd?: (block: SummaryBlock) => void;
  onRemove?: (block: SummaryBlock) => void;
}) {
  const parsed = parseVerseReference(reference);
  const start = parsed?.startVerse;
  const range =
    parsed && start != null
      ? formatPassageRange(parsed.bookDisplay, parsed.chapter, start, parsed.endVerse ?? start)
      : null;
  // O capítulo é o que a pastilha ABRE, e a faixa é o que ela DIZ. Quem toca
  // quer o entorno do trecho que está lendo, não o trecho de novo.
  const chapter = parsed ? `${parsed.bookDisplay} ${parsed.chapter}` : reference;

  const state = useVerseFetch(range);
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);

  // Sem faixa ("Lucas 19") não há trecho a mostrar: o capítulo inteiro num balão
  // seria pior que o link que havia antes. Vira a menção de sempre.
  if (!range || state.status === "error") {
    return <ChapterMention reference={chapter} />;
  }

  const verses = state.status === "ok" ? state.verses : [];
  const hidden = Math.max(verses.length - VISIBLE_VERSES, 0);
  const shown = expanded ? verses : verses.slice(0, VISIBLE_VERSES);

  // O bloco que vai para o resumo é o do RESUMO, e o texto dele sai da NVI que
  // já está desenhada aqui — nunca do modelo, que só escreveu a referência. É a
  // faixa INTEIRA, e não o que está aberto na tela: dobrar versículos é um
  // gesto de leitura, e o que se guarda é a passagem.
  const block: SummaryBlock = {
    type: "bibleQuote",
    reference: range,
    text: verses.map((line) => line.text).join(" "),
  };

  return (
    <div className="rounded-xl bg-scriba-hairline-soft px-3 py-3 ring-1 ring-scriba-hairline">
      <div className="flex items-start justify-between gap-2">
        <ChapterMention reference={chapter} label={range} />
        {onAdd && verses.length > 0 && (
          <BibloAddButton
            added={added}
            label="Adicionar esta passagem ao resumo"
            onToggle={() => {
              if (added) onRemove?.(block);
              else onAdd(block);
              setAdded(!added);
            }}
            className="-mr-1 -mt-0.5"
          />
        )}
      </div>
      <div className="mt-2.5 text-session-verse-text">
        {state.status === "ok" ? (
          <VerseLines verses={shown} />
        ) : (
          <div aria-hidden className="flex flex-col gap-2 pl-3">
            {["w-full", "w-[94%]", "w-[88%]"].map((width) => (
              <span
                key={width}
                className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${width}`}
              />
            ))}
          </div>
        )}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 ml-3 text-[12px] text-scriba-ink-soft underline decoration-dotted underline-offset-[3px] transition-colors hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
        >
          {expanded ? "Mostrar menos" : `Mostrar os outros ${hidden}`}
        </button>
      )}
    </div>
  );
}
