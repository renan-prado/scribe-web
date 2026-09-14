import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackPrompt } from "@/features/feedback/components/FeedbackPrompt";
import { FEEDBACK_DELAY_STUDY_MS } from "@/features/feedback/config";
import { BackToTop } from "@/features/session/components/BackToTop";
import { DeepeningMenu } from "@/features/session/components/DeepeningMenu";
import { LeadIdea } from "@/features/session/components/LeadIdea";
import {
  StudyBlockRenderer,
  studyBlockKey,
} from "@/features/session/components/StudyBlockRenderer";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_RESULT_MS } from "@/features/tour/config";
import { getDeepening } from "@/lib/db/deepenings";
import { getSessionMeta } from "@/lib/db/sessions";
import { canCurrentUserUse } from "@/lib/entitlements/server";
import { LibrarySearchLink } from "../../components/LibrarySearchLink";
import { TopBar } from "../../components/TopBar";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [session, deepening] = await Promise.all([getSessionMeta(id), getDeepening(id)]);
  const base = session?.title?.trim() || "Sessão sem título";
  const title = deepening?.payload.title?.trim() || `Estudo, ${base}`;
  return { title };
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

export default async function RecordingDeepeningPage({ params }: PageProps) {
  const { id } = await params;
  // LER um estudo ja gerado nao e restrito por plano, so gerar e reprocessar.
  // Tirar acesso a conteudo que a pessoa ja pagou seria confisco.
  const [session, deepening, canReprocess] = await Promise.all([
    getSessionMeta(id),
    getDeepening(id),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);
  if (!session || !deepening) notFound();

  const payload = deepening.payload;
  const sessionTitle = session.title?.trim() || "Sessão sem título";
  const deepeningTitle = payload.title?.trim() || `Estudo, ${sessionTitle}`;

  return (
    <main className="tone-study mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-8 sm:gap-8 sm:px-6 sm:pb-10">
      {/* A barra do app, a MESMA do `/summary`, e não o link "Voltar ao
          resumo" de 12px que ficava aqui: o estudo é a segunda tela de
          leitura do produto, e ela trocava o cabeçalho do app por outro no
          meio da mesma jornada. O voltar aponta para o RESUMO, que é de onde
          se chega aqui, e não para a Biblioteca. */}
      <TopBar backHref={`/summary/${id}`} trailing={<LibrarySearchLink />} />

      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-green-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-scriba-green">
            <BookOpen aria-hidden className="size-3" />
            Estudo
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-light text-scriba-ink-mute">
              <span className="sm:hidden">
                {DATE_FMT_SHORT.format(new Date(deepening.createdAt))}
              </span>
              <span className="hidden sm:inline">
                {DATE_FMT.format(new Date(deepening.createdAt))}
              </span>
            </span>
            <DeepeningMenu sessionId={id} canReprocess={canReprocess} />
          </div>
        </div>

        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl">
          {deepeningTitle}
        </h1>
        <p className="text-[11px] font-light text-scriba-ink-mute">
          Baseado em <span className="font-medium text-scriba-ink-soft">{sessionTitle}</span>
        </p>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

      <div className="flex flex-col gap-7">
        {/* O MESMO componente da "Ideia central" do `/summary`, na roupa de
            cartão. Dentro de `.tone-study` ele nasce verde sozinho, os tokens
            de sessão é que trocam de família. */}
        <LeadIdea
          label="Tese central"
          text={payload.shortSummary}
          variant="card"
          tourId="study-thesis"
        />
        {payload.blocks.map((block, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: same disambiguation approach as SummaryView
            key={`${block.type}-${i}-${studyBlockKey(block)}`}
          >
            <StudyBlockRenderer block={block} />
          </div>
        ))}
      </div>

      {/* A pesquisa do 1º, 3º e 8º estudo. O atraso é o maior dos três: uma
          nota dada antes de a pessoa ter lido a tese central é sobre a espera,
          não sobre o estudo. Ver `FeedbackPrompt`. */}
      <FeedbackPrompt kind="study" sessionId={id} delayMs={FEEDBACK_DELAY_STUDY_MS} />
      {/* A apresentação do estudo pronto. Mesma disputa do /summary: enquanto
          o tour está na tela, a pesquisa não conta o atraso dela. */}
      <TourTrigger tour="study" delayMs={TOUR_DELAY_RESULT_MS} />
      {/* A tela mais longa do produto: um estudo passa de dez mil palavras, e
          sem isto o caminho de volta ao topo é rolar tudo de novo. */}
      <BackToTop />
    </main>
  );
}
