import type { Metadata } from "next";
import { AdminSessionReader } from "@/features/admin/components/AdminSessionReader";
import { getSessionForAdmin } from "@/features/admin/server/db/sessions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionForAdmin(id).catch(() => null);
  return { title: session?.title?.trim() || "Sessão" };
}

/**
 * `/admin/sessions/[id]` em PÁGINA CHEIA: o link colado, o F5, o resultado de
 * busca. Quem desenha é `AdminSessionReader`, o mesmo componente do
 * `@modal/(.)sessions/[id]` que abre por cima da lista — ver o cabeçalho dele
 * para o porquê de o conteúdo não morar aqui.
 */
export default async function AdminSessionReaderPage({ params }: PageProps) {
  const { id } = await params;
  return <AdminSessionReader id={id} />;
}
