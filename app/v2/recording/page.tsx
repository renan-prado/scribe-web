import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import { AudioStudio } from "./AudioStudio";

export const metadata: Metadata = { title: "Gravando" };

/**
 * A tela de gravação do v2.
 *
 * Ela grava de verdade: a sessão nasce no start e o áudio sobe em pedaços de
 * 15-20s durante a pregação, cada um guardado no aparelho (IndexedDB) antes de
 * tentar subir e reenviado pela fila até conseguir. No stop, a fila é esvaziada
 * e o texto vira resumo.
 *
 * Não há mais teto de duração, e perder a rede no meio deixou de custar a
 * gravação. O que ela ainda NÃO faz (retomar uma sessão de outra visita, e
 * COMEÇAR sem internet) está no cabeçalho do `AudioStudio`, junto do porquê.
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
