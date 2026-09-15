import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/db/sessions";
import { payloadToWritten } from "@/lib/domain/summary";
import { TopBar } from "../../components/TopBar";
import { Composer } from "../Composer";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  const title = session?.title?.trim();
  return { title: title ? `Editando ${title}` : "Escrever" };
}

/**
 * `/escrever/{id}`: o texto escrito à mão, reaberto.
 *
 * **Só uma sessão `manual` abre aqui**, e uma gravada é REDIRECIONADA para a
 * leitura em vez de recusada. Os dois motivos são diferentes e os dois contam:
 *
 * - O editor fala um vocabulário menor que o do resumo (`WRITTEN_BLOCK_TYPES`
 *   não tem `example`, e resumos antigos ainda carregam blocos que saíram do
 *   produto). Abrir uma sessão gravada aqui mostraria um texto com buracos, e
 *   o primeiro salvamento gravaria esses buracos por cima do que a IA
 *   escreveu.
 * - Trocar o endereço por `/summary/{id}` é o que a pessoa queria de qualquer
 *   forma: ela pediu para ver aquele sermão. Um 404 na cara de quem digitou
 *   `/escrever/` no lugar de `/summary/` seria uma lição sobre a nossa
 *   estrutura de rotas.
 *
 * A rota de salvamento reconfere o modo (409 `not_manual`): esconder a tela
 * nunca é a proteção.
 *
 * O que desce daqui é o PAYLOAD do banco, e ele é só o ponto de partida: o
 * `useWrittenDraft` consulta o rascunho do aparelho e o prefere quando ele é
 * mais novo que o último envio confirmado. Ver o cabeçalho dele.
 *
 * **O título vem da COLUNA, e não do payload.** Os dois existem: `title` é o que
 * a Biblioteca, a busca e a aba do navegador leem, e `final_summary.title` é a
 * cópia que o editor gravou junto com os blocos. Renomear em `/summary` escreve
 * só a coluna (é um PATCH de metadados, ele não toca no resumo), então quem
 * renomeava ali e clicava em "Editar" reabria o editor com o título ANTIGO — ou
 * com o campo vazio, mostrando o texto de rascunho. E o primeiro salvamento
 * automático levava esse vazio de volta para a coluna: o nome que a pessoa
 * tinha acabado de escolher sumia da Biblioteca sem nada na tela dizendo por
 * quê. Lendo a coluna, os dois voltam a concordar no salvamento seguinte.
 */
export default async function EscreverIdPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.mode !== "manual") redirect(`/summary/${id}`);

  const written = payloadToWritten(session.finalSummary);

  return (
    <Composer
      id={id}
      initial={{ ...written, title: session.title ?? written.title }}
      header={<TopBar backHref="/home" />}
    />
  );
}
