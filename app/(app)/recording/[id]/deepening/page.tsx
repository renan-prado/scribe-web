import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { DeepeningMenu } from "@/features/session/components/DeepeningMenu";
import {
  StudyBlockRenderer,
  studyBlockKey,
} from "@/features/session/components/StudyBlockRenderer";
import { getDeepening } from "@/lib/db/deepenings";
import { getSessionMeta } from "@/lib/db/sessions";
import { canCurrentUserUse } from "@/lib/entitlements/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [session, deepening] = await Promise.all([getSessionMeta(id), getDeepening(id)]);
  const base = session?.title?.trim() || "Sessão sem título";
  const title = deepening?.payload.title?.trim() || `Estudo — ${base}`;
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
  // LER um estudo ja gerado nao e restrito por plano — so gerar e reprocessar.
  // Tirar acesso a conteudo que a pessoa ja pagou seria confisco.
  const [session, deepening, canReprocess] = await Promise.all([
    getSessionMeta(id),
    getDeepening(id),
    canCurrentUserUse("study_generation").catch(() => false),
  ]);
  if (!session || !deepening) notFound();

  const payload = deepening.payload;
  const sessionTitle = session.title?.trim() || "Sessão sem título";
  const deepeningTitle = payload.title?.trim() || `Estudo — ${sessionTitle}`;

  return (
    <main className="tone-study mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
      <NavLink
        href={`/recording/${id}/summary`}
        className="-mx-1 inline-flex w-fit items-center rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-3.5" />
        Voltar ao resumo
      </NavLink>

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
        {payload.shortSummary ? (
          <div className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-green pl-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-green">
              Tese central
            </span>
            <p className="text-pretty text-lg font-medium leading-snug text-scriba-ink-strong text-balance">
              {payload.shortSummary}
            </p>
          </div>
        ) : null}
        {payload.blocks.map((block, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: same disambiguation approach as SummaryView
            key={`${block.type}-${i}-${studyBlockKey(block)}`}
          >
            <StudyBlockRenderer block={block} />
          </div>
        ))}
      </div>
    </main>
  );
}
