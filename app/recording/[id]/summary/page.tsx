import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o resumo de uma sessão salva mora em `/v2/summary/:id`.
 *
 * Ela continua existindo porque é o endereço mais linkado do produto: é onde
 * as quatro telas de captura desembocam no stop, é o destino de `savedRouteFor`
 * espalhado pelo código, e é o que está no bookmark de quem já usa o Scriba.
 * 308 diz que a mudança é definitiva sem quebrar nenhum dos três.
 *
 * A lógica que ela tinha (mandar para `/transcript` uma sessão do modo
 * transcrição que ainda não ganhou resumo) não se perdeu: ela é a MESMA em
 * `app/v2/summary/[id]/page.tsx`, que é quem a executa agora.
 */
export default async function SummaryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/v2/summary/${id}`);
}
