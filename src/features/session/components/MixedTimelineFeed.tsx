import {
  BookOpenText,
  Footprints,
  type LucideIcon,
  MessageCircleQuestion,
  Quote,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { dayOffsetLabel, relativeShort } from "@/features/session/lib/formatting";
import type { PracticeItem, PracticesPayload } from "@/lib/domain/practices";
import type { ReminderItem, RemindersPayload } from "@/lib/domain/reminders";
import type { RereadItem, RereadsPayload } from "@/lib/domain/rereads";

/**
 * Timeline unificada do /feed — mistura os três tipos de card gerados junto
 * com o final_summary (praticar / releia / lembra) em uma única lista
 * ordenada por dayOffset descendente (mais distante em cima, "Hoje" no fim),
 * imitando o comportamento de um feed de rede social.
 *
 * Empates de dayOffset (ex.: dia 1 tem practice E reread, dia 7 idem) são
 * resolvidos por ordem estável: practice > reread > reminder — mantém a
 * "ação para hoje" acima da "releitura" e da "lembrança" quando batem no
 * mesmo dia.
 *
 * Cada card preserva sua identidade visual: um chip do tipo no topo (ícone
 * colorido + rótulo curto) + o chip de janela agendada, seguido do conteúdo
 * próprio e do rodapé com referência ao sermão.
 */
type MixedTimelineFeedProps = {
  practices: PracticesPayload | null;
  rereads: RereadsPayload | null;
  reminders: RemindersPayload | null;
  sessionRef: {
    id: string;
    title: string;
    createdAt: string;
    speakerName?: string | null;
    speakerLocation?: string | null;
    now: Date;
  };
};

type Entry =
  | { kind: "practice"; dayOffset: number; item: PracticeItem; key: string }
  | { kind: "reread"; dayOffset: number; item: RereadItem; key: string }
  | { kind: "reminder"; dayOffset: number; item: ReminderItem; key: string };

const TIEBREAK: Record<Entry["kind"], number> = {
  practice: 0,
  reread: 1,
  reminder: 2,
};

export function MixedTimelineFeed({
  practices,
  rereads,
  reminders,
  sessionRef,
}: MixedTimelineFeedProps) {
  const entries: Entry[] = [];
  for (const item of practices?.items ?? []) {
    entries.push({
      kind: "practice",
      dayOffset: item.dayOffset,
      item,
      key: `practice:${item.dayOffset}`,
    });
  }
  for (const item of rereads?.items ?? []) {
    entries.push({
      kind: "reread",
      dayOffset: item.dayOffset,
      item,
      key: `reread:${item.dayOffset}`,
    });
  }
  for (const item of reminders?.items ?? []) {
    entries.push({
      kind: "reminder",
      dayOffset: item.dayOffset,
      item,
      key: `reminder:${item.dayOffset}`,
    });
  }
  if (entries.length === 0) return null;

  entries.sort((a, b) => {
    if (b.dayOffset !== a.dayOffset) return b.dayOffset - a.dayOffset;
    return TIEBREAK[a.kind] - TIEBREAK[b.kind];
  });

  const footer = {
    href: `/recording/${sessionRef.id}/summary`,
    title: sessionRef.title,
    byline: [sessionRef.speakerName, sessionRef.speakerLocation]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s))
      .join(" · "),
    relative: relativeShort(sessionRef.createdAt, sessionRef.now),
  };

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.key}>
          {entry.kind === "practice" ? (
            <PracticeCard item={entry.item} footer={footer} />
          ) : entry.kind === "reread" ? (
            <RereadCard item={entry.item} footer={footer} />
          ) : (
            <ReminderCard item={entry.item} footer={footer} />
          )}
        </li>
      ))}
    </ol>
  );
}

type Footer = {
  href: string;
  title: string;
  byline: string;
  relative: string;
};

function CardShell({ children }: { children: ReactNode }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-scriba-hairline-soft bg-white px-5 py-4 shadow-[0_2px_10px_rgba(79,168,240,0.06)]">
      {children}
    </article>
  );
}

function CardHeaderRow({
  Icon,
  label,
  dayOffset,
}: {
  Icon: LucideIcon;
  label: string;
  dayOffset: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue">
        <span className="flex size-5 items-center justify-center rounded-full bg-scriba-blue-soft">
          <Icon className="size-3" strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-blue-soft/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue">
        {dayOffsetLabel(dayOffset)}
      </span>
    </div>
  );
}

function CardFooter({ footer }: { footer: Footer }) {
  return (
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
  );
}

function PracticeCard({ item, footer }: { item: PracticeItem; footer: Footer }) {
  return (
    <CardShell>
      <CardHeaderRow Icon={Footprints} label="Coloque em prática" dayOffset={item.dayOffset} />
      <p className="text-pretty text-base font-semibold leading-snug text-scriba-ink-strong">
        {item.title}
      </p>
      <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">{item.text}</p>
      {item.prompt ? (
        <p className="mt-1 rounded-xl bg-scriba-blue-soft/40 px-3 py-2 text-[13px] font-medium italic leading-snug text-scriba-blue">
          {item.prompt}
        </p>
      ) : null}
      <CardFooter footer={footer} />
    </CardShell>
  );
}

function RereadCard({ item, footer }: { item: RereadItem; footer: Footer }) {
  return (
    <CardShell>
      <CardHeaderRow Icon={BookOpenText} label="Releia este texto" dayOffset={item.dayOffset} />
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
      <CardFooter footer={footer} />
    </CardShell>
  );
}

function ReminderCard({ item, footer }: { item: ReminderItem; footer: Footer }) {
  return (
    <CardShell>
      <CardHeaderRow
        Icon={MessageCircleQuestion}
        label="Lembra disso?"
        dayOffset={item.dayOffset}
      />
      <p className="text-pretty text-base font-semibold leading-snug text-scriba-ink-strong">
        {item.title}
      </p>
      {item.quote ? (
        <blockquote className="flex gap-2 rounded-xl bg-scriba-blue-soft/40 px-3 py-2 text-[13px] font-medium italic leading-snug text-scriba-blue">
          <Quote className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="text-pretty">{item.quote}</span>
        </blockquote>
      ) : null}
      <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">{item.text}</p>
      <CardFooter footer={footer} />
    </CardShell>
  );
}
