import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackPrompt } from "@/features/feedback/components/FeedbackPrompt";
import { FEEDBACK_DELAY_SUMMARY_MS } from "@/features/feedback/config";
import { BackToTop } from "@/features/session/components/BackToTop";
import { BibleDock } from "@/features/session/components/BibleDock";
import { SavedSessionView } from "@/features/session/components/SavedSessionView";
import { SummaryFindProvider } from "@/features/session/components/SummaryFind";
import { SummaryInsertProvider } from "@/features/session/components/SummaryInsertContext";
import { formatDurationLong, shortDate } from "@/features/session/lib/formatting";
import { dehydratePassages } from "@/features/session/server/passages";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_RESULT_MS } from "@/features/tour/config";
import { getSessionView } from "@/lib/db/sessions";
import { ImportAction, RecordAction, WriteAction } from "../../components/CreateActions";
import { SummaryFindToggle } from "../../components/SummaryFindToggle";
import { TopBar } from "../../components/TopBar";
import { SummaryMobileDock } from "./SummaryMobileDock";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionView(id);
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
 * **A coluna tem 1024px e o TEXTO tem 768.** A barra do topo é a mesma peça em
 * toda tela do app, e terminá-la 256px antes daqui faria o avatar saltar de
 * lugar ao abrir um cartão; a medida de linha do resumo, essa, não é largura de
 * layout, e a 1024 um parágrafo passa de 120 caracteres. Quem separa os dois é
 * uma coluna interna no `SavedSessionView`. *
 * **No DESKTOP a barra traz as três portas de criação** (`CreateActions`, no
 * lugar onde a lupa ficaria). Elas não existem no celular, onde criar é o `+`
 * do `CreateDock` e o `CreateDock` só mora na Biblioteca: ali, chegar a esta
 * tela é ter escolhido LER, e um botão de gravar por cima do sermão aberto
 * cobraria a tela de leitura por uma ação que o voltar já alcança. Num monitor
 * as três portas não custam tela nenhuma — a barra tem vão de sobra à direita
 * do voltar —, e o que elas evitam é a viagem de ida e volta à Biblioteca só
 * para começar a próxima sessão.
 *
 * **O cabeçalho é a MESMA `TopBar` da Biblioteca**, com duas diferenças que
 * são a tela: a pena vira um voltar para `/home` e o título some — a
 * página inteira é o título do sermão, duas linhas abaixo. A conta fica onde
 * sempre esteve. Antes daqui saía um link "Voltar" de 12px, e abrir um cartão
 * trocava o cabeçalho do app por outro.
 *
 * **A lupa daqui procura DENTRO do resumo** (`SummaryFindToggle`). Ela já
 * levou para a busca do acervo, e aquilo era um botão que promete uma coisa e
 * faz outra — sobre um texto longo, uma lupa promete procurar dentro dele. A
 * saída de então foi tirar o botão; a de agora é cumprir a promessa. Quem quer
 * o acervo tem o voltar, que é por onde entrou. Ver `SummaryFind`.
 */
export default async function V2SummaryPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSessionView(id);
  if (!session) notFound();

  const createdAt = new Date(session.createdAt);

  // O texto dos versículos resolvido AQUI, contra a NVI em disco. Sem isto o
  // HTML sai com o esqueleto e o navegador hidrata com os versículos (o cache
  // do TanStack volta do IndexedDB antes do React), o que é uma divergência de
  // hidratação em toda passagem. Ver `session/server/passages.ts`.
  const passages = await dehydratePassages(session.finalSummary?.blocks);

  const page = (
    // O provider é o único DONO do rascunho de leitura (ver
    // `SummaryInsertContext`): `SavedSessionView` (referências dentro do
    // resumo, via `ChapterDialog`) e `BibloSummaryDock` escrevem os dois no
    // MESMO documento, e por isso moram DENTRO dele, não como irmãos que cada
    // um chamaria o hook por conta própria.
    <SummaryInsertProvider
      sessionId={id}
      summary={session.finalSummary}
      title={session.title?.trim() || ""}
    >
      {/* A busca DENTRO do resumo envolve a tela inteira porque ela tem DOIS
          gatilhos em ramos diferentes: a lupa da `TopBar` (que chega pronta
          pelo slot `header` do `SavedSessionView`) e o botão da barra de baixo
          do celular (`SummaryMobileDock`, irmão dela). Ele morava dentro da
          view, e ali o segundo gatilho não o alcançava. Ver `SummaryFind`. */}
      <SummaryFindProvider>
        <SavedSessionView
          header={
            <TopBar
              backHref="/home"
              trailing={
                <>
                  <ImportAction />
                  <RecordAction />
                  {/* A lupa DESTA tela procura dentro do resumo aberto, e não no
                      acervo (ver `SummaryFind`). Ela fica no mesmo lugar da lupa da
                      Biblioteca, entre "Gravar" e "Escrever": a barra tem a mesma
                      ordem em toda tela, e o que muda é o alcance da busca, que aqui
                      é o texto em que a pessoa já está. */}
                  <SummaryFindToggle />
                  <WriteAction />
                </>
              }
            />
          }
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
          hasTranscript={session.hasTranscript}
          summary={session.finalSummary}
          meta="compact"
          mode={session.mode}
          folderId={session.folderId}
        />
        {/* A pesquisa da 1ª, 3ª e 8ª gravação, e a apresentação da tela. As duas
            disputam o mesmo espaço, e quem cede é a pesquisa: enquanto o tour
            está aberto ela nem conta o atraso dela. Ver `FeedbackPrompt`. */}
        <FeedbackPrompt kind="recording" sessionId={id} delayMs={FEEDBACK_DELAY_SUMMARY_MS} />
        <TourTrigger tour="summary" delayMs={TOUR_DELAY_RESULT_MS} />
        {/* No celular, a barra unificada (busca no resumo, Biblo, editar). No
            desktop o Biblo continua sendo o disco de sempre no canto de baixo à
            direita — a pergunta nasce no meio do texto, não no topo dele. Ver
            `SummaryMobileDock` e o cabeçalho de `BibloDock`. */}
        <SummaryMobileDock sessionId={id} canEdit={!!session.finalSummary} />
        {/* A Bíblia, na borda direita, em toda a altura da leitura. Ela não
            entra no canto de baixo porque ele já tem dois donos — o Biblo, que é
            permanente, e o voltar ao topo, que empilha por cima quando aparece.
            Ver `BibleDock`. */}
        <BibleDock />
        {/* Um resumo com transcrição longa rola vários telefones; o voltar, o
            menu e o título moram todos no alto. Ver `BackToTop`.

            `stacked`: ele divide o canto com o Biblo, e o permanente fica
            embaixo. O contrário faria o botão principal pular de lugar toda vez
            que alguém rolasse a página. */}
        <BackToTop stacked />
      </SummaryFindProvider>
    </SummaryInsertProvider>
  );

  return passages ? <HydrationBoundary state={passages}>{page}</HydrationBoundary> : page;
}
