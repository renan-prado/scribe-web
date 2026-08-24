export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-semibold tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13.5px] font-light text-[color:var(--scriba-ink-soft)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
