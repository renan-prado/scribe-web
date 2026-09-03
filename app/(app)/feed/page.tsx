import type { Metadata } from "next";
import { NavLink } from "@/components/NavLink";
import { DeepenButton } from "@/features/session/components/DeepenButton";
import { PaginatedFeed } from "@/features/session/components/PaginatedFeed";
import { SessionsEmptyState } from "@/features/session/components/SessionsEmptyState";
import { shortDate } from "@/features/session/lib/formatting";
import { hasDeepening, listDeepenedSessionIds } from "@/lib/db/deepenings";
import { type ListFeedEntriesResult, listFeedEntries } from "@/lib/db/feed-entries";
import { getCurrentProfile } from "@/lib/db/profiles";
import { listSessions } from "@/lib/db/sessions";
import { canCurrentUserUse } from "@/lib/entitlements/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "amigo";
  const trimmed = fullName.trim();
  if (!trimmed) return "amigo";
  return trimmed.split(/\s+/)[0];
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// 1-indexed: index 0 unused, indices 1–31 map to day-of-month
const DAILY_PROMPTS = [
  "",
  "Vamos relembrar algo importante?", // 1
  "O que ficou guardado na memória hoje?", // 2
  "Tem alguma palavra que merece revisitar?", // 3
  "Qual mensagem você quer levar essa semana?", // 4
  "Algo do que ouviu ainda ecoa em você?", // 5
  "Que passagem marcou sua última escuta?", // 6
  "Vale a pena ouvir de novo?", // 7
  "Qual versículo ficou com você?", // 8
  "Tem uma frase que ainda está te falando?", // 9
  "O que você não quer esquecer desta semana?", // 10
  "Alguma revelação que merece mais atenção?", // 11
  "Qual parte do sermão tocou mais fundo?", // 12
  "O que você ainda precisa processar?", // 13
  "Tem algo para compartilhar com alguém?", // 14
  "Qual verdade você precisa revisitar hoje?", // 15
  "Algo do que ouviu mudou sua perspectiva?", // 16
  "Que palavra ainda está amadurecendo em você?", // 17
  "O que o Espírito destacou no último sermão?", // 18
  "Tem uma aplicação que ainda está pendente?", // 19
  "Qual ensinamento você quer fixar na memória?", // 20
  "Alguma promessa que precisa ser lembrada?", // 21
  "O que você ouviu que vale ler de novo?", // 22
  "Tem algo que você quer levar para a oração?", // 23
  "Vamos relembrar algo importante?", // 24
  "Qual mensagem ainda merece meditação?", // 25
  "O que ficou incompleto na sua anotação?", // 26
  "Tem um ponto que você quer estudar?", // 27
  "Qual citação você não quer perder de vista?", // 28
  "O que você ouviu que precisa colocar em prática?", // 29
  "Tem uma passagem que ainda está te desafiando?", // 30
  "Que aprendizado você leva deste mês?", // 31
];

function dailyPrompt(day: number): string {
  return DAILY_PROMPTS[day] ?? DAILY_PROMPTS[1];
}

export default async function HomePage() {
  const [profile, sessions, canGenerateStudy] = await Promise.all([
    getCurrentProfile().catch(() => null),
    listSessions().catch(() => [] as Awaited<ReturnType<typeof listSessions>>),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);

  const now = new Date();
  const firstName = firstNameOf(profile?.displayName);
  const greeting = greetingFor(now.getHours());

  const latest = sessions[0] ?? null;
  const [latestHasDeepening, feedPage, deepenedIds] = latest
    ? await Promise.all([
        hasDeepening(latest.id).catch(() => false),
        listFeedEntries({
          order: "recent",
          offset: 0,
          limit: 10,
          now,
        }).catch(() => ({ items: [], total: 0, hasMore: false })),
        listDeepenedSessionIds(sessions.map((s) => s.id)).catch(() => new Set<string>()),
      ])
    : [
        false,
        { items: [], total: 0, hasMore: false } satisfies ListFeedEntriesResult,
        new Set<string>(),
      ];
  const isEmpty = sessions.length === 0;

  // Sessões sem estudo — usadas para intercalar o card "Gerar estudo" no feed.
  // Excluímos a sessão do topo (ReflectionCard) para não duplicar o CTA.
  const studyCtaSessions = sessions
    .filter((s) => s.id !== latest?.id && !deepenedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      speakerName: s.speakerName,
      speakerLocation: s.speakerLocation,
    }));

  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8",
        isEmpty && "flex-1 justify-center py-0 sm:py-0"
      )}
    >
      {isEmpty ? null : (
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl">
            {greeting}, {firstName}!
          </h1>
          <p className="text-sm font-light text-scriba-ink-soft">{dailyPrompt(now.getDate())}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {isEmpty ? (
          <SessionsEmptyState showThemeToggle />
        ) : latest ? (
          <>
            <ReflectionCard
              sessionId={latest.id}
              title={latest.title ?? "Sessão sem título"}
              speaker={latest.speakerName}
              date={shortDate(latest.createdAt)}
              shortSummary={latest.shortSummary}
              href={`/recording/${latest.id}/summary`}
              hasDeepening={latestHasDeepening}
              canGenerateStudy={canGenerateStudy}
            />
            <div className="py-2">
              <div className="h-px bg-scriba-hairline" />
            </div>
            <PaginatedFeed
              initialItems={feedPage.items}
              initialHasMore={feedPage.hasMore}
              initialOrder="recent"
              studyCtaSessions={studyCtaSessions}
              canGenerateStudy={canGenerateStudy}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

type ReflectionCardProps = {
  sessionId: string;
  title: string;
  speaker: string | null;
  date: string;
  shortSummary: string | null;
  href: string;
  hasDeepening: boolean;
  canGenerateStudy: boolean;
};

function ReflectionCard({
  sessionId,
  title,
  speaker,
  date,
  shortSummary,
  href,
  hasDeepening,
  canGenerateStudy,
}: ReflectionCardProps) {
  const quote =
    shortSummary?.trim() ||
    "“A nossa confiança em Deus não nasce da ausência de incertezas, mas de saber quem Ele é.”";
  const speakerLine = [speaker, date].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-4 rounded-[24px] border border-scriba-hairline-soft bg-scriba-paper p-6 shadow-[0_6px_22px_rgba(79,168,240,0.13)]">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-6 rounded-full bg-scriba-hairline" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
          Sobre a última gravação
        </span>
      </div>
      <p className="text-pretty text-base font-medium leading-snug text-scriba-ink-strong sm:text-lg">
        {quote}
      </p>
      <div className="flex flex-col gap-0.5 border-t border-scriba-hairline pt-3">
        <span className="text-sm font-semibold text-scriba-ink">{title}</span>
        {speakerLine ? (
          <span className="text-xs font-light text-scriba-ink-mute">{speakerLine}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        <DeepenButton
          sessionId={sessionId}
          hasDeepening={hasDeepening}
          variant="feed-card"
          canGenerate={canGenerateStudy}
        />
        <NavLink
          href={href}
          contentClassName="inline-flex items-center justify-center gap-1.5"
          className="inline-flex w-full items-center justify-center rounded-full bg-scriba-blue-soft/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft transition-colors hover:bg-scriba-blue-soft sm:flex-1"
        >
          Relembrar
        </NavLink>
      </div>
    </article>
  );
}
