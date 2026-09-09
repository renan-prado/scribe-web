import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeedbackPrompt } from "@/features/feedback/components/FeedbackPrompt";
import { FEEDBACK_DELAY_SUMMARY_MS } from "@/features/feedback/config";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { hasDeepening } from "@/lib/db/deepenings";
import { getHighlights } from "@/lib/db/highlights";
import { getReminders } from "@/lib/db/reminders";
import { getRereads } from "@/lib/db/rereads";
import { getSession } from "@/lib/db/sessions";
import { canCurrentUserUse } from "@/lib/entitlements/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  return { title: session?.title?.trim() || "Sessão sem título" };
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FMT_SHORT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function RecordingSummaryPage({ params }: PageProps) {
  const { id } = await params;
  const [session, deepeningExists, rereadsRow, remindersRow, highlightsRow, canGenerateStudy] =
    await Promise.all([
      getSession(id),
      hasDeepening(id),
      getRereads(id).catch(() => null),
      getReminders(id).catch(() => null),
      getHighlights(id).catch(() => null),
      canCurrentUserUse("study_generation").catch(() => false),
    ]);
  if (!session) notFound();
  // Sessões do modo transcrição nascem SEM resumo — enquanto for esse o caso,
  // esta página não tem o que desenhar e a leitura mora em /transcript. O
  // gate é a ausência do payload, não o modo: depois de a pessoa gerar o
  // resumo sob demanda (`/api/final-summary/from-transcript`), a sessão passa a
  // ter resumo, estudo e cards como qualquer outra, e mandá-la de volta para a
  // transcrição esconderia o que ela acabou de pagar.
  if (!session.finalSummary && session.mode === "transcript_only") {
    redirect(`/recording/${id}/transcript`);
  }

  const createdAt = new Date(session.createdAt);

  return (
    <>
      <SavedSessionView
        id={id}
        title={session.title?.trim() || "Sessão sem título"}
        createdAtLabel={DATE_FMT.format(createdAt)}
        createdAtShortLabel={DATE_FMT_SHORT.format(createdAt)}
        durationLabel={formatDurationLong(session.durationMs)}
        durationMs={session.durationMs}
        speakerName={session.speakerName}
        speakerLocation={session.speakerLocation}
        transcript={session.transcript}
        feedItems={session.feedItems}
        summary={session.finalSummary}
        rereads={rereadsRow?.payload ?? null}
        reminders={remindersRow?.payload ?? null}
        highlights={highlightsRow?.payload ?? null}
        hasDeepening={deepeningExists}
        canGenerateStudy={canGenerateStudy}
      />
      {/* A pesquisa da 1ª, 3ª e 8ª gravação. Ela não desenha nada até o
          servidor dizer que é uma delas — ver `FeedbackPrompt`. */}
      <FeedbackPrompt kind="recording" sessionId={id} delayMs={FEEDBACK_DELAY_SUMMARY_MS} />
    </>
  );
}
