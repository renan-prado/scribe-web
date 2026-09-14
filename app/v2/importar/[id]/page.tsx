import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { YoutubeImport } from "@/features/session/components/YoutubeImport";
import { getSessionMeta } from "@/lib/db/sessions";

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
 * Mora ao lado do formulário que a dispara (`/v2/importar`), e não sob
 * `/v2/recording`, porque aqui não há microfone, cronômetro nem botão: o
 * trabalho é do servidor, e a página existe para esperar por ele.
 *
 * É orquestração pura: resolve a sessão, confere o modo, monta o componente.
 * Quem dispara a importação é o `YoutubeImport`.
 */
export default async function RecordingYoutubePage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSessionMeta(id);
  if (!session) notFound();

  // Guard de rota: uma sessão gravada pelo microfone não tem o que importar.
  if (session.mode !== "youtube") redirect(`/v2/summary/${id}`);

  // Já importada, `ended_at` só é preenchido quando a transcrição foi gravada.
  // Voltar aqui (um "atrás" do navegador, um link velho) não pode redisparar
  // uma rota que cobra; a rota também recusa com 409, e este redirect é o que
  // evita a tela de espera piscando antes da recusa.
  if (session.endedAt) redirect(`/v2/summary/${id}`);

  // Sem URL não há o que importar. Acontece se a linha foi criada fora do
  // diálogo; a rota devolveria `invalid_url` e a tela de erro seria um beco.
  if (!session.sourceUrl) redirect("/v2/home");

  return <YoutubeImport sessionId={session.id} sourceUrl={session.sourceUrl} />;
}
