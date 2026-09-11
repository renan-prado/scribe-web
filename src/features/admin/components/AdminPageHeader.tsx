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
        {/* `text-2xl font-semibold tracking-tight` + descrição em
            `text-muted-foreground text-sm`: é a mesma dupla do `CardHeader`
            do bloco, uma oitava acima. A escala em pixels e o `font-light`
            saíram porque eram uma tipografia própria do painel, e o ponto
            desta passagem é o painel deixar de ter uma. */}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
