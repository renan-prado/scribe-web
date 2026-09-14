import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackPrompt } from "@/features/feedback/components/FeedbackPrompt";
import { FEEDBACK_DELAY_SUMMARY_MS } from "@/features/feedback/config";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong, shortDate } from "@/features/session/lib/formatting";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_RESULT_MS } from "@/features/tour/config";
import { hasDeepening } from "@/lib/db/deepenings";
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

/**
 * O resumo de uma sessão: o DESTINO de tudo que o Scriba faz.
 *
 * Toda sessão desemboca aqui, gravada ou importada do YouTube, e é daqui que
 * sai o estudo. Não existe mais uma sessão sem resumo: o modo transcrição, que
 * produzia uma, foi removido junto com os outros dois.
 *
 * Tela de LEITURA: não há botão de gravar. Ele é do `/home` e mora na página
 * dele, não no layout, exatamente para não vazar para cá.
 */
export default async function V2SummaryPage({ params }: PageProps) {
  const { id } = await params;
  const [session, deepeningExists, canGenerateStudy] = await Promise.all([
    getSession(id),
    hasDeepening(id),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);
  if (!session) notFound();

  const createdAt = new Date(session.createdAt);

  return (
    <>
      <SavedSessionView
        id={id}
        title={session.title?.trim() || "Sessão sem título"}
        createdAtLabel={DATE_FMT.format(createdAt)}
        /* A data SIMPLIFICADA, "6 set", a mesma do cartão do `/home`. Com o
           ano só quando ele não é o corrente, e é por isso que ela é calculada
           aqui e não dentro da view: quem sabe que ano é hoje é o servidor. */
        createdAtShortLabel={shortDate(
          session.createdAt,
          createdAt.getFullYear() !== new Date().getFullYear()
        )}
        durationLabel={formatDurationLong(session.durationMs)}
        durationMs={session.durationMs}
        speakerName={session.speakerName}
        speakerLocation={session.speakerLocation}
        transcript={session.transcript}
        summary={session.finalSummary}
        hasDeepening={deepeningExists}
        canGenerateStudy={canGenerateStudy}
        backHref="/home"
        meta="compact"
        lead="card"
      />
      {/* A pesquisa da 1ª, 3ª e 8ª gravação, e a apresentação da tela. As duas
          disputam o mesmo espaço, e quem cede é a pesquisa: enquanto o tour
          está aberto ela nem conta o atraso dela. Ver `FeedbackPrompt`. */}
      <FeedbackPrompt kind="recording" sessionId={id} delayMs={FEEDBACK_DELAY_SUMMARY_MS} />
      <TourTrigger tour="summary" delayMs={TOUR_DELAY_RESULT_MS} />
    </>
  );
}
