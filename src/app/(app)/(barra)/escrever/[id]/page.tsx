import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
 * `/escrever/{id}`: um resumo reaberto para edição.
 *
 * **Qualquer modo abre aqui, e não só o `manual`.** Um resumo gravado ou
 * importado é um texto sobre uma pregação, e a IA erra um nome, junta dois
 * pontos que eram um só, ou perde a frase que valia a pregação inteira —
 * consertar isso à mão custa um minuto, e a alternativa era reprocessar por 15
 * moedas na esperança de que a segunda tentativa acertasse.
 *
 * Isto já foi proibido, e a razão era de VOCABULÁRIO: o editor conhecia sete
 * dos oito tipos de bloco, e abrir aqui uma gravação mostraria um texto com
 * buracos onde estavam os `example` — que o primeiro salvamento gravaria por
 * cima do que a IA escreveu. Com `WRITTEN_BLOCK_TYPES` igual ao
 * `SummaryBlockSchema` a razão acabou; **quem acrescentar um bloco ao resumo
 * sem acrescentá-lo lá a traz de volta em silêncio.**
 *
 * O que NÃO muda é o resto da sessão: o modo continua o que era, a transcrição
 * continua onde estava, e a leitura dela continua oferecendo "Reprocessar" e
 * "Algo está errado". A consequência a dizer em voz alta é que **reprocessar
 * DESCARTA o que foi editado** — ele refaz o resumo a partir da transcrição, e
 * é isso que ele sempre fez.
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

  const written = payloadToWritten(session?.finalSummary ?? null);

  return (
    <Composer
      id={id}
      exists={!!session}
      initial={{ ...written, title: session?.title ?? written.title }}
      header={
        <TopBar
          /* O voltar leva de volta ao que se estava LENDO, e não à Biblioteca.
             Aqui sempre se chega de `/summary/{id}`, pelo "Editar o texto" do
             menu, e mandar para `/home` obrigava a achar o cartão de novo para
             conferir o que acabou de ser corrigido. Um id sem linha no banco é
             o texto novo que ainda não subiu (ver acima): ali `/summary/{id}`
             ainda não existe, e a Biblioteca é a saída certa. */
          backHref={session ? `/summary/${id}` : "/home"}
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
