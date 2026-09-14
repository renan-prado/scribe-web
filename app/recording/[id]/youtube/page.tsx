import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: a importação roda em `/v2/importar/:id`, ao lado do formulário
 * que a dispara.
 */
export default async function YoutubeImportRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/v2/importar/${id}`);
}
