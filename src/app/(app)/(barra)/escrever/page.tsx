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
 * Biblioteca de textos vazios de quem clicou no menu e desistiu.
 *
 * **O ID, esse, nasce na hora** — sorteado no aparelho pelo editor, que troca a
 * URL para `/escrever/<id>` sem navegar. Então este endereço dura um instante,
 * e é ele que garante que cada "Escrever" seja uma folha NOVA: enquanto o
 * rascunho de um texto novo morava sob uma chave fixa, um salvamento que
 * falhasse deixava o texto guardado ali e o próximo "Escrever" abria com ele
 * dentro.
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
        /* O `key` num elemento que é PROP, e não item de lista.

           O React avisava "Each child in a list should have a unique key prop"
           apontando para cá: o `Composer` põe este elemento entre os filhos do
           `<main>` dele, e um elemento que atravessa a fronteira RSC — criado
           aqui, num server component, e entregue a um componente cliente —
           chega sem a marca interna de "já conferido" que o React põe no que
           ele mesmo cria. Sem ela, um filho sem `key` é tratado como item de
           lista, e o aviso sai com o nome deste arquivo.

           Não reproduzi numa carga limpa da rota (nem com o portal da barra
           montado, nem por navegação do cliente, nem com o layout embrulhando
           `children` num componente cliente), então este `key` é o conserto do
           que o aviso PEDE, e não de uma causa que eu tenha visto de perto. Ele
           é gratuito: um elemento que nunca muda de posição não perde nada com
           uma identidade fixa. Se o aviso voltar com ele aqui, o problema não é
           este. */
        <TopBar
          key="topbar"
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
