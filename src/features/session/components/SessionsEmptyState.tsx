import { ThemeToggle } from "@/components/ThemeToggle";

const STEPS = [
  {
    n: 1,
    title: "Grave o sermão",
    body: "Toque em Gravar quando a pregação começar.",
  },
  {
    n: 2,
    title: "Receba o resumo",
    body: "O Scriba transcreve e devolve os pontos centrais no seu feed.",
  },
  {
    n: 3,
    title: "Gere o estudo depois",
    body: "Volte a qualquer trecho para estudar, relembrar ou compartilhar.",
  },
];

type SessionsEmptyStateProps = {
  sticker?: string;
  heading?: string;
  /**
   * Shows the light/dark switch in the card corner. Only /feed turns this on —
   * it's the one empty surface a signed-in user lands on with nothing else to
   * do, which makes it the natural home for the theme control.
   */
  showThemeToggle?: boolean;
};

export function SessionsEmptyState({
  sticker = "/stickers/men/019-man.svg",
  heading = "Nada de novo por aqui.",
  showThemeToggle = false,
}: SessionsEmptyStateProps = {}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-scriba-paper">
      {showThemeToggle ? (
        <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
          <ThemeToggle />
        </div>
      ) : null}
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
            Nenhum sermão gravado ainda. Comece pela primeira gravação e o Scriba passa a montar seu
            feed a partir do que você ouvir.
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
