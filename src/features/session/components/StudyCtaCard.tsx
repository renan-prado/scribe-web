"use client";

import { DeepenButton } from "./DeepenButton";

/**
 * Card promocional intercalado no /feed que convida o usuário a gerar o
 * aprofundamento de uma sessão que ainda não tem estudo. Visualmente segue
 * o layout "banner com sticker à direita".
 */

export type StudyCtaSession = {
  id: string;
  title: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
};

export function StudyCtaCard({ session }: { session: StudyCtaSession }) {
  const title = session.title?.trim() || "Sessão sem título";
  const byline = [session.speakerName, session.speakerLocation]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(" · ");

  return (
    <article className="relative my-2 flex flex-col items-stretch gap-3 overflow-hidden rounded-[24px] bg-scriba-blue-soft/70 px-5 py-4 shadow-[0_2px_10px_rgba(79,168,240,0.08)] sm:flex-row sm:pl-5 sm:pr-2">
      {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
      <img
        src="/stickers/men/012-man.svg"
        alt=""
        aria-hidden
        width={112}
        height={112}
        className="h-auto w-[96px] shrink-0 self-start sm:order-last sm:w-[112px] sm:self-end"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-pretty text-[15px] font-semibold leading-snug text-scriba-ink-strong">
            {title}
          </p>
          {byline ? (
            <p className="truncate text-[11px] font-light text-scriba-ink-mute">{byline}</p>
          ) : null}
        </div>
        <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink">
          Gere um estudo para se aprofundar ainda mais nesta mensagem.
        </p>
        <div className="mt-1">
          <DeepenButton sessionId={session.id} hasDeepening={false} variant="cta-card" />
        </div>
      </div>
    </article>
  );
}
