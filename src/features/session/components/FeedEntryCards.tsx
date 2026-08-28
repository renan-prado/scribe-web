import {
  BookOpenText,
  Footprints,
  type LucideIcon,
  MessageCircleQuestion,
  Quote,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { relativeShort } from "@/features/session/lib/formatting";
import type { PracticeItem } from "@/lib/domain/practices";
import type { ReminderItem } from "@/lib/domain/reminders";
import type { RereadItem } from "@/lib/domain/rereads";

/**
 * Renderers dos três tipos de card do feed (praticar/releia/lembra). Ficam
 * isolados para serem reaproveitados pelo PaginatedFeed (feed global do /feed).
 */

export type FeedCardFooter = {
  href: string;
  title: string;
  byline: string;
  relative: string;
};

export function buildFooter(
  session: {
    id: string;
    title: string | null;
    createdAt: string;
    speakerName: string | null;
    speakerLocation: string | null;
  },
  now: Date
): FeedCardFooter {
  return {
    href: `/recording/${session.id}/summary`,
    title: session.title ?? "Sessão sem título",
    byline: [session.speakerName, session.speakerLocation]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s))
      .join(" · "),
    relative: relativeShort(session.createdAt, now),
  };
}

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
  relative,
}: {
  Icon: LucideIcon;
  label: string;
  relative: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue">
        <span className="flex size-5 items-center justify-center rounded-full bg-scriba-blue-soft">
          <Icon className="size-3" strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className="inline-flex shrink-0 items-center rounded-full bg-scriba-ink-mute/10 px-2 py-0.5 text-[10px] font-medium text-scriba-ink-soft">
        {relative}
      </span>
    </div>
  );
}

function CardFooter({ footer }: { footer: FeedCardFooter }) {
  return (
    <footer className="mt-2 flex min-w-0 flex-col gap-0.5 border-t border-scriba-hairline-soft pt-2 text-[11px] font-light text-scriba-ink-mute">
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
    </footer>
  );
}

export function PracticeCard({ item, footer }: { item: PracticeItem; footer: FeedCardFooter }) {
  return (
    <CardShell>
      <CardHeaderRow Icon={Footprints} label="Coloque em prática" relative={footer.relative} />
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

export function RereadCard({ item, footer }: { item: RereadItem; footer: FeedCardFooter }) {
  return (
    <CardShell>
      <CardHeaderRow Icon={BookOpenText} label="Releia este texto" relative={footer.relative} />
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

export function ReminderCard({ item, footer }: { item: ReminderItem; footer: FeedCardFooter }) {
  return (
    <CardShell>
      <CardHeaderRow
        Icon={MessageCircleQuestion}
        label="Lembra disso?"
        relative={footer.relative}
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
