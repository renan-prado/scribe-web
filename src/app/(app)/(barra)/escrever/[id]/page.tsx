import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionView } from "@/lib/db/sessions";
import { payloadToWritten } from "@/lib/domain/summary";
import { isUuid } from "@/lib/http/validate";
import { ImportAction, RecordAction, WriteAction } from "../../components/CreateActions";
import { LibrarySearchLink } from "../../components/LibrarySearchLink";
import { TopBar } from "../../components/TopBar";
import { Composer } from "../Composer";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionView(id);
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
 * **Um id que ainda não é linha nenhuma abre o editor VAZIO, e não um 404.**
 * O id de um texto novo é sorteado no aparelho e a URL passa a ser esta antes
 * do primeiro salvamento (ver `useWrittenDraft`), então "não achei no banco"
 * aqui quer dizer, quase sempre, "este texto ainda não subiu" — e o rascunho
 * dele está no IndexedDB, a um passo de ser lido pelo editor. Responder 404
 * seria jogar fora o texto de quem recarregou a página no meio da escrita.
 *
 * O que continua sendo 404 é um id que não é um UUID: ali não há rascunho
 * possível, é endereço digitado errado.
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
  if (!isUuid(id)) notFound();

  const session = await getSessionView(id);
  if (session && session.mode !== "manual") redirect(`/summary/${id}`);

  const written = payloadToWritten(session?.finalSummary ?? null);

  return (
    <Composer
      id={id}
      exists={!!session}
      initial={{ ...written, title: session?.title ?? written.title }}
      header={
        <TopBar
          backHref="/home"
          trailing={
            <>
              <ImportAction />
              <RecordAction />
              {/* Aqui a lupa é a das outras telas: um LINK para o acervo com o
                  campo já aberto. Procurar dentro de um rascunho que a própria
                  pessoa acabou de digitar, e que cabe na tela, seria uma busca
                  sobre um palheiro que ela conhece de cor. */}
              <LibrarySearchLink />
              <WriteAction />
            </>
          }
        />
      }
    />
  );
}
