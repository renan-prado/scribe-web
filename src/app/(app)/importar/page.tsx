import type { Metadata } from "next";
import { YoutubeUrlForm } from "@/features/session/components/YoutubeUrlForm";
import { LibrarySearchLink } from "../components/LibrarySearchLink";
import { TopBar } from "../components/TopBar";

export const metadata: Metadata = { title: "Importar do YouTube" };

/**
 * `/importar`, onde se cola o link de um vídeo.
 *
 * Página própria, e não um passo dentro do diálogo de gravação: escolher COMO
 * capturar e escolher QUAL vídeo são duas perguntas, e o diálogo responde a
 * primeira. Ver o cabeçalho de `YoutubeUrlForm`.
 *
 * Ela não lê nada do servidor, a linha da sessão só nasce quando o formulário
 * é enviado. O saldo de moedas, que o formulário consulta, vem da gaveta da
 * `TopBar`.
 *
 * **A barra é a do `/summary`**: um voltar no lugar do hambúrguer, sem título,
 * com a lupa e o avatar de sempre. É uma tela de uma tarefa só, aberta a partir
 * do menu, e o que ela precisa oferecer é a saída — o nome dela já está escrito
 * no formulário, duas linhas abaixo.
 *
 * **E o formulário fica no MEIO da tela** (`flex-1` + `justify-center`). São
 * três linhas de conteúdo numa página inteira: encostadas no topo, sob uma
 * barra quase vazia, elas ficavam penduradas com meia tela de vão embaixo.
 */
export default function ImportarPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col px-4 pt-2 pb-10">
      <TopBar backHref="/home" trailing={<LibrarySearchLink />} />
      <div className="flex flex-1 flex-col justify-center">
        <YoutubeUrlForm />
      </div>
    </main>
  );
}
