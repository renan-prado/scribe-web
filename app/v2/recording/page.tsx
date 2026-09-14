import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import { AudioStudio } from "./AudioStudio";

export const metadata: Metadata = { title: "Gravando" };

/**
 * A tela de gravação do v2.
 *
 * Ela grava de verdade: microfone, um arquivo só, e no stop transcrição e
 * resumo, com a sessão nascendo só nesse momento.
 *
 * O áudio é guardado no aparelho (IndexedDB) antes da primeira chamada de rede,
 * então uma falha no envio — sem internet, ou o 413 de quem passou de ~44
 * minutos — não custa mais a gravação: a tela oferece tentar de novo e baixar o
 * arquivo, e uma pendente sobrevive a fechar a aba. O que ela ainda NÃO faz
 * (fatiar acima de ~44 minutos, e tentar o reenvio sozinha) está no cabeçalho
 * do `AudioStudio`, junto do porquê.
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
  // `?auto=1` é a marca de quem chegou pelo botão de gravar do `/v2/home` (ver
  // `RecordDock`). Ele é lido AQUI, no servidor, e desce como prop: fazê-lo no
  // cliente com `useSearchParams` obrigaria esta página a nascer dentro de um
  // `<Suspense>` só para ler um parâmetro que o servidor já tem na mão.
  const { auto } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <TopBar title="Gravação" />
      <AudioStudio autoStart={auto === "1"} />
    </main>
  );
}
