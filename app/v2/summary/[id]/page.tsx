import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong, shortDate } from "@/features/session/lib/formatting";
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

/**
 * O resumo de uma sessão no v2.
 *
 * **É o MESMO `SavedSessionView` do `/recording/:id/summary`**, com as mesmas
 * consultas: o que muda é só a moldura em volta. Aqui não há `AppHeader` nem
 * `MobileBottomNav` (a moldura do v2 não tem nenhum dos dois, ver
 * `app/v2/layout.tsx`) e não há o botão de gravar, que é do `/v2/home` e mora
 * na página dele, não no layout, exatamente para não vazar para cá: uma tela
 * de LEITURA não oferece gravar.
 *
 * Duas coisas do `/summary` de hoje ficaram de fora, e não por esquecimento:
 *
 * - O `TourTrigger`. A apresentação depende do `TourProvider`, que vive no
 *   layout de `(app)`, e o v2 não o tem. Quando o v2 ganhar as próprias
 *   apresentações, elas nascem com o provider dele.
 * - O `FeedbackPrompt`. A pesquisa da 1ª, 3ª e 8ª gravação é do app em
 *   produção; dispará-la a partir de uma tela em obras contaminaria a
 *   amostra com uma experiência que ainda está mudando toda semana.
 *
 * O modo transcrição SEM resumo não tem o que desenhar aqui, e o v2 ainda não
 * tem tela de transcrição: ele volta para a do app atual. É o único ponto em
 * que o v2 devolve alguém para o app de hoje, e sai quando `/v2/transcript`
 * existir.
 */
export default async function V2SummaryPage({ params }: PageProps) {
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
  if (!session.finalSummary && session.mode === "transcript_only") {
    redirect(`/recording/${id}/transcript`);
  }

  const createdAt = new Date(session.createdAt);

  return (
    <SavedSessionView
      id={id}
      title={session.title?.trim() || "Sessão sem título"}
      createdAtLabel={DATE_FMT.format(createdAt)}
      /* A data SIMPLIFICADA, "6 set", a mesma do cartão do `/v2/home`. Com o
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
      feedItems={session.feedItems}
      summary={session.finalSummary}
      rereads={rereadsRow?.payload ?? null}
      reminders={remindersRow?.payload ?? null}
      highlights={highlightsRow?.payload ?? null}
      hasDeepening={deepeningExists}
      canGenerateStudy={canGenerateStudy}
      backHref="/v2/home"
      meta="compact"
      lead="card"
    />
  );
}
