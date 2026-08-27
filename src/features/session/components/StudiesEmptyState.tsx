const STEPS = [
  {
    n: 1,
    title: "Abra um resumo",
    body: "Vá até uma gravação já concluída e finalizada.",
  },
  {
    n: 2,
    title: "Toque em Gerar estudo",
    body: "O Scriba lê o sermão e monta um estudo teológico independente sobre o mesmo tema.",
  },
  {
    n: 3,
    title: "Volte quando quiser",
    body: "Todo estudo que você gerar aparece aqui para relembrar ou reprocessar.",
  },
];

type StudiesEmptyStateProps = {
  sticker?: string;
  heading?: string;
};

/**
 * Empty state da lista de estudos (/studies). Segue a mesma casca visual do
 * SessionsEmptyState — sticker + heading + steps — mas com passos que
 * refletem o fluxo de geração de estudo, não o de gravação.
 */
export function StudiesEmptyState({
  sticker = "/stickers/men/026-man.svg",
  heading = "Nenhum estudo por aqui.",
}: StudiesEmptyStateProps = {}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white">
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

        <div className="mt-1 flex max-w-[380px] flex-col gap-1.5 sm:mt-1.5">
          <h2 className="text-pretty text-[19px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-[24px]">
            {heading}
          </h2>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft sm:text-sm">
            Estudos são peças teológicas independentes que o Scriba gera a partir dos seus resumos.
            Assim que você gerar o primeiro, ele aparece por aqui.
          </p>
        </div>
      </div>

      <div className="border-t border-scriba-hairline-soft bg-scriba-surface px-5 py-4 sm:px-12 sm:py-6">
        <ol className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-start gap-3 sm:flex-col sm:gap-1.5">
              <span
                aria-hidden
                className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-scriba-blue-soft text-[13px] font-semibold text-scriba-blue"
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
