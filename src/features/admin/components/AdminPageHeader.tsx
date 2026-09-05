type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

/**
 * O cabeçalho de cada tela do painel.
 *
 * As ações ficam num bloco que QUEBRA para a linha de baixo e ocupa a largura
 * inteira no celular: as pílulas de período da precificação são quatro, e
 * espremê-las ao lado do título fazia o título truncar em vez de elas
 * descerem.
 */
export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-scriba-ink-strong sm:text-[26px] lg:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13px] font-light leading-relaxed text-scriba-ink-soft sm:text-[13.5px]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
