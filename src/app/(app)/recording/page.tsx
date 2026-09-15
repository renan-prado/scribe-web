import type { Metadata } from "next";
import { TourTrigger } from "@/features/tour/components/TourTrigger";
import { TOUR_DELAY_CAPTURE_MS } from "@/features/tour/config";
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
  // `?auto=1` é a marca de quem chegou pelo "Resumo mágico" do `/home` (ver
  // `CreateDock`). Ele é lido AQUI, no servidor, e desce como prop: fazê-lo no
  // cliente com `useSearchParams` obrigaria esta página a nascer dentro de um
  // `<Suspense>` só para ler um parâmetro que o servidor já tem na mão.
  const { auto } = await searchParams;

  return (
    // O `ClockScope` envolve os dois porque o relógio mora na `TopBar` e o
    // tempo nasce no `AudioStudio`, em ramos diferentes da árvore.
    <ClockScope>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <TopBar title="Gravação" trailing={<RecordingClock />} />
        <AudioStudio autoStart={auto === "1"} />
      </main>
      {/* A apresentação da gravação NÃO roda para quem chegou pelo botão do
          dock: `?auto=1` começa a gravar na hora, e um balão por cima de uma
          pregação em andamento é o pior defeito que esta pasta poderia ter.
          Quem abre a tela pelo endereço direto, sem o parâmetro, vê. */}
      <TourTrigger tour="recording" delayMs={TOUR_DELAY_CAPTURE_MS} enabled={auto !== "1"} />
    </ClockScope>
  );
}
