import type { Metadata } from "next";
import { ImportAction, RecordAction, WriteAction } from "../components/CreateActions";
import { LibrarySearchLink } from "../components/LibrarySearchLink";
import { TopBar } from "../components/TopBar";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Escrever" };

/**
 * `/escrever`, a folha em branco.
 *
 * **Ela não lê nada do servidor e não cria nada ao abrir.** A linha da sessão
 * nasce no primeiro salvamento (ver `useWrittenDraft`); criar aqui encheria a
 * Biblioteca de textos vazios de quem clicou no menu e desistiu. Até lá o
 * rascunho mora no IndexedDB do aparelho e a URL continua sendo esta — depois
 * do primeiro envio ela vira `/escrever/{id}` por um `replace`.
 *
 * **A barra é a do `/importar` e a do `/summary`**: um voltar no lugar do
 * hambúrguer, sem título. É uma tela de uma tarefa só, aberta a partir do
 * menu, e o título dela é o que a pessoa vai digitar duas linhas abaixo —
 * escrevê-lo também na barra seria dizer a mesma coisa duas vezes na mesma
 * dobra.
 *
 * **A lupa é a do `/importar`**, um LINK para o acervo (`LibrarySearchLink`), e
 * não a busca-dentro-do-texto do `/summary`: procurar num rascunho que a
 * própria pessoa acabou de digitar, e que cabe na tela, é uma busca sobre um
 * palheiro que ela conhece de cor. O `/escrever/[id]` monta a mesma barra.
 */
export default function EscreverPage() {
  return (
    <Composer
      id={null}
      initial={{ title: "", shortSummary: "", blocks: [] }}
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
