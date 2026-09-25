import { HydrationBoundary } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CopyButton } from "@/features/admin/components/CopyButton";
import { SessionModeBadge } from "@/features/admin/components/SessionModeBadge";
import {
  type SessionReaderPanel,
  SessionReaderTabs,
} from "@/features/admin/components/SessionReaderTabs";
import { getSessionForAdmin } from "@/features/admin/server/db/sessions";
import { LexiconProvider } from "@/features/session/components/LexiconProvider";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import { SummaryView } from "@/features/session/components/SummaryView";
import { formatDurationLong } from "@/features/session/lib/formatting";
import { dehydratePassages } from "@/features/session/server/passages";
import { getLexiconIndex } from "@/lib/db/lexicon";

type Props = {
  id: string;
  /** Desenhado dentro de um `RouteModal` em vez de em página cheia. */
  inModal?: boolean;
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * A leitura de UMA sessão, do jeito que o dono dela leu.
 *
 * Ela renderiza o `SummaryView` e o `SavedTranscriptView` do próprio produto,
 * e isso é a decisão central desta tela: uma segunda maneira de desenhar resumo no painel mostraria um texto
 * que ninguém viu, e a pergunta aqui é sobre o que a pessoa VIU. Quando um
 * bloco novo entrar no resumo, ele aparece aqui sem ninguém lembrar de vir
 * mexer.
 *
 * **Só lê.** Não há botão de reprocessar, de apagar nem de editar: o conserto
 * de um resumo ruim é prompt e modelo, não uma correção manual no conteúdo de
 * alguém, que o dono não pediu e não saberia que houve. O link do cabeçalho vai
 * para a tela que responde a pergunta vizinha: quanto esta sessão custou
 * (`/admin/costs?tab=sessions&sessionId=…`).
 *
 * O `SummaryView` NÃO é usado quando não há resumo: sem payload e com
 * transcrição, ele desenha o esqueleto de carregamento, e no painel isso se lê
 * como uma tela travada em vez de uma sessão sem resumo.
 *
 * **Isto é um componente, e não a página, porque tem DOIS donos.** A rota
 * `/admin/sessions/[id]` o desenha em página cheia (link colado, F5) e o
 * `@modal/(.)sessions/[id]` o desenha por cima da lista. Fossem duas cópias,
 * a primeira aba nova entraria só numa delas e ninguém notaria até alguém
 * comparar as duas.
 */
export async function AdminSessionReader({ id, inModal = false }: Props) {
  const session = await getSessionForAdmin(id);
  if (!session) notFound();

  const owner = session.ownerName?.trim() || session.ownerEmail || session.userId || "sem dono";
  const duration = formatDurationLong(session.durationMs);

  // O mesmo pré-carregamento da `/summary/:id`: esta tela desenha o `SummaryView`
  // do produto, então herda a divergência de hidratação dele junto com o
  // componente. Ver `session/server/passages.ts`.
  const passages = await dehydratePassages(session.summary?.blocks);

  // O mesmo índice de nomes que o layout de `(app)` entrega às telas do
  // produto. Ele mora aqui, e não no layout do painel, porque esta é a única
  // tela do admin que desenha prosa: pendurá-lo na moldura faria as sete telas
  // de tabela pagarem por uma marcação que nenhuma delas mostra.
  const lexicon = await getLexiconIndex();

  const panels: SessionReaderPanel[] = [
    {
      value: "resumo",
      label: "Resumo",
      content: session.summary ? (
        <ReaderSurface>
          <SummaryView summary={session.summary} hasTranscript={true} running={false} />
        </ReaderSurface>
      ) : (
        <Empty>Esta sessão não tem resumo.</Empty>
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

  const page = (
    <div className="flex flex-col gap-6">
      {/* O caminho de volta só existe em PÁGINA CHEIA. No modal ele seria um
          segundo jeito de fazer o que fechar já faz, e o pior dos dois: um
          `<Link>` para `/admin/sessions` empilha uma entrada nova no histórico
          e traz a lista do topo, sem os filtros — exatamente o que o modal
          existe para preservar. Ver `RouteModal`. */}
      {inModal ? null : (
        <Link
          href="/admin/sessions"
          className="-mx-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink"
        >
          <ArrowLeft className="size-3.5" />
          Todas as sessões
        </Link>
      )}

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
              href={`/admin/costs?tab=sessions&sessionId=${session.id}`}
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

  const withLexicon = <LexiconProvider entries={lexicon}>{page}</LexiconProvider>;

  return passages ? (
    <HydrationBoundary state={passages}>{withLexicon}</HydrationBoundary>
  ) : (
    withLexicon
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
