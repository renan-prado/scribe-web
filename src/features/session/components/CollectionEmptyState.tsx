import type { ReactNode } from "react";

export type CollectionEmptyStep = {
  n: number;
  title: string;
  body: string;
};

type CollectionEmptyStateProps = {
  /** SVG em `public/stickers/`. É decorativo: entra com `alt=""`. */
  sticker: string;
  heading: string;
  body: ReactNode;
  /** Três, sempre: no desktop eles viram as três colunas do rodapé do cartão. */
  steps: readonly CollectionEmptyStep[];
};

/**
 * A casca dos estados vazios das duas listas do app, a Biblioteca e os
 * Estudos: sticker + título + parágrafo em cima, três passos numerados embaixo.
 *
 * Ela existe porque as duas telas vazias dizem a MESMA coisa em formatos
 * diferentes — "aqui ainda não tem nada, e é assim que se põe algo aqui" — e
 * duas cópias do mesmo desenho divergem no primeiro ajuste de padding. O que
 * muda entre elas é só o TEXTO, e é por isso que só o texto é prop.
 *
 * Quem desenha o conteúdo são `SessionsEmptyState` e `StudiesEmptyState`, um
 * por tela. Esta casca não é chamada direto por página nenhuma: a frase de
 * cada lista é decisão de produto e merece um nome próprio no import.
 */
export function CollectionEmptyState({ sticker, heading, body, steps }: CollectionEmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-3xl bg-scriba-paper">
      <div className="flex flex-col items-center px-5 pt-6 pb-8 text-center sm:px-8 sm:pt-9">
        <div className="flex items-center justify-center">
          {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
          <img
            src={sticker}
            alt=""
            aria-hidden
            width={240}
            height={240}
            className="h-auto w-[116px] sm:w-[180px]"
          />
        </div>

        <div className="mt-1 flex max-w-[380px] flex-col gap-4 sm:mt-1.5">
          <h2 className="text-pretty text-[19px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-[24px]">
            {heading}
          </h2>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft sm:text-sm">
            {body}
          </p>
        </div>
      </div>

      <div className="border-t border-scriba-hairline-soft bg-scriba-surface px-5 py-4 sm:px-12 sm:py-6">
        <ol className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <li key={step.n} className="flex items-start gap-3 sm:flex-col sm:gap-1.5">
              <span
                aria-hidden
                className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-scriba-green-soft text-[13px] font-semibold text-scriba-green-ink"
              >
                {step.n}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold text-scriba-ink-strong">
                  {step.title}
                </span>
                <span className="text-[12.5px] font-light leading-relaxed text-scriba-ink-soft">
                  {step.body}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
