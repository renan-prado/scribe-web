import { ArrowUpRight, type LucideIcon, MessageCircleQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import type { HighlightItem } from "@/lib/domain/highlights";
import type { ReminderItem } from "@/lib/domain/reminders";
import type { RereadItem } from "@/lib/domain/rereads";
import { BookGlyph } from "@/shared/icons/BookGlyph";

/**
 * Renderers dos tipos de card do feed (releia / lembra / frase marcante).
 * Ficam isolados para serem reaproveitados pelo PaginatedFeed (feed global do
 * /feed).
 */

export type FeedCardFooter = {
  href: string;
  title: string;
  byline: string;
};

export function buildFooter(session: {
  id: string;
  title: string | null;
  createdAt: string;
  speakerName: string | null;
  speakerLocation: string | null;
}): FeedCardFooter {
  return {
    href: `/recording/${session.id}/summary`,
    title: session.title ?? "Sessão sem título",
    byline: [session.speakerName, session.speakerLocation]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s))
      .join(" · "),
  };
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-scriba-ink-strong/20 bg-[image:var(--feed-card)] bg-[size:200%_100%] p-6 shadow-[0_2px_10px_rgba(79,168,240,0.06)]">
      {children}
    </article>
  );
}

function CardHeaderRow({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-blue-ink">
        <span className="flex size-5 items-center justify-center rounded-full bg-scriba-blue-soft">
          <Icon className="size-3" strokeWidth={2.2} />
        </span>
        {label}
      </span>
    </div>
  );
}

function CardFooter({ footer }: { footer: FeedCardFooter }) {
  return (
    <footer className="mt-2 flex flex-col gap-0.5 border-t border-scriba-hairline-soft pt-2 text-[11px] font-light text-scriba-ink-mute">
      <NavLink
        href={footer.href}
        className="font-medium text-scriba-ink-soft transition-colors hover:text-scriba-blue-ink"
      >
        {footer.title}
        <ArrowUpRight className="size-3 shrink-0" strokeWidth={2.2} aria-hidden />
      </NavLink>
      {footer.byline ? (
        <span className="truncate text-[10px] font-light text-scriba-ink-mute">
          {footer.byline}
        </span>
      ) : null}
    </footer>
  );
}

export function RereadCard({ item, footer }: { item: RereadItem; footer: FeedCardFooter }) {
  return (
    <article className="relative flex flex-col gap-3.5 rounded-[26px] border border-scriba-ink-strong/20 p-6 animate-insight-gradient bg-[image:var(--feed-card)] bg-[size:200%_100%]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 veil-chip rounded-full px-4 py-1.5 text-xs font-medium">
          <BookGlyph className="size-3" />
          {item.reference}
        </span>
      </div>
      {item.text ? (
        <blockquote className="text-[15px] font-light leading-relaxed text-session-verse-text">
          {item.text}
        </blockquote>
      ) : null}
      <footer className="mt-2 flex flex-col gap-0.5 border-t border-session-verse-text/15 pt-4 pb-1 text-[11px] font-light text-session-verse-text/75">
        <NavLink
          href={footer.href}
          className="font-medium text-session-verse-text transition-colors hover:text-scriba-blue-ink"
        >
          {footer.title}
          <ArrowUpRight className="size-3 shrink-0" strokeWidth={2.2} aria-hidden />
        </NavLink>
        {footer.byline ? (
          <span className="truncate text-[10px] font-light text-session-verse-text/70">
            {footer.byline}
          </span>
        ) : null}
      </footer>
    </article>
  );
}

/**
 * O `title` do lembrete vem do modelo, e `lib/prompts/reminders.ts` aceita
 * "Lembra disso?" como fallback GENÉRICO quando não há nada específico a
 * lembrar. Nesse caso o cartão imprimia a mesma frase duas vezes: uma na
 * sobrancelha e outra logo abaixo, em corpo semibold.
 *
 * Duas coisas consertam isso, e são independentes de propósito. A
 * sobrancelha virou uma CATEGORIA ("Para lembrar") em vez de repetir a
 * pergunta do cartão, que é o que uma sobrancelha deve ser; e o título
 * genérico deixa de ser impresso, porque ele não acrescenta nada ao que a
 * sobrancelha já disse. Um título específico ("Lembra dessa imagem da
 * videira?") continua aparecendo normalmente.
 *
 * O conserto é de LEITURA, não de dado: as linhas já geradas seguem no banco
 * com o título genérico, e mexer no prompt não as alcançaria.
 */
const GENERIC_REMINDER_TITLE = /^lembra\s+disso\s*[?!.]*$/i;

export function ReminderCard({ item, footer }: { item: ReminderItem; footer: FeedCardFooter }) {
  const title = item.title.trim();
  const showTitle = title.length > 0 && !GENERIC_REMINDER_TITLE.test(title);
  return (
    <CardShell>
      <CardHeaderRow Icon={MessageCircleQuestion} label="Para lembrar" />
      {showTitle ? (
        <p className="text-pretty text-base font-semibold leading-snug text-scriba-ink-strong">
          {title}
        </p>
      ) : null}
      {item.quote ? (
        <blockquote className="text-pretty text-[13px] font-medium italic leading-snug text-scriba-ink-strong my-2">
          <span className="highlight-phrase px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            {item.quote}
          </span>
        </blockquote>
      ) : null}
      <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">{item.text}</p>
      <CardFooter footer={footer} />
    </CardShell>
  );
}

/**
 * Frase marcante do sermão, reciclada sem IA a partir dos speaker* do feed
 * do ao vivo ou dos quote blocks do resumo final. Visual espelha o
 * HighlightBlock usado no FeedItemCard/SummaryView: aspa ornamental grande,
 * texto em blockquote com faixa amarela por trás. Autor renderiza abaixo
 * quando presente (speakerCitation / summaryQuote com atribuição).
 */
export function HighlightCard({ item, footer }: { item: HighlightItem; footer: FeedCardFooter }) {
  return (
    <CardShell>
      <figure className="flex flex-1 flex-col items-center justify-center px-1 pb-6 pt-2 text-center sm:px-4 sm:pb-8 sm:pt-3">
        <span
          aria-hidden
          className="-mb-3 select-none text-3xl font-semibold leading-none text-scriba-hairline-soft sm:-mb-4 sm:text-4xl"
        >
          "
        </span>
        <blockquote className="text-pretty text-lg font-medium leading-relaxed text-scriba-ink-strong">
          <span className="highlight-phrase px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            {item.text}
          </span>
        </blockquote>
        {item.author ? (
          <figcaption className="mt-1 text-xs font-medium text-scriba-ink-soft">
            {item.author}
          </figcaption>
        ) : null}
      </figure>
      <CardFooter footer={footer} />
    </CardShell>
  );
}
