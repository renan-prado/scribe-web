import { Quote, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { relativeShort } from "@/features/session/lib/formatting";
import { REMINDER_DAY_OFFSETS, type RemindersPayload } from "@/lib/domain/reminders";

/**
 * "Lembra disso?" — renderiza os 10 mini-callbacks gerados junto com o
 * final_summary. Todos os itens são agendados no futuro (2..260 dias); nada
 * é "hoje".
 *
 * - `variant="feed"`: feed home. Na fase atual de validação mostra os 10
 *   simultaneamente ordenados mais-distante-em-cima (260 dias) →
 *   mais-próximo-embaixo (2 dias), casando com a convenção das outras duas
 *   features. Rodapé com referência ao sermão.
 * - `variant="summary"` (default): teaser discreto na página de resumo
 *   ("10 mini-cartões preparados…"), sem listar cards — nenhum é para hoje.
 */
type LembraDissoProps = {
  reminders: RemindersPayload | null;
  variant?: "summary" | "feed";
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
  2: "Em 2 dias",
  5: "Em 5 dias",
  18: "Em 18 dias",
  33: "Em 33 dias",
  47: "Em 47 dias",
  62: "Em 62 dias",
  82: "Em 82 dias",
  120: "Em 120 dias",
  180: "Em 6 meses",
  260: "Em 9 meses",
};

export function LembraDisso({ reminders, variant = "summary", sessionRef }: LembraDissoProps) {
  if (!reminders || reminders.items.length === 0) return null;

  if (variant === "summary") {
    return (
      <section className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-scriba-hairline-soft bg-scriba-blue-soft/25 px-4 py-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue">
          <Sparkles className="size-3.5" strokeWidth={2.2} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-scriba-ink-strong">
            {reminders.items.length} mini-cartões preparados
          </p>
          <p className="text-xs font-light text-scriba-ink-mute">
            Ao longo dos próximos meses, pequenas provocações deste sermão vão aparecer no seu feed
            para você lembrar.
          </p>
        </div>
      </section>
    );
  }

  const byOffset = new Map(reminders.items.map((item) => [item.dayOffset, item]));
  const ordered = [...REMINDER_DAY_OFFSETS].reverse().flatMap((offset) => {
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
          <Sparkles className="size-3.5" strokeWidth={2.2} />
        </span>
        <h2 className="font-heading text-lg font-semibold tracking-tight text-scriba-ink-strong">
          Lembra disso?
        </h2>
      </header>
      <p className="-mt-2 text-xs font-light text-scriba-ink-mute">
        Dez pequenas cutucadas para revisitar ideias deste sermão nos próximos meses.
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
            <p className="text-pretty text-base font-semibold leading-snug text-scriba-ink-strong">
              {item.title}
            </p>
            {item.quote ? (
              <blockquote className="flex gap-2 rounded-xl bg-scriba-blue-soft/40 px-3 py-2 text-[13px] font-medium italic leading-snug text-scriba-blue">
                <Quote className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                <span className="text-pretty">{item.quote}</span>
              </blockquote>
            ) : null}
            <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
              {item.text}
            </p>
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
