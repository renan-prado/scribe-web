import { Footprints } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { relativeShort } from "@/features/session/lib/formatting";
import { PRACTICE_DAY_OFFSETS, type PracticesPayload } from "@/lib/domain/practices";

/**
 * "Coloque em prática" — renderiza os cards gerados por /api/practices junto
 * com o final_summary.
 *
 * - `variant="summary"` (default): página de resumo mostra apenas o card de
 *   dayOffset=0 ("Hoje"). Os demais serão liberados no feed home no dia
 *   agendado, não faz sentido antecipá-los aqui.
 * - `variant="feed"`: feed home. Na fase atual de validação mostra todos
 *   os 5 simultaneamente com rodapé de referência ao sermão (título + autor
 *   + relativo). Quando o agendamento entrar, cada card aparecerá no dia
 *   correspondente.
 */
type ColoqueEmPraticaProps = {
  practices: PracticesPayload | null;
  variant?: "summary" | "feed";
  /** Rodapé de referência ao sermão. Obrigatório no variant "feed". */
  sessionRef?: {
    id: string;
    title: string;
    createdAt: string;
    speakerName?: string | null;
    speakerLocation?: string | null;
    now: Date;
  };
};

const DAY_LABELS: Record<number, string> = {
  0: "Hoje",
  1: "Em 1 dia",
  3: "Em 3 dias",
  7: "Em 7 dias",
  15: "Em 15 dias",
};

export function ColoqueEmPratica({
  practices,
  variant = "summary",
  sessionRef,
}: ColoqueEmPraticaProps) {
  if (!practices || practices.items.length === 0) return null;

  const byOffset = new Map(practices.items.map((item) => [item.dayOffset, item]));
  const offsets = variant === "summary" ? ([0] as const) : [...PRACTICE_DAY_OFFSETS].reverse();
  const ordered = offsets.flatMap((offset) => {
    const item = byOffset.get(offset);
    return item ? [item] : [];
  });
  if (ordered.length === 0) return null;
  const description =
    variant === "summary"
      ? "Sugestões para aplicar esta mensagem em sua vida."
      : "Conselhos e sugestões para viver esta reflexão ao longo dos próximos dias.";
  const footer = sessionRef
    ? {
        href: `/recording/${sessionRef.id}/summary`,
        title: sessionRef.title,
        byline: [sessionRef.speakerName, sessionRef.speakerLocation]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s))
          .join(" · "),
        relative: relativeShort(sessionRef.createdAt, sessionRef.now),
      }
    : null;

  return (
    <section className="mt-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
          <Footprints className="size-3.5" strokeWidth={2.2} />
        </span>
        <h2 className="font-heading text-lg font-semibold tracking-tight text-scriba-ink-strong">
          Coloque em prática
        </h2>
      </header>
      <p className="-mt-2 text-xs font-light text-scriba-ink-mute">{description}</p>
      <ol className="flex flex-col gap-3">
        {ordered.map((item) => (
          <li
            key={item.dayOffset}
            className="flex flex-col gap-2 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper px-5 py-4 shadow-[0_2px_10px_rgba(79,168,240,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue-ink">
                {DAY_LABELS[item.dayOffset] ?? `Em ${item.dayOffset} dias`}
              </span>
            </div>
            <p className="text-pretty text-base font-semibold leading-snug text-scriba-ink-strong">
              {item.title}
            </p>
            <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
              {item.text}
            </p>
            {item.prompt ? (
              <p className="mt-1 rounded-xl bg-scriba-blue-soft/40 px-3 py-2 text-[13px] font-medium italic leading-snug text-scriba-blue-ink">
                {item.prompt}
              </p>
            ) : null}
            {footer ? (
              <footer className="mt-2 flex items-start justify-between gap-2 border-t border-scriba-hairline-soft pt-2 text-[11px] font-light text-scriba-ink-mute">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <NavLink
                    href={footer.href}
                    className="truncate font-medium text-scriba-ink-soft transition-colors hover:text-scriba-blue-ink"
                  >
                    {footer.title}
                  </NavLink>
                  {footer.byline ? (
                    <span className="truncate text-[10px] font-light text-scriba-ink-mute">
                      {footer.byline}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0">{footer.relative}</span>
              </footer>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
