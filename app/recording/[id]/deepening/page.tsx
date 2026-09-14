import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o estudo mora em `/v2/studies/:id`, ao lado da lista que o
 * abre. Ele nunca foi uma tela de GRAVAÇÃO; morava sob `/recording/:id/` só
 * porque era lá que tudo que pertencia a uma sessão morava.
 */
export default async function DeepeningRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/v2/studies/${id}`);
}
