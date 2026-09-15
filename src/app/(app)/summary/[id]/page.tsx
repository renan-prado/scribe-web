import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackPrompt } from "@/features/feedback/components/FeedbackPrompt";
import { FEEDBACK_DELAY_SUMMARY_MS } from "@/features/feedback/config";
import { BackToTop } from "@/features/session/components/BackToTop";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { formatDurationLong, shortDate } from "@/features/session/lib/formatting";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_RESULT_MS } from "@/features/tour/config";
import { getSession } from "@/lib/db/sessions";
import { TopBar } from "../../components/TopBar";

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
 * Toda sessão desemboca aqui, gravada ou importada do YouTube. Não existe mais
 * uma sessão sem resumo: o modo transcrição, que produzia uma, foi removido
 * junto com os outros dois.
 *
 * **Daqui saía o estudo, e não sai mais.** O modo estudo está saindo do
 * produto; enquanto ele não sai de verdade, o acesso a ele foi retirado da
 * interface, e com o botão foram embora as duas leituras que existiam só para
 * desenhá-lo: `hasDeepening` (uma ida ao banco por resumo aberto) e
 * `canCurrentUserUse("study_generation")`. Consulta que alimenta botão que não
 * existe não aparece como bug, aparece como latência.
 *
 * Tela de LEITURA: não há botão de gravar. Ele é do `/home` e mora na página
 * dele, não no layout, exatamente para não vazar para cá.
 *
 * **O cabeçalho é a MESMA `TopBar` da Biblioteca**, com duas diferenças que
 * são a tela: a pena vira um voltar para `/home` e o título some — a
 * página inteira é o título do sermão, duas linhas abaixo. A conta fica onde
 * sempre esteve. Antes daqui saía um link "Voltar" de 12px, e abrir um cartão
 * trocava o cabeçalho do app por outro.
 *
 * **E NÃO há lupa.** Ela chegou a morar aqui, levando para a busca do acervo,
 * e numa tela de um sermão só a leitura era outra: uma lupa sobre um texto
 * longo promete procurar DENTRO dele. O botão que promete uma coisa e faz
 * outra é pior que o botão que falta.
 */
export default async function V2SummaryPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const createdAt = new Date(session.createdAt);

  return (
    <>
      <SavedSessionView
        header={<TopBar backHref="/home" />}
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
        meta="compact"
        mode={session.mode}
      />
      {/* A pesquisa da 1ª, 3ª e 8ª gravação, e a apresentação da tela. As duas
          disputam o mesmo espaço, e quem cede é a pesquisa: enquanto o tour
          está aberto ela nem conta o atraso dela. Ver `FeedbackPrompt`. */}
      <FeedbackPrompt kind="recording" sessionId={id} delayMs={FEEDBACK_DELAY_SUMMARY_MS} />
      <TourTrigger tour="summary" delayMs={TOUR_DELAY_RESULT_MS} />
      {/* Um resumo com transcrição longa rola vários telefones; o voltar, o
          menu e o título moram todos no alto. Ver `BackToTop`. */}
      <BackToTop />
    </>
  );
}
