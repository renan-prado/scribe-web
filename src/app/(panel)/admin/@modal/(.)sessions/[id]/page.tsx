import { AdminSessionReader } from "@/features/admin/components/AdminSessionReader";
import { RouteModal } from "@/features/admin/components/RouteModal";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

/**
 * A leitura de uma sessão POR CIMA da lista.
 *
 * O `(.)` intercepta `/admin/sessions/[id]` quando a navegação parte de dentro
 * do painel; num F5 ou num link colado não há o que interceptar e quem
 * responde é a rota de verdade, em página cheia. As duas desenham o MESMO
 * `AdminSessionReader`.
 *
 * **O que isto compra é a lista que fica atrás.** `/admin/sessions` tem filtro
 * de modo, de usuário e paginação, tudo em `searchParams`, e é uma tela que se
 * percorre: abrir e fechar quatro sessões seguidas para achar a que se
 * procurava era, até aqui, quatro voltas à lista do zero — consulta refeita,
 * filtro perdido, rolagem no topo. Com o modal a lista nunca é desmontada.
 *
 * Largura: `max-w-4xl` porque o miolo é o `SummaryView` do produto, que lê numa
 * coluna de `max-w-3xl` (768px) — o popup precisa dela mais o respiro das
 * abas em volta. `max-h` e a rolagem do miolo já vêm do `DialogContent`.
 */
export default async function AdminSessionReaderModal({ params }: PageProps) {
  const { id } = await params;
  return (
    <RouteModal className="sm:max-w-4xl" label="Leitura da sessão">
      <AdminSessionReader id={id} inModal />
    </RouteModal>
  );
}
