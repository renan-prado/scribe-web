import { BookOpenText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { relativeShort } from "@/features/session/lib/formatting";
import { REREAD_DAY_OFFSETS, type RereadsPayload } from "@/lib/domain/rereads";

/**
 * "Releia este texto" — renderiza os 10 versículos separados por /api/rereads
 * junto com o final_summary. Todos os itens são agendados no futuro
 * (1..90 dias); nada é "hoje".
 *
 * - `variant="feed"`: feed home. Na fase atual de validação mostra todos os
 *   10 simultaneamente com rodapé de referência ao sermão, ordenados
 *   mais-distante-em-cima (90 dias) → mais-próximo-embaixo (1 dia), casando
 *   com a mesma convenção de "Coloque em prática".
 * - `variant="summary"` (default): página de resumo mostra só um teaser
 *   discreto ("10 textos separados para reler…") sem listar cards, já que
 *   nenhum item é para hoje — a lista aparece pra valer no feed.
 */
type ReleiaEsteTextoProps = {
  rereads: RereadsPayload | null;
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
  1: "Em 1 dia",
  2: "Em 2 dias",
  4: "Em 4 dias",
  7: "Em 7 dias",
  16: "Em 16 dias",
  22: "Em 22 dias",
  30: "Em 30 dias",
  45: "Em 45 dias",
  60: "Em 60 dias",
  90: "Em 90 dias",
};

export function ReleiaEsteTexto({
  rereads,
  variant = "summary",
  sessionRef,
}: ReleiaEsteTextoProps) {
  if (!rereads || rereads.items.length === 0) return null;

  if (variant === "summary") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-scriba-hairline-soft bg-scriba-blue-soft/25 px-4 py-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue">
          <BookOpenText className="size-3.5" strokeWidth={2.2} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-scriba-ink-strong">
            {rereads.items.length} versiculos foram separados.
          </p>
          <p className="text-xs font-light text-scriba-ink-mute">
            Ao longo dos próximos dias, versículos deste sermão aparecerão no seu feed para serem
            relidos e meditados.
          </p>
        </div>
      </section>
    );
  }

  const byOffset = new Map(rereads.items.map((item) => [item.dayOffset, item]));
  const ordered = [...REREAD_DAY_OFFSETS].reverse().flatMap((offset) => {
    const item = byOffset.get(offset);
    return item ? [item] : [];
  });
  if (ordered.length === 0) return null;

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
        <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue">
          <BookOpenText className="size-3.5" strokeWidth={2.2} />
        </span>
        <h2 className="font-heading text-lg font-semibold tracking-tight text-scriba-ink-strong">
          Releia este texto
        </h2>
      </header>
      <p className="-mt-2 text-xs font-light text-scriba-ink-mute">
        Dez versículos separados para reler ao longo dos próximos 90 dias.
      </p>
      <ol className="flex flex-col gap-3">
        {ordered.map((item) => (
          <li
            key={item.dayOffset}
            className="flex flex-col gap-2 rounded-2xl border border-scriba-hairline-soft bg-white px-5 py-4 shadow-[0_2px_10px_rgba(79,168,240,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue">
                {DAY_LABELS[item.dayOffset] ?? `Em ${item.dayOffset} dias`}
              </span>
            </div>
            <p className="font-heading text-base font-semibold leading-snug text-scriba-ink-strong">
              {item.reference}
            </p>
            {item.text ? (
              <p className="text-pretty text-sm font-light italic leading-relaxed text-scriba-ink">
                {item.text}
              </p>
            ) : null}
            {item.reason ? (
              <p className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-mute">
                {item.reason}
              </p>
            ) : null}
            {footer ? (
              <footer className="mt-2 flex items-start justify-between gap-2 border-t border-scriba-hairline-soft pt-2 text-[11px] font-light text-scriba-ink-mute">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <NavLink
                    href={footer.href}
                    className="truncate font-medium text-scriba-ink-soft transition-colors hover:text-scriba-blue"
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
