import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CopyButton } from "@/features/admin/components/CopyButton";
import { SessionModeBadge } from "@/features/admin/components/SessionModeBadge";
import {
  type SessionReaderPanel,
  SessionReaderTabs,
} from "@/features/admin/components/SessionReaderTabs";
import { Feed } from "@/features/session/components/Feed";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import {
  StudyBlockRenderer,
  studyBlockKey,
} from "@/features/session/components/StudyBlockRenderer";
import { SummaryView } from "@/features/session/components/SummaryView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { getSessionForAdmin } from "@/lib/db/admin/sessions";

export const dynamic = "force-dynamic";

/**
 * A leitura de UMA sessão, do jeito que o dono dela leu.
 *
 * Ela renderiza o `SummaryView`, o `SavedTranscriptView`, o
 * `StudyBlockRenderer` e o `Feed` do próprio produto, e isso é a decisão
 * central desta tela: uma segunda maneira de desenhar resumo no painel
 * mostraria um texto que ninguém viu, e a pergunta aqui é sobre o que a pessoa
 * VIU. Quando um bloco novo entrar no resumo, ele aparece aqui sem ninguém
 * lembrar de vir mexer.
 *
 * **Só lê.** Não há botão de reprocessar, de apagar nem de editar: o conserto
 * de um resumo ruim é prompt e modelo, não uma correção manual no conteúdo de
 * alguém, que o dono não pediu e não saberia que houve. O link do cabeçalho vai
 * para a tela que responde a pergunta vizinha: quanto esta sessão custou
 * (`/admin/precificacao?sessionId=…`).
 *
 * O `SummaryView` NÃO é usado quando não há resumo: sem payload e com
 * transcrição, ele desenha o esqueleto de carregamento, e no painel isso se
 * lê como uma tela travada em vez de uma sessão sem resumo.
 */

type PageProps = { params: Promise<{ id: string }> };

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionForAdmin(id).catch(() => null);
  return { title: session?.title?.trim() || "Sessão" };
}

export default async function AdminSessionReaderPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSessionForAdmin(id);
  if (!session) notFound();

  const owner = session.ownerName?.trim() || session.ownerEmail || session.userId || "sem dono";
  const duration = formatDurationLong(session.durationMs);
  const study = session.study;

  const panels: SessionReaderPanel[] = [
    {
      value: "resumo",
      label: "Resumo",
      content: session.summary ? (
        <ReaderSurface>
          <SummaryView summary={session.summary} hasTranscript={true} running={false} />
        </ReaderSurface>
      ) : (
        <Empty>
          Esta sessão não tem resumo.
          {session.mode === "transcript_only"
            ? " É o modo transcrição, que só gera resumo se a pessoa pedir."
            : ""}
        </Empty>
      ),
    },
    {
      value: "transcricao",
      label: "Transcrição",
      content: session.transcript.trim() ? (
        <ReaderSurface>
          <SavedTranscriptView transcript={session.transcript} durationMs={session.durationMs} />
        </ReaderSurface>
      ) : (
        <Empty>Nada foi transcrito nesta sessão.</Empty>
      ),
    },
  ];

  if (study) {
    panels.push({
      value: "estudo",
      label: "Estudo",
      content: (
        <ReaderSurface>
          <div className="tone-study flex flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong">
                {study.payload.title?.trim() || "Estudo sem título"}
              </h2>
              {/* A CONTAGEM, não as perguntas. O registro inteiro continua em
                  `session_deepenings.plan`, mas a tela que o lia (/admin/studies)
                  saiu do painel: desenhá-lo aqui seria trazer de volta, numa aba
                  de leitura, a tela que foi retirada. A contagem fica porque ela
                  qualifica o texto ao lado, um estudo de 11 perguntas não se lê
                  como um de 3. */}
              {study.record ? (
                <span className="w-fit text-[11px] font-medium text-scriba-ink-mute">
                  {study.record.answered.length} de {study.record.questions.length} perguntas
                  respondidas
                </span>
              ) : null}
            </div>
            {study.payload.shortSummary ? (
              <div className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-green pl-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-green">
                  Tese central
                </span>
                <p className="text-pretty text-lg font-medium leading-snug text-scriba-ink-strong">
                  {study.payload.shortSummary}
                </p>
              </div>
            ) : null}
            {study.payload.blocks.map((block, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: mesma desambiguação da página do estudo
                key={`${block.type}-${i}-${studyBlockKey(block)}`}
              >
                <StudyBlockRenderer block={block} />
              </div>
            ))}
          </div>
        </ReaderSurface>
      ),
    });
  }

  if (session.feedItems.length > 0) {
    panels.push({
      value: "ao-vivo",
      label: `Ao vivo (${session.feedItems.length})`,
      content: (
        <ReaderSurface>
          <Feed items={session.feedItems} running={false} hasTranscript={true} suggesting={false} />
        </ReaderSurface>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/sessions"
        className="-mx-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink"
      >
        <ArrowLeft className="size-3.5" />
        Todas as sessões
      </Link>

      <AdminPageHeader
        title={session.title?.trim() || "Sessão sem título"}
        subtitle={`${owner} · ${DATE_FMT.format(new Date(session.createdAt))}${
          duration ? ` · ${duration}` : ""
        }${session.endedAt ? "" : " · em andamento"}`}
        actions={
          <>
            <SessionModeBadge mode={session.mode} />
            <span className="inline-flex items-center font-mono text-[11px] text-scriba-ink-mute">
              {session.id.slice(0, 8)}…
              <CopyButton value={session.id} />
            </span>
            <Link
              href={`/admin/precificacao?sessionId=${session.id}`}
              className="text-[11px] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
            >
              custo por execução
            </Link>
            {session.sourceUrl ? (
              <a
                href={session.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
              >
                vídeo de origem
                <ExternalLink aria-hidden className="size-3" />
              </a>
            ) : null}
          </>
        }
      />

      {session.speakerName?.trim() || session.speakerLocation?.trim() ? (
        <p className="text-[12px] font-light text-scriba-ink-mute">
          {[session.speakerName, session.speakerLocation].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <SessionReaderTabs panels={panels} />
    </div>
  );
}

/**
 * O papel sob o texto. As telas do produto leem numa coluna estreita e centrada,
 * e é essa medida que os blocos foram desenhados para ocupar; solto na largura
 * do painel, o mesmo resumo vira linhas de 180 caracteres e deixa de se parecer
 * com o que a pessoa leu, que é o ponto desta tela.
 */
function ReaderSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-card-surface p-5 sm:p-7">
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-card-surface p-5 text-[13px] font-light text-scriba-ink-mute">
      {children}
    </div>
  );
}
