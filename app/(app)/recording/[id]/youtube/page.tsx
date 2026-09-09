import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { YoutubeImport } from "@/features/session/components/YoutubeImport";
import { getSessionMeta } from "@/lib/db/sessions";
import { recordingRouteFor } from "@/lib/domain/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionMeta(id);
  const name = session?.title?.trim() || "vídeo";
  return { title: `Importando: ${name}` };
}

/**
 * O lugar de uma sessão do modo YouTube ENQUANTO ela é importada.
 *
 * Ocupa a mesma casa das três páginas de gravação — `/recording/:id/<modo>` —
 * porque cumpre o mesmo papel no fluxo: é para onde o diálogo empurra, e é de
 * onde a sessão sai pronta. Só que aqui não há microfone, cronômetro nem botão:
 * o trabalho é do servidor, e a página existe para esperar por ele.
 *
 * Como as outras, é orquestração pura: resolve a sessão, confere o modo, monta
 * o componente. Quem dispara a importação é o `YoutubeImport`.
 */
export default async function RecordingYoutubePage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSessionMeta(id);
  if (!session) notFound();

  // Guard de rota: sessões de outros modos gravam em outra página.
  if (session.mode !== "youtube") {
    redirect(`/recording/${id}/${recordingRouteFor(session.mode)}`);
  }

  // Já importada — `ended_at` só é preenchido quando a transcrição foi gravada.
  // Voltar aqui (um "atrás" do navegador, um link velho) não pode redisparar
  // uma rota que cobra; a rota também recusa com 409, e este redirect é o que
  // evita a tela de espera piscando antes da recusa.
  if (session.endedAt) redirect(`/recording/${id}/summary`);

  // Sem URL não há o que importar. Acontece se a linha foi criada fora do
  // diálogo; a rota devolveria `invalid_url` e a tela de erro seria um beco.
  if (!session.sourceUrl) redirect("/recordings");

  return <YoutubeImport sessionId={session.id} sourceUrl={session.sourceUrl} />;
}
