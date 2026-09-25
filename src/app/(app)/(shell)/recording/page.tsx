import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import { AudioStudio } from "./AudioStudio";
import { ClockScope, RecordingClock } from "./ClockScope";

export const metadata: Metadata = { title: "Gravando" };

/**
 * A tela de gravação do v2.
 *
 * Ela grava UM áudio e transcreve UMA vez, no stop. O áudio é fragmentado a
 * cada 2 minutos no IndexedDB só para não se perder, e remontado antes de subir
 * (ver `AudioStudio`); vira duas chamadas apenas quando passa dos ~46 minutos
 * que cabem num POST.
 *
 * O cabeçalho é renderizado AQUI, e não dentro do `AudioStudio`: a `TopBar` lê
 * o perfil e o saldo no servidor, e um componente cliente não pode renderizar
 * um server component. O `AudioStudio` fica com o miolo e os controles.
 */
export default async function V2RecordingPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  // `?auto=1` é a marca de quem PEDIU para gravar (o `+` do rodapé, os chips da
  // barra no desktop, o atalho do sistema). Ele é lido AQUI, no servidor, e
  // desce como prop: fazê-lo no cliente com `useSearchParams` obrigaria esta
  // página a nascer dentro de um `<Suspense>` só para ler um parâmetro que o
  // servidor já tem na mão.
  //
  // **Sem ele, o `AudioStudio` devolve a pessoa para `/home`.** Esta tela
  // deixou de ser um destino: ela é alcançável por caminhos que não são um
  // pedido de gravar (o histórico, o app restaurado pelo sistema, um atalho
  // velho), e em todos eles o certo é a Biblioteca. O porquê inteiro está lá.
  const { auto } = await searchParams;

  return (
    // O `ClockScope` envolve os dois porque o relógio mora na `TopBar` e o
    // tempo nasce no `AudioStudio`, em ramos diferentes da árvore.
    <ClockScope>
      <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <TopBar title="Gravação" trailing={<RecordingClock />} />
        <AudioStudio autoStart={auto === "1"} />
      </main>
      {/* **Não há apresentação nesta tela, e não é esquecimento.** O tour
          `recording` existia e só podia rodar ANTES de a gravação começar, que
          é a tela sem `?auto=1` — a mesma que hoje redireciona para `/home`.
          Um balão por cima de uma pregação em andamento é o pior defeito que
          esta pasta poderia ter, então a alternativa (rodá-lo gravando) nunca
          esteve em jogo. A chave saiu de `TOURS` junto, pela regra de sempre:
          tour que descreve tela que não existe é pior que tour nenhum. */}
    </ClockScope>
  );
}
