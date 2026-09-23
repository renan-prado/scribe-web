import type { ReactNode } from "react";

type CollectionEmptyStateProps = {
  /** SVG em `public/stickers/`. É decorativo: entra com `alt=""`. */
  sticker: string;
  heading: string;
  body: ReactNode;
};

/**
 * A casca do estado vazio da Biblioteca: sticker, título e um parágrafo. Nada
 * mais.
 *
 * Ela nasceu para servir duas telas vazias que diziam a MESMA coisa em
 * formatos diferentes — a Biblioteca e a lista de Estudos, que saiu do
 * produto. A casca ficou porque o padrão continua sendo o certo se um dia
 * outra lista vazia aparecer, e porque separar sticker/título/parágrafo da
 * frase de cada tela é o que evita duas cópias do mesmo desenho divergindo no
 * primeiro ajuste de padding.
 *
 * **Ela já teve três passos numerados no rodapé, e não tem mais.** Um tutorial
 * de três colunas numa tela que a pessoa vê uma vez é muito desenho para pouca
 * dúvida: as portas de criação estão na barra, visíveis, e o caminho que os
 * passos explicavam cabe numa frase do parágrafo. O estado vazio volta a
 * dizer só o que precisa — que está vazio, e o que aparece aqui.
 *
 * Quem desenha o conteúdo é `SessionsEmptyState`. Esta casca não é chamada
 * direto por página nenhuma: a frase de cada lista é decisão de produto e
 * merece um nome próprio no import.
 */
export function CollectionEmptyState({ sticker, heading, body }: CollectionEmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-3xl bg-scriba-paper">
      <div className="flex flex-col items-center px-5 py-10 text-center sm:px-8 sm:py-14">
        {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
        <img
          src={sticker}
          alt=""
          aria-hidden
          width={240}
          height={240}
          className="h-auto w-[116px] sm:w-[180px]"
        />

        {/* O respiro entre o sticker e o título é o que separa a ilustração do
            texto: colados, o desenho parece parte da frase. */}
        <div className="mt-7 flex max-w-[400px] flex-col gap-3 sm:mt-9">
          <h2 className="text-pretty text-[19px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-[24px]">
            {heading}
          </h2>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft sm:text-sm">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
